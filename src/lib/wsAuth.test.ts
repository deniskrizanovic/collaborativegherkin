import { describe, it, expect } from "vitest";
import { encode } from "@auth/core/jwt";
import {
  authorizeUpgrade,
  isValidRoomName,
  readCookie,
  roomFromUrl,
  SESSION_TOKEN_COOKIE,
} from "./wsAuth";

const SECRET = "test-secret-for-ws-auth";

async function cookieFor(userId: string): Promise<string> {
  const token = await encode({
    token: { sub: userId, email: "user@example.com" },
    secret: SECRET,
    salt: SESSION_TOKEN_COOKIE,
  });
  return `${SESSION_TOKEN_COOKIE}=${token}`;
}

describe("readCookie", () => {
  it("extracts a named cookie from a multi-cookie header", () => {
    expect(readCookie("a=1; authjs.session-token=xyz; b=2", SESSION_TOKEN_COOKIE)).toBe("xyz");
  });

  it("returns undefined when the header is absent or the cookie is missing", () => {
    expect(readCookie(undefined, SESSION_TOKEN_COOKIE)).toBeUndefined();
    expect(readCookie("other=1", SESSION_TOKEN_COOKIE)).toBeUndefined();
  });
});

describe("roomFromUrl / isValidRoomName", () => {
  it("derives the room from the path and strips the query string", () => {
    expect(roomFromUrl("/session-abc123")).toBe("session-abc123");
    expect(roomFromUrl("/session-abc123?x=1")).toBe("session-abc123");
  });

  it("accepts only well-formed session room names", () => {
    expect(isValidRoomName("session-clh1abcd0000xyz")).toBe(true);
    expect(isValidRoomName("default")).toBe(false);
    expect(isValidRoomName("")).toBe(false);
    expect(isValidRoomName("session-")).toBe(false);
    expect(isValidRoomName("session-abc/def")).toBe(false);
    expect(isValidRoomName("session-ABC")).toBe(false); // cuid is lowercase
  });
});

describe("authorizeUpgrade", () => {
  it("accepts a valid JWT for a well-formed room", async () => {
    const decision = await authorizeUpgrade({
      cookieHeader: await cookieFor("user-1"),
      url: "/session-clh1abcd0000xyz",
      secret: SECRET,
    });
    expect(decision).toEqual({ ok: true, room: "session-clh1abcd0000xyz", userId: "user-1" });
  });

  it("rejects a missing token as unauthenticated", async () => {
    const decision = await authorizeUpgrade({
      cookieHeader: undefined,
      url: "/session-clh1abcd0000xyz",
      secret: SECRET,
    });
    expect(decision).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await encode({
      token: { sub: "user-1" },
      secret: "some-other-secret",
      salt: SESSION_TOKEN_COOKIE,
    });
    const decision = await authorizeUpgrade({
      cookieHeader: `${SESSION_TOKEN_COOKIE}=${token}`,
      url: "/session-clh1abcd0000xyz",
      secret: SECRET,
    });
    expect(decision).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects a malformed / non-JWT token", async () => {
    const decision = await authorizeUpgrade({
      cookieHeader: `${SESSION_TOKEN_COOKIE}=not-a-jwt`,
      url: "/session-clh1abcd0000xyz",
      secret: SECRET,
    });
    expect(decision).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects a valid session on a malformed room name (authenticated but unstructured room)", async () => {
    const decision = await authorizeUpgrade({
      cookieHeader: await cookieFor("user-1"),
      url: "/default",
      secret: SECRET,
    });
    expect(decision).toEqual({ ok: false, reason: "malformed-room" });
  });
});
