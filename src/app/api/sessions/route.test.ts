import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const VALID_USER_ID = "cm0000000000000000000000";

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

describe("GET /api/sessions", () => {
  it("returns 200 with array of sessions", async () => {
    const rows = [
      { id: "abc", title: "My session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID },
    ];
    fakeSessionTable.findMany.mockResolvedValue(rows);

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: "abc", title: "My session", userId: VALID_USER_ID });
  });

  it("returns 500 when service throws", async () => {
    fakeSessionTable.findMany.mockRejectedValue(new Error("db down"));

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});

describe("POST /api/sessions", () => {
  it("returns 201 with created session on valid body", async () => {
    const created = { id: "xyz", title: "New session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.create.mockResolvedValue(created);

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New session", userId: VALID_USER_ID }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ id: "xyz", title: "New session", userId: VALID_USER_ID });
  });

  it("returns 400 when title is empty", async () => {
    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", userId: VALID_USER_ID }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "a".repeat(201), userId: VALID_USER_ID }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when userId is missing", async () => {
    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Valid title" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 500 when service throws", async () => {
    fakeSessionTable.create.mockRejectedValue(new Error("db down"));

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New session", userId: VALID_USER_ID }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
