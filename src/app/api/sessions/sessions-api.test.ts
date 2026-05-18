import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    session: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import { GET as listSessions, POST as createSession } from "./route";
import { GET as getSession, DELETE as deleteSession } from "./[id]/route";
import { db } from "@/lib/db";

const VALID_USER_ID = "cm0000000000000000000000";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/sessions ────────────────────────────────────────────────────────

describe("GET /api/sessions", () => {
  it("returns 200 with sessions array", async () => {
    const sessions = [
      { id: "abc", title: "My session", createdAt: new Date(), userId: VALID_USER_ID },
    ];
    vi.mocked(db.session.findMany).mockResolvedValue(sessions as never);

    const res = await listSessions();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(sessions)));
  });

  it("returns 200 with empty array when no sessions exist", async () => {
    vi.mocked(db.session.findMany).mockResolvedValue([]);

    const res = await listSessions();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 with error message on db failure", async () => {
    vi.mocked(db.session.findMany).mockRejectedValue(new Error("db down"));

    const res = await listSessions();

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Failed to list sessions" });
  });
});

// ─── POST /api/sessions ───────────────────────────────────────────────────────

describe("POST /api/sessions", () => {
  it("returns 201 with the created session on valid input", async () => {
    const created = { id: "xyz", title: "New session", createdAt: new Date(), userId: VALID_USER_ID };
    vi.mocked(db.session.create).mockResolvedValue(created as never);

    const res = await createSession(postRequest({ title: "New session", userId: VALID_USER_ID }));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "xyz", title: "New session" });
  });

  it("returns 400 when title is empty", async () => {
    const res = await createSession(postRequest({ title: "", userId: VALID_USER_ID }));

    expect(res.status).toBe(400);
    expect(vi.mocked(db.session.create)).not.toHaveBeenCalled();
  });

  it("returns 400 when title is missing", async () => {
    const res = await createSession(postRequest({ userId: VALID_USER_ID }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const res = await createSession(postRequest({ title: "a".repeat(201), userId: VALID_USER_ID }));

    expect(res.status).toBe(400);
    expect(vi.mocked(db.session.create)).not.toHaveBeenCalled();
  });

  it("returns 400 when userId is not a valid CUID", async () => {
    const res = await createSession(postRequest({ title: "Valid title", userId: "not-a-cuid" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 with field-level validation errors", async () => {
    const res = await createSession(postRequest({ title: "", userId: VALID_USER_ID }));
    const body = await res.json();

    expect(body).toHaveProperty("error");
  });

  it("returns 500 on db failure", async () => {
    vi.mocked(db.session.create).mockRejectedValue(new Error("db down"));

    const res = await createSession(postRequest({ title: "Valid", userId: VALID_USER_ID }));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Failed to create session" });
  });
});

// ─── GET /api/sessions/[id] ───────────────────────────────────────────────────

describe("GET /api/sessions/[id]", () => {
  it("returns 200 with the session when it exists", async () => {
    const session = { id: "abc", title: "My session", createdAt: new Date(), userId: VALID_USER_ID };
    vi.mocked(db.session.findUnique).mockResolvedValue(session as never);

    const res = await getSession(
      new NextRequest("http://localhost/api/sessions/abc"),
      makeParams("abc")
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "abc", title: "My session" });
  });

  it("returns 404 when the session does not exist", async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(null);

    const res = await getSession(
      new NextRequest("http://localhost/api/sessions/missing"),
      makeParams("missing")
    );

    expect(res.status).toBe(404);
  });

  it("returns 500 on db failure", async () => {
    vi.mocked(db.session.findUnique).mockRejectedValue(new Error("db down"));

    const res = await getSession(
      new NextRequest("http://localhost/api/sessions/abc"),
      makeParams("abc")
    );

    expect(res.status).toBe(500);
  });
});

// ─── DELETE /api/sessions/[id] ────────────────────────────────────────────────

describe("DELETE /api/sessions/[id]", () => {
  it("returns 204 and deletes the session", async () => {
    vi.mocked(db.session.delete).mockResolvedValue({} as never);

    const res = await deleteSession(
      new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" }),
      makeParams("abc")
    );

    expect(res.status).toBe(204);
    expect(vi.mocked(db.session.delete)).toHaveBeenCalledWith({ where: { id: "abc" } });
  });

  it("returns 500 on db failure", async () => {
    vi.mocked(db.session.delete).mockRejectedValue(new Error("db down"));

    const res = await deleteSession(
      new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" }),
      makeParams("abc")
    );

    expect(res.status).toBe(500);
  });
});
