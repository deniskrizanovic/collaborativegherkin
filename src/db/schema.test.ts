// Database constraints from the data-model spec, checked against the migrated
// database on both engines. The schema files are outside the mutation scope
// (stryker.config.json), so these tests are what guard the unique keys,
// foreign-key actions, generated ids and timestamps.

import { isCuid } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestEngine } from "@/db/testing";

const USER_ID = "cm0000000000000000000000";

describe.each<TestEngine>(["sqlite", "pg"])("schema constraints (%s)", (engine) => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb(engine);
  });

  afterEach(async () => {
    await testDb.close().catch(() => {});
  });

  function insertUser(values: { id?: string; email: string }) {
    return testDb.db.insert(testDb.tables.users).values(values).returning();
  }

  function insertAccount(userId: string) {
    return testDb.db
      .insert(testDb.tables.accounts)
      .values({ userId, type: "email", provider: "resend", providerAccountId: "dev@example.com" })
      .returning();
  }

  describe("User", () => {
    it("rejects a second user with the same email", async () => {
      const { users } = testDb.tables;
      await insertUser({ email: "dev@example.com" });

      await expect(insertUser({ email: "dev@example.com" })).rejects.toThrow();

      const rows = await testDb.db.select().from(users).where(eq(users.email, "dev@example.com"));
      expect(rows).toHaveLength(1);
    });

    it("gets a generated CUID id", async () => {
      const [user] = await insertUser({ email: "dev@example.com" });
      expect(isCuid(user.id)).toBe(true);
    });

    it("may own zero or more sessions", async () => {
      const { sessions } = testDb.tables;
      await insertUser({ id: USER_ID, email: "dev@example.com" });
      await insertUser({ id: "cm0000000000000000000001", email: "none@example.com" });

      await testDb.db.insert(sessions).values([
        { title: "One", userId: USER_ID },
        { title: "Two", userId: USER_ID },
      ]);

      expect(
        await testDb.db.select().from(sessions).where(eq(sessions.userId, USER_ID)),
      ).toHaveLength(2);
      expect(
        await testDb.db
          .select()
          .from(sessions)
          .where(eq(sessions.userId, "cm0000000000000000000001")),
      ).toHaveLength(0);
    });
  });

  describe("Account", () => {
    beforeEach(async () => {
      await insertUser({ id: USER_ID, email: "dev@example.com" });
    });

    it("rejects a duplicate provider and providerAccountId", async () => {
      await insertAccount(USER_ID);
      await expect(insertAccount(USER_ID)).rejects.toThrow();
    });

    it("gets a generated CUID id", async () => {
      const [account] = await insertAccount(USER_ID);
      expect(isCuid(account.id)).toBe(true);
    });

    it("is deleted with its user", async () => {
      const { users, accounts } = testDb.tables;
      await insertAccount(USER_ID);

      await testDb.db.delete(users).where(eq(users.id, USER_ID));

      expect(await testDb.db.select().from(accounts).where(eq(accounts.userId, USER_ID))).toEqual(
        [],
      );
    });
  });

  describe("VerificationToken", () => {
    it("rejects a duplicate identifier and token", async () => {
      const { verificationTokens } = testDb.tables;
      const token = {
        identifier: "dev@example.com",
        token: "abc123",
        expires: new Date("2026-12-01"),
      };
      await testDb.db.insert(verificationTokens).values(token);

      await expect(testDb.db.insert(verificationTokens).values(token)).rejects.toThrow();
    });
  });

  describe("Session", () => {
    beforeEach(async () => {
      await insertUser({ id: USER_ID, email: "dev@example.com" });
    });

    it("gets a generated CUID id and both timestamps", async () => {
      const before = Date.now();
      const [session] = await testDb.db
        .insert(testDb.tables.sessions)
        .values({ title: "Checkout", userId: USER_ID })
        .returning();

      expect(isCuid(session.id)).toBe(true);
      expect(session.userId).toBe(USER_ID);
      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it("moves updatedAt on every update", async () => {
      const { sessions } = testDb.tables;
      const stale = new Date("2026-01-01");
      const [session] = await testDb.db
        .insert(sessions)
        .values({ title: "Checkout", userId: USER_ID, updatedAt: stale })
        .returning();

      const [updated] = await testDb.db
        .update(sessions)
        .set({ title: "Checkout v2" })
        .where(eq(sessions.id, session.id))
        .returning();

      expect(updated.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
    });

    it("rejects a session whose user does not exist", async () => {
      await expect(
        testDb.db
          .insert(testDb.tables.sessions)
          .values({ title: "Orphan", userId: "cm0000000000000000000009" }),
      ).rejects.toThrow();
    });

    it("blocks deleting a user who owns a session", async () => {
      const { users, sessions } = testDb.tables;
      await testDb.db.insert(sessions).values({ title: "Checkout", userId: USER_ID });

      await expect(testDb.db.delete(users).where(eq(users.id, USER_ID))).rejects.toThrow();

      expect(await testDb.db.select().from(users).where(eq(users.id, USER_ID))).toHaveLength(1);
      expect(
        await testDb.db.select().from(sessions).where(eq(sessions.userId, USER_ID)),
      ).toHaveLength(1);
    });
  });
});
