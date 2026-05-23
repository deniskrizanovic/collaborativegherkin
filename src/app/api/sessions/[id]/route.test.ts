import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const VALID_USER_ID = "cm0000000000000000000000";
const OTHER_USER_ID = "cm0000000000000000000001";

const fakeSessionTable = {
  findMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: { session: fakeSessionTable },
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function importRoute() {
  return import("./route");
}

async function mockAuth(userId: string | null) {
  const { auth } = await import("@/auth");
  vi.mocked(auth).mockResolvedValue(
    userId ? ({ user: { id: userId, email: "test@example.com" } } as any) : null
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/sessions/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    await mockAuth(null);

    const { GET } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(401);
  });

  it("returns 200 with session when it exists", async () => {
    await mockAuth(VALID_USER_ID);
    const row = { id: "abc", title: "My session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.findUnique.mockResolvedValue(row);

    const { GET } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc");
    const res = await GET(req, makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "abc", title: "My session", userId: VALID_USER_ID });
  });

  it("returns 404 when session is not found", async () => {
    await mockAuth(VALID_USER_ID);
    fakeSessionTable.findUnique.mockResolvedValue(null);

    const { GET } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/unknown");
    const res = await GET(req, makeParams("unknown"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });
});

describe("DELETE /api/sessions/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    await mockAuth(null);

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated user does not own the session", async () => {
    await mockAuth(OTHER_USER_ID);
    const row = { id: "abc", title: "My session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.findUnique.mockResolvedValue(row);

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(403);
  });

  it("returns 204 with no body when session is deleted by owner", async () => {
    await mockAuth(VALID_USER_ID);
    const row = { id: "abc", title: "My session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.findUnique.mockResolvedValue(row);
    fakeSessionTable.delete.mockResolvedValue({});

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it("returns 404 when session is not found on get before delete", async () => {
    await mockAuth(VALID_USER_ID);
    fakeSessionTable.findUnique.mockResolvedValue(null);

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/unknown", { method: "DELETE" });
    const res = await DELETE(req, makeParams("unknown"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });

  it("returns 500 on unexpected service error during delete", async () => {
    await mockAuth(VALID_USER_ID);
    const row = { id: "abc", title: "My session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.findUnique.mockResolvedValue(row);
    fakeSessionTable.delete.mockRejectedValue(new Error("db down"));

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
