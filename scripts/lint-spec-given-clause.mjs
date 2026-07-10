#!/usr/bin/env node
// GIVEN-clause lint gate.
//
// Every `#### Scenario:` in an OpenSpec spec MUST contain at least one
// `- **GIVEN**` clause describing its initial state, somewhere in the
// scenario's bullet lines before the next `#### Scenario:`, `### Requirement:`,
// or `## ` boundary. This gate scans both the archived baseline
// (`openspec/specs/**`) and unarchived change deltas
// (`openspec/changes/*/specs/**`), so a missing precondition is caught while a
// change is being proposed — not after it is archived.
//
// It is a sibling of the traceability gate (`lint-spec-traceability.mjs`):
// pure filesystem, no network, offline-safe. See
// openspec/changes/require-given-clauses.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCENARIO_RE = /^####\s+Scenario:\s*(.*)$/;
const GIVEN_RE = /^\s*[-*]\s*\*\*GIVEN\*\*/;
// A scenario "owns" every line until the next scenario, requirement, or
// top-level heading (or EOF). These end its scan window.
const BOUNDARY_RE = /^(####\s+Scenario:|###\s+Requirement:|##\s+)/;

/**
 * Recursively collect every `.md` file under `dir`. Returns [] if `dir` does
 * not exist (an empty baseline or a change with no specs is not an error).
 * @param {string} dir
 * @returns {string[]}
 */
export function collectMarkdownFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Collect all spec files that the gate must scan under `openspecRoot`:
 * the archived baseline plus every unarchived change delta.
 * @param {string} openspecRoot
 * @returns {string[]}
 */
export function collectSpecFiles(openspecRoot) {
  const files = [...collectMarkdownFiles(join(openspecRoot, "specs"))];

  const changesDir = join(openspecRoot, "changes");
  let changes;
  try {
    changes = readdirSync(changesDir, { withFileTypes: true });
  } catch {
    changes = [];
  }
  for (const change of changes) {
    if (!change.isDirectory()) continue;
    files.push(...collectMarkdownFiles(join(changesDir, change.name, "specs")));
  }
  return files;
}

/**
 * Find scenarios in a single spec's content that lack a `- **GIVEN**` clause
 * within their scan window (from the `#### Scenario:` heading to the next
 * scenario/requirement/top-level heading or EOF). Returns one violation per
 * offending scenario.
 * @param {string} content
 * @param {string} [file]
 * @returns {{ file: string, line: number, scenario: string }[]}
 */
export function findViolations(content, file = "<memory>") {
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const match = SCENARIO_RE.exec(lines[i]);
    if (!match) continue;

    const scenario = match[1].trim() || "(untitled)";

    // Scan the scenario's window for any GIVEN bullet, stopping at the next
    // scenario/requirement/top-level heading.
    let hasGiven = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (BOUNDARY_RE.test(lines[j])) break;
      if (GIVEN_RE.test(lines[j])) {
        hasGiven = true;
        break;
      }
    }

    if (!hasGiven) {
      violations.push({ file, line: i + 1, scenario });
    }
  }

  return violations;
}

/**
 * Scan the given spec files and return every violation across all of them.
 * @param {string[]} files
 * @returns {{ file: string, line: number, scenario: string }[]}
 */
export function lintFiles(files) {
  const violations = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    violations.push(...findViolations(content, file));
  }
  return violations;
}

/** CLI entry point. Exits non-zero when any scenario lacks a GIVEN clause. */
function main() {
  const openspecRoot = join(process.cwd(), "openspec");
  const files = collectSpecFiles(openspecRoot);
  const violations = lintFiles(files);

  if (violations.length === 0) {
    console.log(
      `✓ spec given-clause: ${files.length} spec file(s) scanned, every scenario declares a GIVEN precondition`
    );
    return;
  }

  console.error(
    `✗ spec given-clause: ${violations.length} scenario(s) missing a '- **GIVEN**' clause:\n`
  );
  for (const v of violations) {
    console.error(`  ${relative(process.cwd(), v.file)}:${v.line}  Scenario: ${v.scenario}`);
  }
  console.error(
    `\nEvery '#### Scenario:' must contain a '- **GIVEN**' clause describing its ` +
      `initial state, before the next scenario/requirement/heading boundary.`
  );
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
