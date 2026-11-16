import { join } from "node:path";
import { integer as pgInteger, pgTable, text as pgText } from "drizzle-orm/pg-core";
import { integer as sqliteInteger, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { describeSchema, diffSchemas, loadCommittedSchemas } from "./lint-schema-parity.mjs";

const sqliteSessionWithCoaching = sqliteTable("Session", {
  id: sqliteText("id").primaryKey(),
  title: sqliteText("title").notNull(),
  prompt: sqliteText("prompt"),
  model: sqliteText("model"),
  userId: sqliteText("userId").notNull(),
});

const pgSessionWithCoaching = pgTable("Session", {
  id: pgText("id").primaryKey(),
  title: pgText("title").notNull(),
  prompt: pgText("prompt"),
  model: pgText("model"),
  userId: pgText("userId").notNull(),
});

const pgSessionWithoutCoaching = pgTable("Session", {
  id: pgText("id").primaryKey(),
  title: pgText("title").notNull(),
  userId: pgText("userId").notNull(),
});

const pgAppSetting = pgTable("AppSetting", {
  key: pgText("key").primaryKey(),
  value: pgText("value").notNull(),
});

describe("describeSchema", () => {
  it("maps each table export to its SQL column names and nullability, ignoring non-tables", () => {
    const schema = describeSchema(
      { sessions: sqliteSessionWithCoaching, helper: () => "not a table" },
      "sqlite",
    );
    expect([...schema.keys()]).toEqual(["Session"]);
    expect(Object.fromEntries(schema.get("Session") ?? new Map())).toEqual({
      id: { notNull: true },
      title: { notNull: true },
      prompt: { notNull: false },
      model: { notNull: false },
      userId: { notNull: true },
    });
  });
});

describe("diffSchemas", () => {
  it("passes when both schemas define the same tables and columns", () => {
    // Dialect column types differ (SQLite integer vs Postgres integer builders,
    // text everywhere) — only names and nullability are compared.
    const a = describeSchema(
      {
        sessions: sqliteSessionWithCoaching,
        counters: sqliteTable("Counter", { n: sqliteInteger("n").notNull() }),
      },
      "sqlite",
    );
    const b = describeSchema(
      {
        sessions: pgSessionWithCoaching,
        counters: pgTable("Counter", { n: pgInteger("n").notNull() }),
      },
      "pg",
    );
    expect(diffSchemas(a, b, "sqlite", "postgres")).toEqual([]);
  });

  it("fails and names the column when a column exists on one table only", () => {
    const a = describeSchema({ sessions: sqliteSessionWithCoaching }, "sqlite");
    const b = describeSchema({ sessions: pgSessionWithoutCoaching }, "pg");
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations).toHaveLength(2);
    expect(violations.some((v) => v.includes('"prompt"'))).toBe(true);
    expect(violations.some((v) => v.includes('"model"'))).toBe(true);
    expect(violations.every((v) => v.includes('"Session"'))).toBe(true);
  });

  it("fails and names the table when a table exists in one schema only", () => {
    const a = describeSchema({ sessions: sqliteSessionWithCoaching }, "sqlite");
    const b = describeSchema({ sessions: pgSessionWithCoaching, appSetting: pgAppSetting }, "pg");
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('"AppSetting"');
  });

  it("fails when a shared column is nullable in one schema only", () => {
    const a = describeSchema({ sessions: sqliteSessionWithCoaching }, "sqlite");
    const b = describeSchema(
      {
        sessions: pgTable("Session", {
          id: pgText("id").primaryKey(),
          title: pgText("title").notNull(),
          prompt: pgText("prompt").notNull(),
          model: pgText("model"),
          userId: pgText("userId").notNull(),
        }),
      },
      "pg",
    );
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('"Session"');
    expect(violations[0]).toContain('"prompt"');
    expect(violations[0]).toContain("nullable in sqlite but required in postgres");
  });
});

describe("committed schemas", () => {
  it("the real SQLite and Postgres schemas are at parity", async () => {
    const { sqlite, pg } = await loadCommittedSchemas(join(__dirname, ".."));
    expect(sqlite.size).toBe(4);
    expect(diffSchemas(sqlite, pg, "sqlite", "postgres")).toEqual([]);
  });
});
