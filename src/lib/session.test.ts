import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestEngine } from "@/db/testing";
import { Session, SessionNotFoundError } from "@/lib/session";

const USER_ID = "cm0000000000000000000000";
const OTHER_USER_ID = "cm0000000000000000000001";

describe.each<TestEngine>(["sqlite", "pg"])("Session (%s)", (engine) => {
  let testDb: TestDb;

  function makeSession() {
    return new Session({ db: testDb.db, tables: testDb.tables });
  }

  beforeEach(async () => {
    testDb = await createTestDb(engine);
    await testDb.db.insert(testDb.tables.users).values([
      { id: USER_ID, email: "owner@example.com" },
      { id: OTHER_USER_ID, email: "other@example.com" },
    ]);
  });

  afterEach(async () => {
    await testDb.close().catch(() => {});
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe("Session.list", () => {
    it("returns the user's sessions ordered by createdAt desc", async () => {
      const { sessions } = testDb.tables;
      await testDb.db.insert(sessions).values([
        { id: "older", title: "Older", userId: USER_ID, createdAt: new Date("2026-01-01") },
        { id: "newer", title: "Newer", userId: USER_ID, createdAt: new Date("2026-02-01") },
        { id: "theirs", title: "Theirs", userId: OTHER_USER_ID },
      ]);

      const result = await makeSession().list(USER_ID);

      expect(result).toEqual([
        {
          id: "newer",
          title: "Newer",
          prompt: null,
          model: null,
          createdAt: new Date("2026-02-01"),
          userId: USER_ID,
        },
        {
          id: "older",
          title: "Older",
          prompt: null,
          model: null,
          createdAt: new Date("2026-01-01"),
          userId: USER_ID,
        },
      ]);
    });

    it("returns empty array when no sessions exist for user", async () => {
      const result = await makeSession().list(USER_ID);

      expect(result).toEqual([]);
    });

    it("propagates db errors", async () => {
      await testDb.close();

      await expect(makeSession().list(USER_ID)).rejects.toThrow();
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe("Session.create", () => {
    it("returns the created session with a generated id", async () => {
      const result = await makeSession().create({ title: "New session", userId: USER_ID });

      expect(result).toMatchObject({
        title: "New session",
        prompt: null,
        model: null,
        userId: USER_ID,
      });
      expect(result.id).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(await makeSession().get(result.id)).toEqual(result);
    });

    it("propagates db errors", async () => {
      await testDb.close();

      await expect(
        makeSession().create({ title: "New session", userId: USER_ID }),
      ).rejects.toThrow();
    });
  });

  // ─── get ────────────────────────────────────────────────────────────────────

  describe("Session.get", () => {
    it("returns the session when it exists", async () => {
      const created = await makeSession().create({ title: "My session", userId: USER_ID });

      const result = await makeSession().get(created.id);

      expect(result).toEqual(created);
    });

    it("throws SessionNotFoundError when no session has the id", async () => {
      await expect(makeSession().get("missing")).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it("propagates db errors", async () => {
      await testDb.close();

      await expect(makeSession().get("abc")).rejects.toThrow();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe("Session.update", () => {
    it("persists the new prompt", async () => {
      const { id } = await makeSession().create({ title: "S", userId: USER_ID });

      await expect(makeSession().update(id, { prompt: "new prompt" })).resolves.toBeUndefined();

      expect(await makeSession().get(id)).toMatchObject({ prompt: "new prompt", model: null });
    });

    it("persists the new model", async () => {
      const { id } = await makeSession().create({ title: "S", userId: USER_ID });

      await expect(makeSession().update(id, { model: "some-model" })).resolves.toBeUndefined();

      expect(await makeSession().get(id)).toMatchObject({ prompt: null, model: "some-model" });
    });

    it("throws SessionNotFoundError when no session has the id", async () => {
      await expect(makeSession().update("missing", { prompt: "x" })).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );
    });

    it("propagates db errors", async () => {
      await testDb.close();

      await expect(makeSession().update("abc", { prompt: "x" })).rejects.toThrow();
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe("Session.delete", () => {
    it("removes the session", async () => {
      const { id } = await makeSession().create({ title: "S", userId: USER_ID });

      await expect(makeSession().delete(id)).resolves.toBeUndefined();

      await expect(makeSession().get(id)).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it("throws SessionNotFoundError when no session has the id", async () => {
      await expect(makeSession().delete("missing")).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it("propagates db errors", async () => {
      await testDb.close();

      await expect(makeSession().delete("abc")).rejects.toThrow();
    });
  });
});
