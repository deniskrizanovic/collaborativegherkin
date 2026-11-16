import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestEngine } from "@/db/testing";
import { authAdapter, ensureUserByEmail } from "@/lib/user";

describe.each<TestEngine>(["sqlite", "pg"])("user (%s)", (engine) => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb(engine);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates the user when none has the email", async () => {
    const user = await ensureUserByEmail(testDb.db, testDb.tables, "new@example.com");

    expect(user).toMatchObject({ email: "new@example.com", name: null });
    const { users } = testDb.tables;
    const rows = await testDb.db.select().from(users).where(eq(users.email, "new@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);
  });

  it("returns the existing user unchanged when one has the email", async () => {
    const { users } = testDb.tables;
    await testDb.db
      .insert(users)
      .values({ id: "cm000000000000000000000000", email: "dev@example.com", name: "Dev User" });

    const user = await ensureUserByEmail(testDb.db, testDb.tables, "dev@example.com");

    expect(user).toEqual({
      id: "cm000000000000000000000000",
      email: "dev@example.com",
      name: "Dev User",
    });
    expect(await testDb.db.select().from(users)).toHaveLength(1);
  });

  it("a first magic-link sign-in creates a verified user with no name or image", async () => {
    // The calls @auth/core makes when a verification token is redeemed for an
    // email with no user: look the email up, then create it as verified.
    const adapter = authAdapter(testDb.db, testDb.tables);
    expect(await adapter.getUserByEmail?.("new@example.com")).toBeNull();

    const verifiedAt = new Date();
    await adapter.createUser?.({
      id: crypto.randomUUID(),
      email: "new@example.com",
      emailVerified: verifiedAt,
    });

    const { users } = testDb.tables;
    const rows = await testDb.db.select().from(users).where(eq(users.email, "new@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ emailVerified: verifiedAt, name: null, image: null });
  });
});
