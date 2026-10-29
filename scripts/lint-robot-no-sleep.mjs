#!/usr/bin/env node
// No-sleep lint gate for the Robot Framework e2e suite.
//
// Robot tests MUST wait through Browser's auto-waiting assertions or explicit
// `Wait For ...` keywords, never a fixed `Sleep` (fixed sleeps are slow and
// still flaky). This gate scans every `.robot` and `.resource` file under
// `robot/suites/` and `robot/resources/` and fails on any `Sleep` keyword call.
//
// It splits each line into Robot cells (2+ spaces, a tab, or a pipe separator),
// drops comment cells, and normalizes each cell the way Robot matches keyword
// names (case-insensitive, spaces and underscores ignored, optional `BuiltIn.`
// prefix). A cell that normalizes to `sleep` is a call, so `Sleep    1s`,
// `${x}=    Sleep    1s` and `Run Keyword    Sleep    1s` all fail, while prose
// such as `Documentation    Sleep is forbidden.` does not. The `*** Comments ***`
// section is skipped. It is a tripwire, not a full Robot parser. Offline-safe
// (pure filesystem), so it runs in `test:all`, CI, and the husky pre-commit hook.
//
// See openspec/changes/add-robot-framework-e2e-suite (design D10).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SECTION_RE = /^\*{1,3}\s*([^*]+?)\s*\*{0,3}\s*$/;
const CELL_SEPARATOR_RE = /\s{2,}|\t|\s+\|\s+/;
const SLEEP_NAMES = new Set(["sleep", "builtin.sleep"]);
const ROBOT_EXTENSIONS = [".robot", ".resource"];

/** Normalize a cell the way Robot matches keyword names. */
function normalizeKeyword(cell) {
  return cell.toLowerCase().replace(/[\s_]/g, "");
}

/**
 * Recursively collect every `.robot`/`.resource` file under `dir`. Returns []
 * if `dir` does not exist.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFilesUnder(dir) {
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
      files.push(...collectFilesUnder(full));
    } else if (entry.isFile() && ROBOT_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Collect the Robot files the gate must scan under `robotRoot`: everything in
 * `suites/` and `resources/` (not `results/` or `libraries/`).
 * @param {string} robotRoot
 * @returns {string[]}
 */
export function collectRobotFiles(robotRoot) {
  return [
    ...collectFilesUnder(join(robotRoot, "suites")),
    ...collectFilesUnder(join(robotRoot, "resources")),
  ];
}

/**
 * Find every `Sleep` keyword call in a Robot file's content.
 * @param {string} content
 * @param {string} [file]
 * @returns {{ file: string, line: number, text: string }[]}
 */
export function findSleepCalls(content, file = "<memory>") {
  const lines = content.split(/\r?\n/);
  const violations = [];
  let inComments = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    const section = SECTION_RE.exec(raw);
    if (raw.startsWith("*") && section) {
      inComments = normalizeKeyword(section[1]) === "comments";
      continue;
    }
    if (inComments) continue;

    // Pipe-separated format: a leading `| ` starts the first cell.
    const body = raw.replace(/^\|\s+/, "");
    const cells = body.split(CELL_SEPARATOR_RE).map((c) => c.trim());

    for (const cell of cells) {
      if (cell.startsWith("#")) break; // the rest of the line is a comment
      if (SLEEP_NAMES.has(normalizeKeyword(cell))) {
        violations.push({ file, line: i + 1, text: raw.trim() });
        break;
      }
    }
  }

  return violations;
}

/**
 * Scan the given Robot files and return every violation across all of them.
 * @param {string[]} files
 * @returns {{ file: string, line: number, text: string }[]}
 */
export function lintFiles(files) {
  const violations = [];
  for (const file of files) {
    violations.push(...findSleepCalls(readFileSync(file, "utf8"), file));
  }
  return violations;
}

/** CLI entry point. Exits non-zero when any Robot file calls `Sleep`. */
function main() {
  const files = collectRobotFiles(join(process.cwd(), "robot"));
  const violations = lintFiles(files);

  if (violations.length === 0) {
    console.log(`✓ robot no-sleep: ${files.length} Robot file(s) scanned, no Sleep calls`);
    return;
  }

  console.error(`✗ robot no-sleep: ${violations.length} Sleep call(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${relative(process.cwd(), v.file)}:${v.line}  ${v.text}`);
  }
  console.error(
    `\nSleep is forbidden in robot/suites/** and robot/resources/**. Wait with an ` +
      `auto-waiting assertion (Get Element Count, Get Text, ...) or a Wait For keyword.`
  );
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
