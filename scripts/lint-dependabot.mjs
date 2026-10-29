#!/usr/bin/env node
// Dependabot configuration lint gate.
//
// `.github/dependabot.yml` was invalid YAML for almost four months (a stray `W`
// after `"minor"`), and GitHub reports config errors only in the Dependabot UI,
// so nobody noticed that scheduled updates had stopped being reliable. This
// gate parses the file and fails on:
//
//   - a missing file or a YAML parse error (reported with its line/column);
//   - an `ignore` entry whose `dependency-name` is not cited, in backticks, in
//     ADR 0004 — every held-back dependency must be a documented exception to
//     the latest-stable principle;
//   - an `updates[*]` entry whose `assignees` does not include the owner, so
//     every Dependabot PR reaches the owner as a participating notification;
//   - a `reviewers` key, which is no longer a documented Dependabot option.
//
// Offline-safe (pure filesystem), so it runs in `test:all`, CI, and the husky
// pre-commit hook like `lint:specs`.
//
// See openspec/changes/address-dependabot-upgrades-2026-10.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

export const OWNER = "deniskrizanovic";

/**
 * Lint a Dependabot config against ADR 0004 and return human-readable
 * violations. An empty array means the config is valid.
 *
 * `configContent` is `null` when the config file does not exist.
 *
 * @param {string | null} configContent
 * @param {string} adrContent
 * @param {{ configPath: string, adrPath: string }} paths labels used in messages
 * @returns {string[]}
 */
export function lintDependabot(configContent, adrContent, { configPath, adrPath }) {
  if (configContent === null) {
    return [`${configPath}: configuration file is missing`];
  }

  const doc = parseDocument(configContent);
  if (doc.errors.length > 0) {
    return doc.errors.map((err) => {
      const pos = err.linePos?.[0];
      const where = pos ? `line ${pos.line}, column ${pos.col}` : "unknown position";
      // `yaml` appends its own " at line L, column C:" plus a code excerpt.
      const reason = err.message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "");
      return `${configPath}: YAML parse error at ${where}: ${reason}`;
    });
  }

  const config = doc.toJS();
  const updates = config?.updates;
  if (!Array.isArray(updates)) {
    return [`${configPath}: expected an "updates" list`];
  }

  const violations = [];
  updates.forEach((entry, i) => {
    const label = `updates[${i}] (${entry?.["package-ecosystem"] ?? "unknown ecosystem"})`;

    const assignees = entry?.assignees;
    if (!Array.isArray(assignees) || !assignees.includes(OWNER)) {
      violations.push(`${configPath}: ${label} must list "${OWNER}" in "assignees"`);
    }

    if (entry && Object.hasOwn(entry, "reviewers")) {
      violations.push(
        `${configPath}: ${label} uses "reviewers", a retired Dependabot option; use "assignees" instead`
      );
    }

    for (const rule of entry?.ignore ?? []) {
      const name = rule?.["dependency-name"];
      if (typeof name !== "string") continue;
      if (!adrContent.includes(`\`${name}\``)) {
        violations.push(
          `${configPath}: ${label} ignores "${name}", which ${adrPath} does not document as an exception`
        );
      }
    }
  });

  return violations;
}

/**
 * Read a file, returning `null` when it does not exist.
 * @param {string} path
 * @returns {string | null}
 */
function readIfExists(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/** CLI entry point. Exits non-zero when the Dependabot config has violations. */
function main() {
  const repoRoot = process.cwd();
  const configPath = join(".github", "dependabot.yml");
  const adrPath = join("docs", "adr", "0004-latest-stable-dependency-principle.md");

  const config = readIfExists(join(repoRoot, configPath));
  const adr = readFileSync(join(repoRoot, adrPath), "utf8");

  const violations = lintDependabot(config, adr, { configPath, adrPath });

  if (violations.length === 0) {
    console.log(
      `✓ dependabot: ${configPath} is valid, assigned to ${OWNER}, and every ignore rule is documented in ADR 0004`
    );
    return;
  }

  console.error(`✗ dependabot: ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    `\nDependabot cannot apply a config it cannot parse. Every "ignore" entry must ` +
      `name a dependency documented, in backticks, as an ADR 0004 exception.`
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
