/**
 * WebSocket upgrade authentication + authorization gate (ENG-005).
 *
 * The real-time sync socket shares an origin with the Next.js app, so the
 * browser attaches the httpOnly `authjs.session-token` cookie on the upgrade
 * request automatically. This module verifies that cookie and validates the
 * requested room name. It contains no I/O and no room state, so it can be unit
 * tested in isolation and imported by the custom `server.js` under Node's
 * TypeScript type-stripping.
 *
 * Authorization follows ADR-0005's capability model: a signed-in caller holding
 * a well-formed `session-{sessionId}` room name is authorized. No per-session
 * ownership or membership lookup is performed — this mirrors the REST contract.
 */

import { decode } from "@auth/core/jwt";

/** The NextAuth cookie name (and JWT salt) for the JWT session strategy. */
export const SESSION_TOKEN_COOKIE = "authjs.session-token";

/**
 * A room is authorized only if it names a session capability: the literal
 * prefix `session-` followed by a cuid (lowercase alphanumeric, as emitted by
 * Prisma's `@default(cuid())`). Rejects `default`, empty, path-bearing, or
 * otherwise unstructured room names even for an authenticated caller.
 */
const ROOM_NAME_RE = /^session-[a-z0-9]+$/;

export type UpgradeDecision =
  | { ok: true; room: string; userId?: string }
  | { ok: false; reason: "unauthenticated" | "malformed-room" };

/** Extract a single cookie value from a raw `Cookie` header. */
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/** Derive the room name from an upgrade request URL (`/session-<id>` → `session-<id>`). */
export function roomFromUrl(url: string | undefined): string {
  const pathname = (url ?? "/").split("?")[0];
  return pathname.replace(/^\//, "");
}

export function isValidRoomName(room: string): boolean {
  return ROOM_NAME_RE.test(room);
}

/**
 * Verify the session cookie and validate the requested room. Returns a decision
 * the caller uses to accept or refuse the upgrade — it performs no logging and
 * mutates no state, so callers own the security-log event and socket teardown.
 */
export async function authorizeUpgrade(opts: {
  cookieHeader: string | undefined;
  url: string | undefined;
  secret: string;
}): Promise<UpgradeDecision> {
  const token = readCookie(opts.cookieHeader, SESSION_TOKEN_COOKIE);
  if (!token) return { ok: false, reason: "unauthenticated" };

  let decoded: Awaited<ReturnType<typeof decode>> = null;
  try {
    decoded = await decode({
      token,
      secret: opts.secret,
      salt: SESSION_TOKEN_COOKIE,
    });
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
  if (!decoded) return { ok: false, reason: "unauthenticated" };

  const room = roomFromUrl(opts.url);
  if (!isValidRoomName(room)) return { ok: false, reason: "malformed-room" };

  const sub = (decoded as { sub?: unknown }).sub;
  return {
    ok: true,
    room,
    userId: typeof sub === "string" ? sub : undefined,
  };
}
