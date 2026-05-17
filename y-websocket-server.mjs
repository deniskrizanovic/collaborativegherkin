/**
 * Standalone Y.js WebSocket sync server.
 * Run alongside Next.js dev server: node y-websocket-server.mjs
 *
 * Implements the y-protocols sync/awareness handshake so any y-websocket
 * client can connect to ws://localhost:1234.
 */

import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/dist/sync.cjs";
import * as awarenessProtocol from "y-protocols/dist/awareness.cjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const PORT = 1234;

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

  awareness.on("update", ({ added, updated, removed }) => {
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const msg = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client.readyState === 1 /* OPEN */) client.send(msg);
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

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  // URL pattern: /<room-name>
  const roomName = (req.url ?? "/").replace(/^\//, "") || "default";
  const room = getRoom(roomName);
  room.clients.add(ws);

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
          null
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
      console.error("Error handling message:", err);
    }
  });

  // Broadcast Y.js doc updates to all other clients in the room
  const updateHandler = (update, origin) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client !== ws && client.readyState === 1) client.send(msg);
    }
  };
  room.ydoc.on("update", updateHandler);

  ws.on("close", () => {
    room.clients.delete(ws);
    room.ydoc.off("update", updateHandler);
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      [room.ydoc.clientID],
      null
    );
    closeRoom(roomName);
  });
});

console.log(`Y.js WebSocket server running on ws://localhost:${PORT}`);
