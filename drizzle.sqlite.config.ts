import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// SQLite (development and CI). The `file:` prefix is optional for drizzle-kit;
// the path is resolved relative to the working directory (repo root).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.sqlite.ts",
  out: "./drizzle/sqlite",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
