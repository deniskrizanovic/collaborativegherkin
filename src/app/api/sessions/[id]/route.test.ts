import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SessionNotFoundError } from "@/lib/session";

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

beforeEach(() => {
  vi.clearAllMocks();
});

async function importRoute() {
  return import("./route");
}

const VALID_USER_ID = "cm0000000000000000000000";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/sessions/[id]", () => {
  it("returns 200 with session when it exists", async () => {
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
  it("returns 204 with no body when session is deleted", async () => {
    fakeSessionTable.delete.mockResolvedValue({});

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it("returns 404 when session is not found", async () => {
    fakeSessionTable.delete.mockRejectedValue(new SessionNotFoundError("unknown"));

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/unknown", { method: "DELETE" });
    const res = await DELETE(req, makeParams("unknown"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
  });

  it("returns 500 on unexpected service error", async () => {
    fakeSessionTable.delete.mockRejectedValue(new Error("db down"));

    const { DELETE } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
