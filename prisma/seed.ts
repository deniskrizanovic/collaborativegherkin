import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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
