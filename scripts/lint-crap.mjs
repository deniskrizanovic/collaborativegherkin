#!/usr/bin/env node
// CRAP (Change Risk Anti-Patterns) gate for application code under src/.
//
// Every function is scored as `comp² × (1 − cov)³ + comp`, where `comp` is its
// cyclomatic complexity and `cov` is its unit-test coverage from 0 to 1. Any
// function scoring above 30 fails the gate. There is no allowlist, baseline
// or suppression comment: lower a score by adding tests or simplifying code.
//
// Complexity comes from `@babel/parser`, the parser istanbul instruments with,
// so function spans line up with coverage locations: 1 plus each `if`, `?:`,
// `for`, `for…in`, `for…of`, `while`, `do…while`, `case` (not `default`),
// `catch`, `&&`, `||` and `??` in the function's body. Nested functions are
// scored on their own and do not add to their parent. Coverage comes from a
// Vitest unit-suite run under `@vitest/coverage-istanbul` (configured on the
// command line, so `pnpm test` is unchanged): the share of branch arms inside
// the function that ran, or the share of statements when it has no branches.
// A file no unit test loads is 0% covered. E2e runs contribute nothing.
//
// Runs the whole unit suite under coverage, so it is in `test:all` and CI but
// not the husky pre-commit hook. Exit 0 = pass, 1 = offenders, 2 = an unknown
// option, a `--file` path matching no scored file, a Vitest run that failed
// or produced no coverage, or a source file that does not parse.
//
// Options (`test:all` and CI pass none):
//   --all          list every scored function, worst first, not just offenders
//   --file <path>  limit the report and exit code to that file or directory
//
// See openspec/changes/add-crap-metric-gate (design D1–D5),
// openspec/changes/retro-tooling-gates and
// openspec/changes/decouple-crap-from-ts-api.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as parseNodeArgs } from "node:util";
import { parse } from "@babel/parser";

export const CRAP_THRESHOLD = 30;

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const EXCLUDED_FILE_RE = /\.(test|spec)\.[^/]+$|\.d\.ts$/;
const COVERAGE_DIR = "coverage/crap";

const DECISION_TYPES = new Set([
  "IfStatement",
  "ConditionalExpression",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause",
  // `&&`, `||` and `??`: the only LogicalExpression operators.
  "LogicalExpression",
]);
// Overload signatures, `declare` functions and abstract methods parse as
// TSDeclareFunction / TSDeclareMethod, so they are not in this set.
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassMethod",
  "ClassPrivateMethod",
  "ObjectMethod",
]);
// An anonymous function directly under one of these takes its `id` or `key`.
const NAMING_PARENT_TYPES = new Set([
  "VariableDeclarator",
  "ObjectProperty",
  "ClassProperty",
  "ClassPrivateProperty",
  "ClassAccessorProperty",
]);

/** A source file Babel could not parse, located at `file:line:column`. */
class SourceParseError extends Error {
  constructor(err, file) {
    // Babel appends ` (line:column)` to its message; the report adds its own.
    super(err.message.replace(/ \(\d+:\d+\)$/, ""), { cause: err });
    this.file = file;
    this.line = err.loc?.line;
    this.column = err.loc?.column;
  }
}

/** A function-like node with a body. */
function isScoredFunction(node) {
  return FUNCTION_TYPES.has(node.type) && node.body != null;
}

function isDecisionPoint(node) {
  // A `default` clause has `test: null`.
  if (node.type === "SwitchCase") return node.test !== null;
  return DECISION_TYPES.has(node.type);
}

/** Call `visit(child, node)` for every AST node held directly by `node`. */
function forEachChild(node, visit) {
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "extra" || /comments$/i.test(key)) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child.type === "string") visit(child, node);
    }
  }
}

/**
 * The name of `owner`'s `id` or `key` as written, `[...]` for a computed key.
 * An Identifier's span also covers its type annotation, so use its name.
 */
function keyText(owner, content) {
  const key = owner.id ?? owner.key;
  if (!key) return undefined;
  const text = key.type === "Identifier" ? key.name : content.slice(key.start, key.end);
  return owner.computed ? `[${text}]` : text;
}

/** The declaration name, method/property key or assigned variable, else `<anonymous>`. */
function functionName(node, parent, content) {
  if (node.kind === "constructor") return "constructor";
  const own = keyText(node, content);
  if (own) return own;
  const named = NAMING_PARENT_TYPES.has(parent?.type) ? keyText(parent, content) : undefined;
  return named ?? "<anonymous>";
}

/** Count decision points under `node`, not descending into nested functions. */
function countDecisions(node) {
  let count = 0;
  const visit = (child) => {
    if (isScoredFunction(child)) return;
    if (isDecisionPoint(child)) count++;
    forEachChild(child, visit);
  };
  forEachChild(node, visit);
  return count;
}

/**
 * Recursively collect the files the gate scores: `.ts` and `.tsx` under
 * `root/src/`, minus tests and `*.d.ts`.
 * @param {string} root
 * @returns {string[]}
 */
export function collectSourceFiles(root) {
  const walk = (dir) => {
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
        files.push(...walk(full));
      } else if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) &&
        !EXCLUDED_FILE_RE.test(entry.name)
      ) {
        files.push(full);
      }
    }
    return files;
  };
  return walk(join(root, "src"));
}

/**
 * Find every function in a source file with its name, span and complexity.
 * Throws a `SourceParseError` carrying `file`, `line` and `column` when the
 * file does not parse.
 * @param {string} content
 * @param {string} [file]
 * @returns {{ file: string, name: string, line: number, start: {line: number, column: number}, end: {line: number, column: number}, complexity: number }[]}
 */
export function measureFunctions(content, file = "<memory>") {
  const plugins = ["typescript", "decorators", "decoratorAutoAccessors"];
  if (file.endsWith(".tsx")) plugins.push("jsx");
  let ast;
  try {
    ast = parse(content, { sourceType: "module", plugins });
  } catch (err) {
    throw new SourceParseError(err, file);
  }
  const functions = [];
  const visit = (node, parent) => {
    if (isScoredFunction(node)) {
      const { start, end } = node.loc;
      functions.push({
        file,
        name: functionName(node, parent, content),
        line: start.line,
        start: { line: start.line, column: start.column },
        end: { line: end.line, column: end.column },
        complexity: 1 + countDecisions(node),
      });
    }
    forEachChild(node, visit);
  };
  visit(ast.program, ast);
  return functions;
}

/**
 * The report for a source file that does not parse: exit 2, no scores.
 * @param {{ file: string, line: number, column: number, message: string }} err
 * @param {string} cwd the file path is shown relative to this
 * @returns {{ exitCode: number, output: string }}
 */
export function parseFailureReport(err, cwd) {
  const where = `${relative(cwd, err.file)}:${err.line}:${err.column}`;
  return { exitCode: 2, output: `✗ crap: cannot parse ${where} — ${err.message}` };
}

function isBefore(a, b) {
  return a.line < b.line || (a.line === b.line && a.column <= b.column);
}

/** Index of the innermost function whose span contains `pos`, or -1. */
function innermostAt(functions, pos) {
  let best = -1;
  if (!pos || typeof pos.line !== "number") return best;
  functions.forEach((fn, i) => {
    if (
      isBefore(fn.start, pos) &&
      isBefore(pos, fn.end) &&
      (best < 0 || isBefore(functions[best].start, fn.start))
    ) {
      best = i;
    }
  });
  return best;
}

/**
 * Score every function in `sources` against an istanbul coverage map keyed by
 * file path (the shape of `coverage-final.json`).
 * @param {{ file: string, content: string }[]} sources
 * @param {Record<string, any>} coverageMap
 * @returns {{ file: string, name: string, line: number, complexity: number, coverage: number, score: number }[]}
 */
export function scoreFunctions(sources, coverageMap) {
  const scored = [];
  for (const { file, content } of sources) {
    const functions = measureFunctions(content, file);
    const tally = functions.map(() => ({ arms: 0, armsHit: 0, statements: 0, statementsHit: 0 }));
    const data = coverageMap[file];

    if (data) {
      for (const [id, branch] of Object.entries(data.branchMap ?? {})) {
        // All arms of a branch belong to the decision point at `loc`. Arm
        // locations can be empty (e.g. the implicit `else` of an `if`).
        const at = innermostAt(functions, branch.loc?.start ?? branch.locations?.[0]?.start);
        if (at < 0) continue;
        for (const hits of data.b?.[id] ?? []) {
          tally[at].arms++;
          if (hits > 0) tally[at].armsHit++;
        }
      }
      for (const [id, statement] of Object.entries(data.statementMap ?? {})) {
        const at = innermostAt(functions, statement.start);
        if (at < 0) continue;
        tally[at].statements++;
        if ((data.s?.[id] ?? 0) > 0) tally[at].statementsHit++;
      }
    }

    functions.forEach((fn, i) => {
      const t = tally[i];
      let coverage = 0;
      if (t.arms > 0) coverage = t.armsHit / t.arms;
      else if (t.statements > 0) coverage = t.statementsHit / t.statements;
      const score = fn.complexity ** 2 * (1 - coverage) ** 3 + fn.complexity;
      scored.push({
        file,
        name: fn.name,
        line: fn.line,
        complexity: fn.complexity,
        coverage,
        score,
      });
    });
  }
  return scored;
}

/**
 * Parse the gate's command-line options. Throws on an unknown option.
 * @param {string[]} argv
 * @returns {{ all: boolean, file: string | undefined }}
 */
export function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    strict: true,
    options: { all: { type: "boolean", default: false }, file: { type: "string" } },
  });
  return { all: values.all, file: values.file };
}

/**
 * Keep the functions in `path` (relative to `cwd`), or in files under it.
 * @template {{ file: string }} T
 * @param {T[]} scored
 * @param {string} path
 * @param {string} cwd
 * @returns {T[]}
 */
export function filterByPath(scored, path, cwd) {
  const target = relative(cwd, resolve(cwd, path));
  // `.` (or cwd itself) resolves to "", which covers every file.
  if (target === "") return scored;
  return scored.filter((fn) => {
    const file = relative(cwd, fn.file);
    return file === target || file.startsWith(`${target}/`);
  });
}

/**
 * Apply the `--file` and `--all` options, then build the report. A `--file`
 * path matching no scored function is exit 2.
 * @param {{ file: string, name: string, line: number, complexity: number, coverage: number, score: number }[]} scored
 * @param {string} cwd
 * @param {{ all?: boolean, file?: string }} [options]
 * @returns {{ exitCode: number, output: string }}
 */
export function reportFor(scored, cwd, { all = false, file } = {}) {
  if (file === undefined) return buildReport(scored, cwd, { all });
  const inPath = filterByPath(scored, file, cwd);
  if (inPath.length === 0) {
    return { exitCode: 2, output: `✗ crap: no scored file matches --file ${file}.` };
  }
  return buildReport(inPath, cwd, { all });
}

/**
 * Turn scored functions into the gate's output and exit code.
 * @param {{ file: string, name: string, line: number, complexity: number, coverage: number, score: number }[]} scored
 * @param {string} cwd file paths are shown relative to this
 * @param {{ all?: boolean }} [options] `all` lists every function, not just offenders
 * @returns {{ exitCode: number, output: string }}
 */
export function buildReport(scored, cwd, { all = false } = {}) {
  const where = (fn) => `${relative(cwd, fn.file)}:${fn.line}`;
  const worstFirst = [...scored].sort((a, b) => b.score - a.score);
  const offenders = worstFirst.filter((fn) => fn.score > CRAP_THRESHOLD);
  const exitCode = offenders.length === 0 ? 0 : 1;

  if (exitCode === 0 && !all) {
    const worst = worstFirst[0];
    const tail = worst ? `, worst ${worst.score.toFixed(1)} (${worst.name} ${where(worst)})` : "";
    return { exitCode, output: `✓ crap: ${scored.length} function(s) scored${tail}` };
  }

  const rows = (all ? worstFirst : offenders).map(
    (fn) =>
      `  ${fn.score.toFixed(1).padStart(7)}  ${String(fn.complexity).padStart(4)}  ` +
      `${`${Math.round(fn.coverage * 100)}%`.padStart(4)}  ${fn.name}  ${where(fn)}`,
  );
  const heading = all
    ? `${exitCode === 0 ? "✓" : "✗"} crap: ${scored.length} function(s) scored, ` +
      `${offenders.length} above ${CRAP_THRESHOLD}:\n`
    : `✗ crap: ${offenders.length} function(s) score above ${CRAP_THRESHOLD}:\n`;
  const output = [
    heading,
    "    score  comp   cov  function",
    ...rows,
    `\nCRAP = comp² × (1 − cov)³ + comp, from Vitest unit coverage only. ` +
      `Lower a score by adding unit tests or simplifying the function.`,
  ].join("\n");
  return { exitCode, output };
}

/** Run the unit suite under istanbul coverage and return the coverage map. */
function runCoverage(cwd) {
  const reportsDirectory = join(cwd, COVERAGE_DIR);
  rmSync(reportsDirectory, { recursive: true, force: true });
  try {
    execFileSync(
      join(cwd, "node_modules", ".bin", "vitest"),
      [
        "run",
        "--coverage.enabled",
        "--coverage.provider=istanbul",
        "--coverage.reporter=json",
        `--coverage.reportsDirectory=${COVERAGE_DIR}`,
        "--coverage.include=src/**/*.{ts,tsx}",
        "--coverage.exclude=**/*.test.*",
        "--coverage.exclude=**/*.spec.*",
        "--coverage.exclude=**/*.d.ts",
      ],
      { cwd, encoding: "utf8", stdio: "pipe", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    console.error(`✗ crap: the Vitest coverage run failed, so nothing was scored.\n`);
    console.error(`${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || err.message);
    return null;
  }
  try {
    return JSON.parse(readFileSync(join(reportsDirectory, "coverage-final.json"), "utf8"));
  } catch (err) {
    console.error(
      `✗ crap: no coverage report at ${COVERAGE_DIR}/coverage-final.json (${err.message}).`,
    );
    return null;
  }
}

/** CLI entry point. Exits 1 when any function scores above the threshold. */
function main() {
  const cwd = process.cwd();
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✗ crap: ${err.message}\nUsage: lint-crap.mjs [--all] [--file <path>]`);
    process.exitCode = 2;
    return;
  }
  const coverageMap = runCoverage(cwd);
  if (!coverageMap) {
    process.exitCode = 2;
    return;
  }
  const sources = collectSourceFiles(cwd).map((file) => ({
    file,
    content: readFileSync(file, "utf8"),
  }));
  let scored;
  try {
    scored = scoreFunctions(sources, coverageMap);
  } catch (err) {
    if (!(err instanceof SourceParseError)) throw err;
    console.error(parseFailureReport(err, cwd).output);
    process.exitCode = 2;
    return;
  }
  const { exitCode, output } = reportFor(scored, cwd, options);
  (exitCode === 0 ? console.log : console.error)(output);
  process.exitCode = exitCode;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
