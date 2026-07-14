/**
 * Custom Node server (ENG-005).
 *
 * One process serves the Next.js app over HTTP and the Y.js real-time sync
 * WebSocket on the same origin/port. Because the socket shares the app's
 * origin, the browser sends the httpOnly NextAuth session cookie on the
 * `upgrade` request, which this server verifies before joining any room.
 *
 * The same file runs in dev (`NODE_ENV` unset/"development") and production
 * ("production"), so Railway and EC2 deploy one identical artifact.
 *
 * The Y.js sync/awareness protocol below is relocated verbatim from the former
 * `y-websocket-server.mjs`; only its logging (Pino, not console.*) and its
 * connection-acceptance gate (the auth check) are new.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { default as nextEnv } from "@next/env";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import logger from "./src/lib/logger.ts";
import { authorizeUpgrade } from "./src/lib/wsAuth.ts";

/*
 * Suppress the harmless "Yjs was already imported" warning
 * (https://github.com/yjs/yjs/issues/438) — INVESTIGATED, deliberately kept.
 *
 * Root cause: this single process loads Yjs twice, via two separate module
 * systems that don't share a module cache:
 *   1. This file (`server.js`) — Node's native ESM loader resolves
 *      `import * as Y from "yjs"` to `node_modules/yjs/dist/yjs.mjs`.
 *   2. Next.js SSR — when it server-renders the session page it bundles its
 *      OWN copy of the same `yjs.mjs` into `.next/.../ssr/…_yjs_…`.
 * Both set the `__ $YJS$ __` flag on the shared `globalThis`; whichever loads
 * second sees it already set and Yjs emits this `console.error`.
 *
 * Why it is benign HERE (verified before deciding to keep it): the two Yjs
 * instances never exchange objects, so the `instanceof` constructor checks the
 * warning protects can never actually fire across them.
 *   - `server.js` only creates its own `Y.Doc`s and speaks binary sync updates
 *     over the socket; it never receives a live Y object from the Next bundle.
 *   - Next only *imports* Yjs during SSR of a "use client" tree — the client
 *     provider's `new Y.Doc()` sits behind `useState`, which does not run on the
 *     server, so SSR instantiates no Y objects. The real client doc lives in the
 *     browser, a third isolated runtime.
 *
 * The clean fix (load the editor via `next/dynamic` with `ssr:false` so Next
 * never loads Yjs server-side) touches the Do-Not-Touch collaboration wiring
 * (CLAUDE.md) for a warning that has no runtime effect. Decision: do NOT alter
 * the collaboration code; instead filter this one exact line so it stops
 * cluttering the server log. Revisit if a Y object ever needs to cross the
 * server.js ↔ Next boundary.
 *
 * The interception is deliberately SELF-RESTORING: Yjs emits this exactly once,
 * at module load (verified — repeated session-page SSRs produce a single line).
 * So we patch `console.error` only long enough to swallow that one message, then
 * restore the original immediately. This keeps the global monkeypatch from
 * living for the whole process lifetime — after the one warning, every
 * `console.error` (Next.js/React internals etc.) passes through untouched. Our
 * own app logging is unaffected regardless: it goes through Pino
 * (src/lib/logger.ts), which writes to its own streams, not `console.error`.
 */
const YJS_DUP_IMPORT_WARNING = "Yjs was already imported.";
const origConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].startsWith(YJS_DUP_IMPORT_WARNING)) {
    console.error = origConsoleError; // one-shot: restore before returning
    return;
  }
  origConsoleError(...args);
};

const dev = process.env.NODE_ENV !== "production";
// `|| 3000` (not `?? 3000`) so an empty or non-positive PORT falls back to the
// default rather than binding a random port.
const PORT = Number(process.env.PORT) || 3000;

// Load `.env` / `.env.local` into process.env before reading AUTH_SECRET, the
// same way `next dev`/`next start` do — a custom server does not get this for
// free.
nextEnv.loadEnvConfig(process.cwd(), dev);

// Fail fast if the shared secret is missing — otherwise WS upgrades would
// verify JWTs against an empty secret and fall open. NextAuth already requires
// this in production; enforce it for the WS gate in every environment.
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  logger.fatal("AUTH_SECRET is not set — refusing to start (WebSocket auth would fall open)");
  process.exit(1);
}

const messageSync = 0;
const messageAwareness = 1;

// Map of room name → { ydoc, awareness, clients: Set<WebSocket> }
const rooms = new Map();

function getRoom(name) {
  if (rooms.has(name)) return rooms.get(name);
  const ydoc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(ydoc);
  const room = { ydoc, awareness, clients: new Set() };
  rooms.set(name, room);

  // Single room-level handler: broadcast to all clients except the origin sender.
  ydoc.on("update", (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client !== origin && client.readyState === 1) client.send(msg);
    }
  });

  awareness.on("update", ({ added, updated, removed }, origin) => {
    // Track which awareness clientIDs each connection owns so we can clear
    // exactly those when it disconnects. `origin` is the WebSocket that
    // applied the update (see handleConnection); server-originated updates
    // (origin == null) have no connection to attribute.
    if (origin && origin.controlledIds) {
      for (const id of [...added, ...updated]) origin.controlledIds.add(id);
      for (const id of removed) origin.controlledIds.delete(id);
    }
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const msg = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  });

  return room;
}

function closeRoom(name) {
  const room = rooms.get(name);
  if (room && room.clients.size === 0) {
    room.awareness.destroy();
    rooms.delete(name);
  }
}

// Wire a socket that has already been authenticated into its room and run the
// sync/awareness handshake + message loop (relocated verbatim).
function handleConnection(ws, roomName) {
  const room = getRoom(roomName);
  room.clients.add(ws);

  // Awareness clientIDs this connection has announced. Populated by the room's
  // awareness "update" handler (which receives this ws as the update origin)
  // and drained on close so a departing client's presence is actually removed.
  ws.controlledIds = new Set();

  // Send full sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.ydoc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current awareness state
  if (room.awareness.states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        [...room.awareness.states.keys()]
      )
    );
    ws.send(encoding.toUint8Array(encoder));
  }

  ws.on("message", (data) => {
    const msg = data instanceof Buffer ? data : Buffer.from(data);
    try {
      const decoder = decoding.createDecoder(msg);
      const msgType = decoding.readVarUint(decoder);

      if (msgType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          room.ydoc,
          ws
        );
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        // Broadcast update to other clients if this was a doc update
        if (syncMessageType === syncProtocol.messageYjsUpdate) {
          // Already handled via ydoc update event
        }
      } else if (msgType === messageAwareness) {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          ws
        );
      }
    } catch (err) {
      logger.error({ err }, "Error handling Y.js message");
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);
    // Remove the awareness states this specific connection announced, so its
    // presence/cursors are broadcast as removed instead of lingering forever.
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      [...ws.controlledIds],
      null
    );
    closeRoom(roomName);
  });
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  // noServer mode: we drive the handshake ourselves after the auth gate passes.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    // Only the Next.js HMR path (dev) and our sync path should reach here; let
    // Next handle its own upgrades (e.g. dev HMR) and gate everything else.
    const pathname = parse(req.url).pathname ?? "/";
    if (pathname.startsWith("/_next")) return; // Next dev HMR — leave untouched

    authorizeUpgrade({
      cookieHeader: req.headers.cookie,
      url: req.url,
      secret: AUTH_SECRET,
    })
      .then((decision) => {
        if (!decision.ok) {
          // Content-free security log — never log the token or its contents.
          logger.warn({ event: "ws_upgrade_rejected", reason: decision.reason }, "WebSocket upgrade rejected");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          handleConnection(ws, decision.room);
        });
      })
      .catch((err) => {
        logger.error({ err }, "WebSocket upgrade handler error");
        socket.destroy();
      });
  });

  server.listen(PORT, () => {
    logger.info(`Server ready on http://localhost:${PORT} (dev=${dev})`);
  });
});
