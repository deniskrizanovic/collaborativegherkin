import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Resolved relative to this config file's directory (Prisma >= 7.10).
  schema: "schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
