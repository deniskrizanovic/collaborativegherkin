import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

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
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
