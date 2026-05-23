import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { DEFAULT_PROMPT, DEFAULT_MODEL } from "../src/lib/llm-constants";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const db = new PrismaClient({ adapter });

async function main() {
  await db.user.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: {
      id: "cm000000000000000000000000",
      email: "dev@example.com",
      name: "Dev User",
    },
  });
  console.log("Seeded dev user.");

  await db.appSetting.upsert({
    where: { key: "llm_review_prompt" },
    update: {},
    create: { key: "llm_review_prompt", value: DEFAULT_PROMPT },
  });
  await db.appSetting.upsert({
    where: { key: "llm_review_model" },
    update: {},
    create: { key: "llm_review_model", value: DEFAULT_MODEL },
  });
  console.log("Seeded LLM settings.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
