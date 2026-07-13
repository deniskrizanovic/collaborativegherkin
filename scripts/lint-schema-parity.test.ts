import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseModels, diffSchemas } from "./lint-schema-parity.mjs";

const sqliteHeader = `generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}
`;

const postgresHeader = `generator client {
  provider = "prisma-client"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
`;

const sessionWithCoaching = `model Session {
  id        String   @id @default(cuid())
  title     String
  prompt    String?
  model     String?
  userId    String
}
`;

const sessionWithoutCoaching = `model Session {
  id        String   @id @default(cuid())
  title     String
  userId    String
}
`;

const appSetting = `model AppSetting {
  key       String   @id
  value     String
}
`;

describe("parseModels", () => {
  it("extracts model and field names, ignoring datasource/generator blocks", () => {
    const models = parseModels(sqliteHeader + sessionWithCoaching);
    expect([...models.keys()]).toEqual(["Session"]);
    expect([...(models.get("Session") ?? new Map()).keys()]).toEqual([
      "id",
      "title",
      "prompt",
      "model",
      "userId",
    ]);
  });

  it("skips block-level attributes like @@unique", () => {
    const withBlockAttr = `model Account {
  id       String @id
  provider String
  @@unique([provider, id])
}
`;
    const models = parseModels(withBlockAttr);
    expect([...(models.get("Account") ?? new Map()).keys()]).toEqual(["id", "provider"]);
  });
});

describe("diffSchemas", () => {
  it("passes when both schemas define the same models and fields", () => {
    const a = parseModels(sqliteHeader + sessionWithCoaching);
    const b = parseModels(postgresHeader + sessionWithCoaching);
    expect(diffSchemas(a, b, "sqlite", "postgres")).toEqual([]);
  });

  it("fails and names the field when a field exists on one model only", () => {
    const a = parseModels(sqliteHeader + sessionWithCoaching);
    const b = parseModels(postgresHeader + sessionWithoutCoaching);
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations.some((v) => v.includes("prompt"))).toBe(true);
    expect(violations.some((v) => v.includes("model"))).toBe(true);
    expect(violations.every((v) => v.includes("Session"))).toBe(true);
  });

  it("fails and names the model when a model exists in one schema only", () => {
    const a = parseModels(sqliteHeader + sessionWithCoaching);
    const b = parseModels(postgresHeader + sessionWithCoaching + appSetting);
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("AppSetting");
  });

  it("fails when a shared field has a different type across schemas", () => {
    const a = parseModels(`model Session {
  id    String @id
  count Int
}
`);
    const b = parseModels(`model Session {
  id    String @id
  count String
}
`);
    const violations = diffSchemas(a, b, "sqlite", "postgres");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("count");
  });
});

describe("committed schemas", () => {
  it("the real SQLite and Postgres schemas are at parity", () => {
    const repoRoot = join(__dirname, "..");
    const sqlite = parseModels(
      readFileSync(join(repoRoot, "prisma", "schema.prisma"), "utf8")
    );
    const postgres = parseModels(
      readFileSync(join(repoRoot, "prisma", "postgres", "schema.prisma"), "utf8")
    );
    expect(diffSchemas(sqlite, postgres, "sqlite", "postgres")).toEqual([]);
  });
});
