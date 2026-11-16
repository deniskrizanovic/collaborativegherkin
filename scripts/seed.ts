import dotenv from "dotenv";

// Load env before importing db so DATABASE_URL picks the engine (the seed runs
// outside Next.js).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { closeDb, db, tables } = await import("../src/lib/db");
  try {
    await db
      .insert(tables.users)
      .values({
        id: "cm000000000000000000000000",
        email: "dev@example.com",
        name: "Dev User",
      })
      .onConflictDoNothing();
    console.log("Seeded dev user.");
  } finally {
    await closeDb();
  }
}

main().catch(console.error);
