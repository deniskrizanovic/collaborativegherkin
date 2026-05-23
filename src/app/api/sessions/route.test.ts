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

describe("GET /api/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    await mockAuth(null);

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 200 with sessions owned by the authenticated user", async () => {
    await mockAuth(VALID_USER_ID);
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
    expect(fakeSessionTable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: VALID_USER_ID } })
    );
  });

  it("returns 500 when service throws", async () => {
    await mockAuth(VALID_USER_ID);
    fakeSessionTable.findMany.mockRejectedValue(new Error("db down"));

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});

describe("POST /api/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    await mockAuth(null);

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New session" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 201 with created session on valid body", async () => {
    await mockAuth(VALID_USER_ID);
    const created = { id: "xyz", title: "New session", createdAt: new Date("2024-01-01"), userId: VALID_USER_ID };
    fakeSessionTable.create.mockResolvedValue(created);

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New session" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ id: "xyz", title: "New session", userId: VALID_USER_ID });
  });

  it("returns 400 when title is empty", async () => {
    await mockAuth(VALID_USER_ID);

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    await mockAuth(VALID_USER_ID);

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "a".repeat(201) }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 500 when service throws", async () => {
    await mockAuth(VALID_USER_ID);
    fakeSessionTable.create.mockRejectedValue(new Error("db down"));

    const { POST } = await importRoute();
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New session" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
