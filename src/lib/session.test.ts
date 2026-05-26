import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session, SessionNotFoundError } from "@/lib/session";

const fakeSessionTable = {
  findMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const VALID_USER_ID = "cm0000000000000000000000";

function makeSession() {
  return new Session({ session: fakeSessionTable as any });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("Session.list", () => {
  it("returns sessions for the given user ordered by createdAt desc", async () => {
    const rows = [
      { id: "abc", title: "My session", prompt: null, model: null, createdAt: new Date(), userId: VALID_USER_ID },
    ];
    fakeSessionTable.findMany.mockResolvedValue(rows);

    const result = await makeSession().list(VALID_USER_ID);

    expect(result).toEqual(rows);
    expect(fakeSessionTable.findMany).toHaveBeenCalledWith({
      where: { userId: VALID_USER_ID },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, prompt: true, model: true, createdAt: true, userId: true },
    });
  });

  it("returns empty array when no sessions exist for user", async () => {
    fakeSessionTable.findMany.mockResolvedValue([]);

    const result = await makeSession().list(VALID_USER_ID);

    expect(result).toEqual([]);
  });

  it("propagates db errors", async () => {
    fakeSessionTable.findMany.mockRejectedValue(new Error("db down"));

    await expect(makeSession().list(VALID_USER_ID)).rejects.toThrow("db down");
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("Session.create", () => {
  it("returns the created session", async () => {
    const created = { id: "xyz", title: "New session", prompt: null, model: null, createdAt: new Date(), userId: VALID_USER_ID };
    fakeSessionTable.create.mockResolvedValue(created);

    const result = await makeSession().create({ title: "New session", userId: VALID_USER_ID });

    expect(result).toEqual(created);
    expect(fakeSessionTable.create).toHaveBeenCalledWith({
      data: { title: "New session", userId: VALID_USER_ID },
    });
  });

  it("propagates db errors", async () => {
    fakeSessionTable.create.mockRejectedValue(new Error("db down"));

    await expect(
      makeSession().create({ title: "New session", userId: VALID_USER_ID })
    ).rejects.toThrow("db down");
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe("Session.get", () => {
  it("returns the session when it exists", async () => {
    const row = { id: "abc", title: "My session", prompt: null, model: null, createdAt: new Date(), userId: VALID_USER_ID };
    fakeSessionTable.findUnique.mockResolvedValue(row);

    const result = await makeSession().get("abc");

    expect(result).toEqual(row);
    expect(fakeSessionTable.findUnique).toHaveBeenCalledWith({
      where: { id: "abc" },
      select: { id: true, title: true, prompt: true, model: true, createdAt: true, userId: true },
    });
  });

  it("throws SessionNotFoundError when findUnique returns null", async () => {
    fakeSessionTable.findUnique.mockResolvedValue(null);

    await expect(makeSession().get("missing")).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("propagates db errors", async () => {
    fakeSessionTable.findUnique.mockRejectedValue(new Error("db down"));

    await expect(makeSession().get("abc")).rejects.toThrow("db down");
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("Session.update", () => {
  it("resolves when prompt is updated", async () => {
    fakeSessionTable.update.mockResolvedValue({});

    await expect(makeSession().update("abc", { prompt: "new prompt" })).resolves.toBeUndefined();
    expect(fakeSessionTable.update).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { prompt: "new prompt" },
    });
  });

  it("resolves when model is updated", async () => {
    fakeSessionTable.update.mockResolvedValue({});

    await expect(makeSession().update("abc", { model: "some-model" })).resolves.toBeUndefined();
    expect(fakeSessionTable.update).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { model: "some-model" },
    });
  });

  it("throws SessionNotFoundError when Prisma throws P2025", async () => {
    fakeSessionTable.update.mockRejectedValue({ code: "P2025" });

    await expect(makeSession().update("missing", { prompt: "x" })).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("propagates non-P2025 db errors", async () => {
    fakeSessionTable.update.mockRejectedValue(new Error("db down"));

    await expect(makeSession().update("abc", { prompt: "x" })).rejects.toThrow("db down");
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("Session.delete", () => {
  it("resolves when session is deleted", async () => {
    fakeSessionTable.delete.mockResolvedValue({});

    await expect(makeSession().delete("abc")).resolves.toBeUndefined();
    expect(fakeSessionTable.delete).toHaveBeenCalledWith({ where: { id: "abc" } });
  });

  it("throws SessionNotFoundError when Prisma throws P2025", async () => {
    fakeSessionTable.delete.mockRejectedValue({ code: "P2025" });

    await expect(makeSession().delete("missing")).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("propagates non-P2025 db errors", async () => {
    fakeSessionTable.delete.mockRejectedValue(new Error("db down"));

    await expect(makeSession().delete("abc")).rejects.toThrow("db down");
  });
});
