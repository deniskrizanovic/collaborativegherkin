import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/postgres/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
