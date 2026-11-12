#!/usr/bin/env node
// Playwright → Robot e2e parity gate.
//
// Robot (`robot/suites/`) is the e2e suite that runs on every change; the
// Playwright suite (`e2e/*.spec.ts`) stays in the repo as the reference Robot
// keeps parity with. `robot/PARITY.md` maps each Playwright test to the Robot
// test with the same name. This gate keeps the three in step, and fails when:
//
//   - a Playwright test has no `PARITY.md` row, or a row names no Playwright test
//   - a row's status is anything other than `ported` or `skip`
//   - the row's Robot suite has no test case named exactly the Playwright title
//   - the Playwright test, its row and its Robot test (`skip` tag) disagree on
//     being skipped
//   - a (spec file, title) pair appears more than once
//
// Playwright tests come from `playwright test --list --reporter=json`, not from
// parsing source, so titles built in loops are seen. `--list` starts no server
// and opens no browser, so the gate is offline-safe (needs only node_modules).
// Titles are compared byte-for-byte: no case, whitespace or dash normalisation.
//
// See openspec/changes/run-only-robot-e2e.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles, parseRobotSuite } from "./lint-robot-spec-steps.mjs";

const PARITY_FILE = "robot/PARITY.md";
const SUITES_DIR = "robot/suites";
const EXPECTED_HEADER = ["Playwright file", "Title", "Key assertions", "Robot suite", "Chunk", "Status"];
const STATUSES = new Set(["ported", "skip"]);
const TABLE_SEPARATOR_RE = /^\|(\s*:?-+:?\s*\|)+\s*$/;
const UNESCAPED_PIPE_RE = /(?<!\\)\|/;

/** Normalize a Robot tag the way Robot matches it: ignore case, spaces and underscores. */
function normalizeTag(tag) {
  return tag.toLowerCase().replace(/[\s_]/g, "");
}

/**
 * Read the tests from `playwright test --list --reporter=json` output.
 * Throws when the output lacks the expected fields or lists no tests, so a
 * reporter format change fails loudly instead of passing silently.
 * @param {string} json
 * @returns {{ file: string, title: string, skipped: boolean }[]}
 */
export function parsePlaywrightList(json) {
  const report = JSON.parse(json);
  if (!Array.isArray(report?.suites)) {
    throw new Error("Playwright --list JSON has no `suites` array");
  }

  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (typeof spec.file !== "string" || typeof spec.title !== "string") {
        throw new Error("Playwright --list JSON spec lacks a string `file` or `title`");
      }
      if (!Array.isArray(spec.tests) || spec.tests.length === 0) {
        throw new Error(`Playwright --list JSON spec "${spec.title}" has no \`tests\``);
      }
      if (spec.tests.some((t) => typeof t.expectedStatus !== "string")) {
        throw new Error(`Playwright --list JSON spec "${spec.title}" lacks \`expectedStatus\``);
      }
      tests.push({
        file: basename(spec.file),
        title: spec.title,
        skipped: spec.tests.every((t) => t.expectedStatus === "skipped"),
      });
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites) walk(suite);

  if (tests.length === 0) throw new Error("Playwright --list found no tests");
  return tests;
}

/** Split a markdown table row on unescaped pipes; `\|` becomes `|` inside a cell. */
function splitRow(line) {
  const cells = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(UNESCAPED_PIPE_RE);
  return cells.map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/**
 * Parse the parity rows of `robot/PARITY.md`: table rows whose first cell ends
 * in `.spec.ts`. Cells are read by position, so the table's header must match
 * the expected columns; a reordered table throws.
 * @param {string} content
 * @returns {{ file: string, title: string, suite: string, status: string, line: number }[]}
 */
export function parseParityTable(content) {
  const lines = content.split(/\r?\n/);
  const rows = [];
  let header = null; // header cells of the table the current line belongs to

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) {
      header = null;
      continue;
    }
    if (TABLE_SEPARATOR_RE.test(line)) {
      header = i > 0 ? splitRow(lines[i - 1]) : [];
      continue;
    }

    const cells = splitRow(line);
    if (!cells[0].endsWith(".spec.ts")) continue;
    if (!header || header.join("|") !== EXPECTED_HEADER.join("|")) {
      throw new Error(
        `${PARITY_FILE}:${i + 1}: table header must be | ${EXPECTED_HEADER.join(" | ")} |, got | ${(header ?? []).join(" | ")} |`
      );
    }
    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(`${PARITY_FILE}:${i + 1}: row has ${cells.length} cells, expected 6 cells`);
    }
    const [file, title, , suite, , status] = cells;
    rows.push({ file, title, suite, status, line: i + 1 });
  }
  return rows;
}

/** Group items by `file › title`. */
function groupByTest(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.file}\u0000${item.title}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

/**
 * Compare the Playwright tests, the `PARITY.md` rows and the Robot suites.
 * @param {{
 *   tests: { file: string, title: string, skipped: boolean }[],
 *   rows: { file: string, title: string, suite: string, status: string, line: number }[],
 *   suites: { file: string, content: string }[],
 * }} input
 * @returns {{ file: string, title: string, message: string }[]}
 */
export function lintParity({ tests, rows, suites }) {
  const errors = [];
  const fail = (file, title, message) => errors.push({ file, title, message });

  const robotTests = new Map();
  for (const { file, content } of suites) {
    robotTests.set(basename(file), parseRobotSuite(content, file).tests);
  }

  const testsByKey = groupByTest(tests);
  const rowsByKey = groupByTest(rows);

  for (const [key, group] of testsByKey) {
    const { file, title } = group[0];
    if (group.length > 1) fail(file, title, `Playwright lists this test ${group.length} times`);
    if (!rowsByKey.has(key)) fail(file, title, `Playwright test has no ${PARITY_FILE} row`);
  }

  for (const [key, group] of rowsByKey) {
    const row = group[0];
    const { file, title } = row;
    if (group.length > 1) {
      fail(file, title, `${PARITY_FILE} has ${group.length} rows for this test (lines ${group.map((r) => r.line).join(", ")})`);
    }
    const test = testsByKey.get(key)?.[0];
    if (!test) fail(file, title, `${PARITY_FILE} row (line ${row.line}) names no Playwright test`);
    if (!STATUSES.has(row.status)) {
      fail(file, title, `${PARITY_FILE} status is "${row.status}", expected "ported" or "skip"`);
    }

    const suiteTests = robotTests.get(row.suite);
    const suitePath = `${SUITES_DIR}/${row.suite}`;
    if (!suiteTests) {
      fail(file, title, `Robot suite ${suitePath} does not exist`);
      continue;
    }
    const matches = suiteTests.filter((t) => t.name === title);
    if (matches.length !== 1) {
      fail(
        file,
        title,
        matches.length === 0
          ? `Robot suite ${suitePath} has no test named exactly this title`
          : `Robot suite ${suitePath} has ${matches.length} tests named exactly this title`
      );
      continue;
    }

    if (!test || !STATUSES.has(row.status)) continue;
    const robotSkip = matches[0].tags.some((tag) => normalizeTag(tag) === "skip");
    const rowSkip = row.status === "skip";
    if (test.skipped !== rowSkip || rowSkip !== robotSkip) {
      fail(
        file,
        title,
        `skip status disagrees: Playwright ${test.skipped ? "skipped" : "runs"}, ` +
          `PARITY.md "${row.status}", Robot ${robotSkip ? "tagged skip" : "not tagged skip"}`
      );
    }
  }

  return errors;
}

/** List the Playwright tests by running `playwright test --list --reporter=json` (no shell). */
function listPlaywrightTests(root) {
  // The JSON reporter writes to a file instead of stdout when this is set.
  const env = { ...process.env };
  delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
  const result = spawnSync(join(root, "node_modules", ".bin", "playwright"), ["test", "--list", "--reporter=json"], {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`playwright test --list exited ${result.status}:\n${result.stderr}${result.stdout}`);
  }
  return parsePlaywrightList(result.stdout);
}

/** CLI entry point. Exits non-zero on any mismatch. */
function main() {
  const root = process.cwd();
  let tests, rows, suites;
  try {
    tests = listPlaywrightTests(root);
    rows = parseParityTable(readFileSync(join(root, PARITY_FILE), "utf8"));
    suites = collectFiles(join(root, SUITES_DIR), [".robot"]).map((file) => ({
      file: relative(root, file),
      content: readFileSync(file, "utf8"),
    }));
  } catch (err) {
    console.error(`✗ e2e parity: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  const errors = lintParity({ tests, rows, suites });
  if (errors.length === 0) {
    const skipped = tests.filter((t) => t.skipped).length;
    console.log(
      `✓ e2e parity: ${tests.length} Playwright test(s) (${skipped} skipped) match ${PARITY_FILE} and ${SUITES_DIR}/`
    );
    return;
  }

  console.error(`✗ e2e parity: ${errors.length} problem(s):\n`);
  for (const e of errors) {
    console.error(`  ${e.file} › ${e.title}: ${e.message}`);
  }
  console.error(
    `\nEvery Playwright test needs a ${PARITY_FILE} row and a Robot test with exactly its title. ` +
      `A change to a Playwright test must update its row and its Robot test in the same change.`
  );
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
