import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { Db, Tables } from "../lib/db";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

export type TestEngine = "sqlite" | "pg";

export interface TestDb {
  db: Db;
  tables: Tables;
  close: () => Promise<void>;
}

const migrationsFolder = (engine: TestEngine) =>
  fileURLToPath(new URL(`../../drizzle/${engine}`, import.meta.url));

// A fresh in-memory database with the committed migrations applied: SQLite via
// better-sqlite3 `:memory:`, PostgreSQL via in-process PGlite. Cast to the same
// `Db` type the app uses (see src/lib/db.ts).
export async function createTestDb(engine: TestEngine): Promise<TestDb> {
  if (engine === "sqlite") {
    const client = new Database(":memory:");
    const db = drizzleSqlite(client, { schema: sqliteSchema });
    migrateSqlite(db, { migrationsFolder: migrationsFolder("sqlite") });
    return {
      db: db as unknown as Db,
      tables: sqliteSchema as unknown as Tables,
      close: async () => {
        client.close();
      },
    };
  }
  const client = new PGlite();
  const db = drizzlePglite(client, { schema: pgSchema });
  await migratePglite(db, { migrationsFolder: migrationsFolder("pg") });
  return {
    db: db as unknown as Db,
    tables: pgSchema,
    close: () => client.close(),
  };
}
