#!/usr/bin/env node
// Cross-engine schema-parity lint gate.
//
// The project keeps two hand-maintained Prisma schemas — `prisma/schema.prisma`
// (SQLite, dev) and `prisma/postgres/schema.prisma` (PostgreSQL, prod) — because
// Prisma does not accept `env()` for a datasource `provider`, so one file cannot
// serve both engines. That split is a drift hazard (ENG-030/031): a field added
// to one schema but not the other surfaces only at runtime in the other engine.
//
// This gate parses both files, extracts each model's field set, and fails when
// the model or field sets diverge. The ONLY sanctioned differences are the
// datasource `provider`, the generator `output` path, and engine-specific native
// attributes (`@db.*`) — everything else must match. It is a deliberately simple
// line parser scoped to the model/field shapes this repo actually uses, meant as
// a tripwire, not a full Prisma grammar. Offline-safe (pure filesystem), so it
// runs in `test:all`, CI, and the husky pre-commit hook like `lint:specs`.
//
// See openspec/changes/reconcile-prisma-schemas.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL_OPEN_RE = /^model\s+(\w+)\s*\{/;

/**
 * Parse a Prisma schema string into a map of model name -> field signature map.
 *
 * Each field signature is `name -> normalizedType`, where `normalizedType` is the
 * declared type plus its `?`/`[]` modifier. Native attributes (`@db.*`) and all
 * other attributes are ignored, so engine-specific column types do not count as
 * drift. Block-level attributes (`@@id`, `@@unique`, `@@index`) are skipped, as
 * are `datasource` and `generator` blocks (their `provider`/`output` differences
 * are sanctioned).
 *
 * @param {string} content
 * @returns {Map<string, Map<string, string>>}
 */
export function parseModels(content) {
  const models = new Map();
  const lines = content.split(/\r?\n/);

  let currentModel = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;

    if (currentModel === null) {
      const open = MODEL_OPEN_RE.exec(line);
      if (open) {
        currentModel = open[1];
        models.set(currentModel, new Map());
      }
      continue;
    }

    // Inside a model block.
    if (line === "}") {
      currentModel = null;
      continue;
    }
    // Block-level attributes (@@id, @@unique, @@index) are not fields.
    if (line.startsWith("@@")) continue;

    const tokens = line.split(/\s+/);
    const name = tokens[0];
    const type = tokens[1];
    if (!name || !type) continue;
    models.get(currentModel).set(name, type);
  }

  return models;
}

/**
 * Compare two parsed schemas and return a list of human-readable divergences.
 * An empty array means the schemas are at model/field parity.
 *
 * `labelA`/`labelB` name the two schemas in the messages (e.g. file paths).
 *
 * @param {Map<string, Map<string, string>>} a
 * @param {Map<string, Map<string, string>>} b
 * @param {string} labelA
 * @param {string} labelB
 * @returns {string[]}
 */
export function diffSchemas(a, b, labelA = "A", labelB = "B") {
  const violations = [];
  const allModels = new Set([...a.keys(), ...b.keys()]);

  for (const model of [...allModels].sort()) {
    const fieldsA = a.get(model);
    const fieldsB = b.get(model);

    if (!fieldsA) {
      violations.push(`model "${model}" exists in ${labelB} but not in ${labelA}`);
      continue;
    }
    if (!fieldsB) {
      violations.push(`model "${model}" exists in ${labelA} but not in ${labelB}`);
      continue;
    }

    const allFields = new Set([...fieldsA.keys(), ...fieldsB.keys()]);
    for (const field of [...allFields].sort()) {
      const typeA = fieldsA.get(field);
      const typeB = fieldsB.get(field);
      if (typeA === undefined) {
        violations.push(
          `model "${model}": field "${field}" exists in ${labelB} but not in ${labelA}`
        );
      } else if (typeB === undefined) {
        violations.push(
          `model "${model}": field "${field}" exists in ${labelA} but not in ${labelB}`
        );
      } else if (typeA !== typeB) {
        violations.push(
          `model "${model}": field "${field}" has type "${typeA}" in ${labelA} but "${typeB}" in ${labelB}`
        );
      }
    }
  }

  return violations;
}

/** CLI entry point. Exits non-zero when the two schemas' model/field sets diverge. */
function main() {
  const repoRoot = process.cwd();
  const sqlitePath = join(repoRoot, "prisma", "schema.prisma");
  const postgresPath = join(repoRoot, "prisma", "postgres", "schema.prisma");

  const sqlite = parseModels(readFileSync(sqlitePath, "utf8"));
  const postgres = parseModels(readFileSync(postgresPath, "utf8"));

  const violations = diffSchemas(
    sqlite,
    postgres,
    "prisma/schema.prisma (sqlite)",
    "prisma/postgres/schema.prisma (postgres)"
  );

  if (violations.length === 0) {
    console.log(
      `✓ schema parity: SQLite and PostgreSQL schemas define the same ${sqlite.size} model(s) and fields`
    );
    return;
  }

  console.error(
    `✗ schema parity: ${violations.length} divergence(s) between the SQLite and PostgreSQL Prisma schemas:\n`
  );
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    `\nThe two schemas MUST define the same models and fields. The only sanctioned ` +
      `differences are the datasource 'provider', the generator 'output' path, and ` +
      `engine-native '@db.*' attributes. Add the field/model to BOTH schemas.`
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
