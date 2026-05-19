import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEFAULT_PROMPT =
  "You are an expert in Behaviour-Driven Development. Review the following Gherkin scenarios and suggest concrete improvements. Focus on: clarity of steps, missing edge cases, ambiguous language, and structural issues. Format your response in Markdown.";

const DEFAULT_MODEL = "meta-llama/llama-3.2-3b-instruct:free";

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
