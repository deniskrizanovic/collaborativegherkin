#!/usr/bin/env node
// Cross-engine schema-parity lint gate.
//
// The project keeps two hand-maintained Drizzle schema modules —
// `src/db/schema.sqlite.ts` (SQLite, dev and CI) and `src/db/schema.pg.ts`
// (PostgreSQL, prod) — because each dialect has its own table builder. That
// split is a drift hazard (ENG-030/031): a column added to one module but not
// the other surfaces only at runtime in the other engine.
//
// This gate imports both modules (Node type-stripping), reduces each table to
// its column set and nullability with `getTableConfig`, and fails when the
// table, column or nullability sets diverge. The ONLY sanctioned differences
// are the dialect column types and how a default is expressed, so neither is
// compared. Offline-safe (no database), so it runs in `test:all`, CI, and the
// husky pre-commit hook like `lint:specs`.
//
// See openspec/changes/archive/2026-11-16-replace-prisma-with-drizzle.

import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { is } from "drizzle-orm";
import { getTableConfig as getPgTableConfig, PgTable } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";

export const SQLITE_SCHEMA = join("src", "db", "schema.sqlite.ts");
export const PG_SCHEMA = join("src", "db", "schema.pg.ts");

/**
 * Reduce a schema module's exports to `table name -> column name -> { notNull }`.
 * Exports that are not tables of the given dialect are ignored.
 *
 * @param {Record<string, unknown>} schemaModule
 * @param {"sqlite" | "pg"} dialect
 * @returns {Map<string, Map<string, { notNull: boolean }>>}
 */
export function describeSchema(schemaModule, dialect) {
  const [TableClass, getTableConfig] =
    dialect === "pg" ? [PgTable, getPgTableConfig] : [SQLiteTable, getSqliteTableConfig];
  const tables = new Map();
  for (const value of Object.values(schemaModule)) {
    if (!is(value, TableClass)) continue;
    const config = getTableConfig(value);
    tables.set(
      config.name,
      new Map(config.columns.map((column) => [column.name, { notNull: column.notNull }])),
    );
  }
  return tables;
}

/**
 * Compare two described schemas and return a list of human-readable divergences.
 * An empty array means the schemas are at table/column/nullability parity.
 *
 * `labelA`/`labelB` name the two schemas in the messages (e.g. file paths).
 *
 * @param {Map<string, Map<string, { notNull: boolean }>>} a
 * @param {Map<string, Map<string, { notNull: boolean }>>} b
 * @param {string} labelA
 * @param {string} labelB
 * @returns {string[]}
 */
export function diffSchemas(a, b, labelA = "A", labelB = "B") {
  const violations = [];
  const allTables = new Set([...a.keys(), ...b.keys()]);

  for (const table of [...allTables].sort()) {
    const columnsA = a.get(table);
    const columnsB = b.get(table);

    if (!columnsA) {
      violations.push(`table "${table}" exists in ${labelB} but not in ${labelA}`);
      continue;
    }
    if (!columnsB) {
      violations.push(`table "${table}" exists in ${labelA} but not in ${labelB}`);
      continue;
    }

    const allColumns = new Set([...columnsA.keys(), ...columnsB.keys()]);
    for (const column of [...allColumns].sort()) {
      const colA = columnsA.get(column);
      const colB = columnsB.get(column);
      if (colA === undefined) {
        violations.push(
          `table "${table}": column "${column}" exists in ${labelB} but not in ${labelA}`,
        );
      } else if (colB === undefined) {
        violations.push(
          `table "${table}": column "${column}" exists in ${labelA} but not in ${labelB}`,
        );
      } else if (colA.notNull !== colB.notNull) {
        const nullability = (col) => (col.notNull ? "required" : "nullable");
        violations.push(
          `table "${table}": column "${column}" is ${nullability(colA)} in ${labelA} but ${nullability(colB)} in ${labelB}`,
        );
      }
    }
  }

  return violations;
}

/** Import and describe both committed schema modules, relative to `repoRoot`. */
export async function loadCommittedSchemas(repoRoot) {
  const load = (rel) => import(pathToFileURL(join(repoRoot, rel)).href);
  const [sqliteModule, pgModule] = await Promise.all([load(SQLITE_SCHEMA), load(PG_SCHEMA)]);
  return {
    sqlite: describeSchema(sqliteModule, "sqlite"),
    pg: describeSchema(pgModule, "pg"),
  };
}

/** CLI entry point. Exits non-zero when the two schemas' table/column sets diverge. */
async function main() {
  const { sqlite, pg } = await loadCommittedSchemas(process.cwd());

  const violations = diffSchemas(
    sqlite,
    pg,
    `${SQLITE_SCHEMA} (sqlite)`,
    `${PG_SCHEMA} (postgres)`,
  );

  if (violations.length === 0) {
    console.log(
      `✓ schema parity: SQLite and PostgreSQL schemas define the same ${sqlite.size} table(s), columns and nullability`,
    );
    return;
  }

  console.error(
    `✗ schema parity: ${violations.length} divergence(s) between the SQLite and PostgreSQL Drizzle schemas:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    `\nThe two schema modules MUST define the same tables, columns and nullability. ` +
      `The only sanctioned differences are dialect column types and how a default is ` +
      `expressed. Add the column/table to BOTH modules, then run 'pnpm db:generate'.`,
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
