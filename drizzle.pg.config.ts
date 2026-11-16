import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// PostgreSQL (production).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle/pg",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
