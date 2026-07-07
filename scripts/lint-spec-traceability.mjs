#!/usr/bin/env node
// Traceability lint gate.
//
// Every `#### Scenario:` in an OpenSpec spec MUST be immediately followed by a
// `> **Tests:**` line citing the e2e/unit spec(s) that exercise it, or the
// literal word `none` when no test exists yet. This gate scans both the
// archived baseline (`openspec/specs/**`) and unarchived change deltas
// (`openspec/changes/*/specs/**`), so a missing link is caught while a change
// is being proposed — not after it is archived.
//
// See openspec/changes/adopt-openspec-with-test-traceability.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCENARIO_RE = /^####\s+Scenario:\s*(.*)$/;
const TESTS_RE = /^>\s*\*\*Tests:\*\*/;

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
 * Find scenarios in a single spec's content that lack a `> **Tests:**` line as
 * their first non-empty line. Returns one violation per offending scenario.
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

    // The first non-empty line after the heading must be the tests line.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;

    if (j >= lines.length || !TESTS_RE.test(lines[j])) {
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

/** CLI entry point. Exits non-zero when any scenario lacks a tests line. */
function main() {
  const openspecRoot = join(process.cwd(), "openspec");
  const files = collectSpecFiles(openspecRoot);
  const violations = lintFiles(files);

  if (violations.length === 0) {
    console.log(
      `✓ spec traceability: ${files.length} spec file(s) scanned, every scenario declares its tests`
    );
    return;
  }

  console.error(
    `✗ spec traceability: ${violations.length} scenario(s) missing a '> **Tests:**' line:\n`
  );
  for (const v of violations) {
    console.error(`  ${relative(process.cwd(), v.file)}:${v.line}  Scenario: ${v.scenario}`);
  }
  console.error(
    `\nEvery '#### Scenario:' must be immediately followed by a '> **Tests:**' line ` +
      `citing the test(s), or '> **Tests:** none' when untested.`
  );
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
