#!/usr/bin/env node
// Spec-step lint for business-language Robot suites (draft).
//
// Pilot of docs/robot-framework-evaluation.md §6.7. A Robot suite opts in with
// the `bdd` tag in its `Test Tags` setting. Every test in such a suite is
// matched to the OpenSpec scenario with the same title (the test name minus
// its `SC-x.y.z:` prefix and any ` — variant` suffix), and the gate fails when:
//
//   - no scenario in `openspec/specs/**` has that title, or more than one does
//   - a test body line is not a Given/When/Then/And/But step (business-language
//     tests carry no technical keywords)
//   - a step matches none of its scenario's GIVEN/WHEN/THEN/AND/BUT lines
//   - a step matches a line of a different kind (a `Then` step against a GIVEN
//     line; `And`/`But` take the kind of the step before them, on both sides)
//   - a scenario line is not exercised by any test of that scenario
//
// Text is compared case-insensitively with backticks dropped and whitespace
// collapsed. A step may refine its spec line by appending words: `the cursor
// is inside a block on a new line after Feature` matches `the cursor is inside
// a block`. Step order is not checked. Offline-safe (pure filesystem).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SECTION_RE = /^\*{1,3}\s*([^*]+?)\s*\*{0,3}\s*$/;
const CELL_SEPARATOR_RE = /\s{2,}|\t/;
const SCENARIO_RE = /^####\s+Scenario:\s*(.*?)\s*$/;
const HEADING_RE = /^#{1,4}\s/;
const SPEC_STEP_RE = /^-\s+\*\*(GIVEN|WHEN|THEN|AND|BUT)\*\*\s+(.*?)\s*$/;
const ROBOT_STEP_RE = /^(given|when|then|and|but)\s+(.*)$/i;
const TEST_ID_RE = /^SC-[\d.]+:\s*/;
const VARIANT_SEPARATOR = " — ";

/** Normalize step text for comparison. */
export function normalizeStep(text) {
  return text.replace(/`/g, "").replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
}

/** Normalize a section name the way Robot matches it. */
function normalizeSection(name) {
  return name.toLowerCase().replace(/[\s_]/g, "");
}

/**
 * Resolve And/But to the kind of the step before them.
 * @param {{ word: string }[]} steps
 * @returns {string[]}
 */
function governingKinds(steps) {
  let current = "given";
  return steps.map(({ word }) => {
    const w = word.toLowerCase();
    if (w !== "and" && w !== "but") current = w;
    return current;
  });
}

/**
 * Collect every file under `dir` whose name ends with one of `extensions`.
 * Returns [] if `dir` does not exist.
 * @param {string} dir
 * @param {string[]} extensions
 * @returns {string[]}
 */
export function collectFiles(dir, extensions) {
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
      files.push(...collectFiles(full, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Parse the scenarios of one spec file.
 * @param {string} content
 * @param {string} [file]
 * @returns {{ title: string, file: string, line: number, steps: { word: string, kind: string, text: string, line: number }[] }[]}
 */
export function parseSpecScenarios(content, file = "<memory>") {
  const lines = content.split(/\r?\n/);
  const scenarios = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const scenario = SCENARIO_RE.exec(lines[i]);
    if (scenario) {
      current = { title: scenario[1], file, line: i + 1, steps: [] };
      scenarios.push(current);
      continue;
    }
    if (HEADING_RE.test(lines[i])) {
      current = null;
      continue;
    }
    const step = current && SPEC_STEP_RE.exec(lines[i]);
    if (step) current.steps.push({ word: step[1], text: step[2], line: i + 1 });
  }

  for (const s of scenarios) {
    const kinds = governingKinds(s.steps);
    s.steps.forEach((step, i) => (step.kind = kinds[i]));
  }
  return scenarios;
}

/**
 * Parse a Robot suite: whether it opts in with the `bdd` tag, and its tests.
 * @param {string} content
 * @param {string} [file]
 * @returns {{ bdd: boolean, tests: { name: string, file: string, line: number, steps: { word: string, kind: string, text: string, line: number }[], other: { text: string, line: number }[] }[] }}
 */
export function parseRobotSuite(content, file = "<memory>") {
  const lines = content.split(/\r?\n/);
  const tests = [];
  let section = "";
  let bdd = false;
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const header = raw.startsWith("*") && SECTION_RE.exec(raw);
    if (header) {
      section = normalizeSection(header[1]);
      current = null;
      continue;
    }

    if (section === "settings") {
      const cells = raw.trim().split(CELL_SEPARATOR_RE);
      if (normalizeSection(cells[0]) === "testtags" && cells.slice(1).includes("bdd")) bdd = true;
      continue;
    }
    if (section !== "testcases" || raw.trim() === "" || raw.trim().startsWith("#")) continue;

    if (!/^\s/.test(raw)) {
      current = { name: raw.trim(), file, line: i + 1, steps: [], other: [] };
      tests.push(current);
      continue;
    }
    if (!current) continue;

    const cell = raw.trim().split(CELL_SEPARATOR_RE)[0];
    if (cell.startsWith("[") || cell === "...") continue; // test settings, continuations
    const step = ROBOT_STEP_RE.exec(raw.trim());
    if (step) {
      current.steps.push({ word: step[1], text: step[2], line: i + 1 });
    } else {
      current.other.push({ text: raw.trim(), line: i + 1 });
    }
  }

  for (const t of tests) {
    const kinds = governingKinds(t.steps);
    t.steps.forEach((step, i) => (step.kind = kinds[i]));
  }
  return { bdd, tests };
}

/** Scenario title a test name refers to. */
export function scenarioTitleOf(testName) {
  return testName.replace(TEST_ID_RE, "").split(VARIANT_SEPARATOR)[0].trim();
}

/** True when a test step states, or refines, a spec line. */
function stepMatches(testText, specText) {
  const t = normalizeStep(testText);
  const s = normalizeStep(specText);
  return t === s || t.startsWith(`${s} `);
}

/**
 * Check every test of every `bdd` suite against its spec scenario.
 * @param {{ file: string, content: string }[]} specs
 * @param {{ file: string, content: string }[]} suites
 * @returns {{ file: string, line: number, message: string }[]}
 */
export function lintSpecSteps(specs, suites) {
  const byTitle = new Map();
  for (const { file, content } of specs) {
    for (const scenario of parseSpecScenarios(content, file)) {
      const key = normalizeStep(scenario.title);
      byTitle.set(key, [...(byTitle.get(key) ?? []), scenario]);
    }
  }

  const violations = [];
  const covered = new Map(); // scenario -> Set of matched step indexes

  for (const { file, content } of suites) {
    const suite = parseRobotSuite(content, file);
    if (!suite.bdd) continue;

    for (const test of suite.tests) {
      const title = scenarioTitleOf(test.name);
      const matches = byTitle.get(normalizeStep(title)) ?? [];
      if (matches.length !== 1) {
        violations.push({
          file,
          line: test.line,
          message:
            matches.length === 0
              ? `no spec scenario titled "${title}"`
              : `${matches.length} spec scenarios titled "${title}"`,
        });
        continue;
      }
      const scenario = matches[0];
      if (!covered.has(scenario)) covered.set(scenario, new Set());

      for (const other of test.other) {
        violations.push({ file, line: other.line, message: `not a Given/When/Then step: ${other.text}` });
      }
      if (test.steps.length === 0) {
        violations.push({ file, line: test.line, message: "test has no Given/When/Then steps" });
      }

      for (const step of test.steps) {
        const index = scenario.steps.findIndex((s) => stepMatches(step.text, s.text));
        if (index === -1) {
          violations.push({
            file,
            line: step.line,
            message: `step not in spec scenario "${scenario.title}" (${relative(process.cwd(), scenario.file)}:${scenario.line}): ${step.word} ${step.text}`,
          });
          continue;
        }
        const specStep = scenario.steps[index];
        if (specStep.kind !== step.kind) {
          violations.push({
            file,
            line: step.line,
            message: `step is a ${step.kind.toUpperCase()} here but a ${specStep.kind.toUpperCase()} in the spec: ${step.word} ${step.text}`,
          });
        }
        covered.get(scenario).add(index);
      }
    }
  }

  for (const [scenario, indexes] of covered) {
    scenario.steps.forEach((step, i) => {
      if (indexes.has(i)) return;
      violations.push({
        file: scenario.file,
        line: step.line,
        message: `spec step not exercised by any business-language test of "${scenario.title}": ${step.word} ${step.text}`,
      });
    });
  }

  return violations;
}

/** CLI entry point. Exits non-zero on any violation. */
function main() {
  const root = process.cwd();
  const read = (file) => ({ file, content: readFileSync(file, "utf8") });
  const specs = collectFiles(join(root, "openspec", "specs"), [".md"]).map(read);
  const suites = collectFiles(join(root, "robot", "suites"), [".robot"]).map(read);
  const bddCount = suites.filter((s) => parseRobotSuite(s.content, s.file).bdd).length;
  const violations = lintSpecSteps(specs, suites);

  if (violations.length === 0) {
    console.log(`✓ robot spec steps: ${bddCount} business-language suite(s) match their spec scenarios`);
    return;
  }

  console.error(`✗ robot spec steps: ${violations.length} problem(s):\n`);
  for (const v of violations) {
    console.error(`  ${relative(root, v.file)}:${v.line}  ${v.message}`);
  }
  console.error(
    `\nTests in a suite tagged \`bdd\` must repeat their spec scenario's GIVEN/WHEN/THEN ` +
      `lines. Change the step, or the spec, so they agree.`
  );
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
