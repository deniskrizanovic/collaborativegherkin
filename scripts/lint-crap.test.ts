import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildReport,
  CRAP_THRESHOLD,
  collectSourceFiles,
  measureFunctions,
  parseArgs,
  reportFor,
  scoreFunctions,
} from "./lint-crap.mjs";

/** A function named `name` holding `ifs` single-line `if` statements (complexity ifs + 1). */
function ifChain(name: string, ifs: number): string {
  const body = Array.from({ length: ifs }, (_, i) => `  if (x === ${i}) return ${i};`);
  return [`export function ${name}(x: number) {`, ...body, "  return -1;", "}"].join("\n");
}

/**
 * Hand-build an istanbul file coverage entry for `content`: one `if` branch
 * (two arms) per line holding `if (`, and one statement per `return`. `armHits`
 * gives the hit counts of each branch's two arms, by branch index.
 */
function coverageFor(
  path: string,
  content: string,
  armHits: (branch: number) => [number, number],
  statementHits = 0,
) {
  const branchMap: Record<string, unknown> = {};
  const b: Record<string, number[]> = {};
  const statementMap: Record<string, unknown> = {};
  const s: Record<string, number> = {};
  content.split("\n").forEach((text, i) => {
    const line = i + 1;
    const col = text.indexOf("if (");
    if (col >= 0) {
      const k = String(Object.keys(branchMap).length);
      const loc = { start: { line, column: col }, end: { line, column: text.length } };
      branchMap[k] = { loc, type: "if", locations: [loc, loc], line };
      b[k] = armHits(Number(k));
    }
    const ret = text.indexOf("return");
    if (ret >= 0) {
      const k = String(Object.keys(statementMap).length);
      statementMap[k] = { start: { line, column: ret }, end: { line, column: text.length } };
      s[k] = statementHits;
    }
  });
  return { path, statementMap, s, branchMap, b, fnMap: {}, f: {} };
}

const FILE = "/repo/src/lib/example.ts";

describe("measureFunctions", () => {
  it("adds one for if, &&, and each case clause but not default", () => {
    const src = `function f(a: boolean, b: boolean, k: string) {
  if (a && b) return 0;
  switch (k) {
    case "x":
      return 1;
    case "y":
      return 2;
    default:
      return 3;
  }
}`;
    const [fn] = measureFunctions(src, "f.ts");
    expect(fn).toMatchObject({ name: "f", line: 1, complexity: 5 });
  });

  it("counts every listed decision point", () => {
    const src = `function g(xs: number[], o: Record<string, number>, a?: number) {
  for (let i = 0; i < 1; i++) {}
  for (const k in o) {}
  for (const x of xs) {}
  while (false) {}
  do {} while (false);
  try { a = a ?? 1; } catch { a = 0; }
  return a ? a || 2 : 3;
}`;
    expect(measureFunctions(src, "g.ts")[0].complexity).toBe(10);
  });

  it("measures a nested arrow callback separately from its parent", () => {
    const src = `export function outer(xs: number[]) {
  return xs.map((x) => {
    if (x > 1) return 1;
    if (x < 0) return -1;
    return 0;
  });
}`;
    const fns = measureFunctions(src, "outer.ts");
    expect(fns.map((f) => [f.name, f.complexity])).toEqual([
      ["outer", 1],
      ["<anonymous>", 3],
    ]);
  });

  it("names arrows by their variable and methods by their key, in TSX too", () => {
    const src = `const onKey = (e: KeyboardEvent) => e.key;
class C { get v() { return 1; } run() { return 2; } constructor() {} }
export const View = () => <div>{1}</div>;`;
    expect(measureFunctions(src, "v.tsx").map((f) => f.name)).toEqual([
      "onKey",
      "v",
      "run",
      "constructor",
      "View",
    ]);
  });
});

describe("scoreFunctions", () => {
  it("scores an untested complexity-6 function at 42", () => {
    const content = ifChain("risky", 5);
    const [fn] = scoreFunctions([{ file: FILE, content }], {
      [FILE]: coverageFor(FILE, content, () => [0, 0]),
    });
    expect(fn).toMatchObject({ name: "risky", complexity: 6, coverage: 0 });
    expect(fn.score).toBeCloseTo(42);
  });

  it("scores a fully covered complexity-12 function at its complexity", () => {
    const content = ifChain("covered", 11);
    const [fn] = scoreFunctions([{ file: FILE, content }], {
      [FILE]: coverageFor(FILE, content, () => [1, 3]),
    });
    expect(fn).toMatchObject({ complexity: 12, coverage: 1 });
    expect(fn.score).toBeCloseTo(12);
  });

  it("scores a complexity-10 function with half its branch arms covered at 22.5", () => {
    const content = ifChain("half", 9);
    const [fn] = scoreFunctions([{ file: FILE, content }], {
      [FILE]: coverageFor(FILE, content, () => [1, 0]),
    });
    expect(fn).toMatchObject({ complexity: 10, coverage: 0.5 });
    expect(fn.score).toBeCloseTo(22.5);
  });

  it("gives 0% coverage to every function in a file missing from the coverage map", () => {
    const content = `${ifChain("a", 2)}\n${ifChain("b", 0)}`;
    const fns = scoreFunctions([{ file: FILE, content }], {});
    expect(fns.map((f) => f.coverage)).toEqual([0, 0]);
  });

  it("uses statement coverage for a function with no branch arms", () => {
    const content = ifChain("flat", 0);
    const [fn] = scoreFunctions([{ file: FILE, content }], {
      [FILE]: coverageFor(FILE, content, () => [0, 0], 1),
    });
    expect(fn.coverage).toBe(1);
  });

  it("leaves a nested function's branch arms out of its parent's coverage", () => {
    const content = `export function outer(xs: number[]) {
  if (xs.length) return xs.map((x) => {
    if (x) return 1;
    return 0;
  });
  return [];
}`;
    // outer's `if` is covered on both arms; the nested arrow's `if` never runs.
    const coverage = coverageFor(FILE, content, (k) => (k === 0 ? [1, 1] : [0, 0]));
    const fns = scoreFunctions([{ file: FILE, content }], { [FILE]: coverage });
    expect(fns.map((f) => [f.name, f.coverage])).toEqual([
      ["outer", 1],
      ["<anonymous>", 0],
    ]);
  });
});

describe("collectSourceFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lint-crap-"));
    const files = [
      "src/lib/session.ts",
      "src/app/View.tsx",
      "src/lib/session.test.ts",
      "src/app/View.spec.tsx",
      "src/types/declarations.d.ts",
      "src/generated/prisma/client.ts",
      "src/app/globals.css",
      "scripts/tool.ts",
    ];
    for (const f of files) {
      mkdirSync(join(root, f, ".."), { recursive: true });
      writeFileSync(join(root, f), ifChain("complex", 10));
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("collects .ts and .tsx under src/, skipping tests, declarations, generated code and scripts/", () => {
    const rel = collectSourceFiles(root)
      .map((f: string) => f.slice(root.length + 1))
      .sort();
    expect(rel).toEqual(["src/app/View.tsx", "src/lib/session.ts"]);
  });
});

describe("buildReport", () => {
  const scored = (name: string, complexity: number, coverage: number, line = 1) => ({
    file: "/repo/src/components/useGherkinKeyboard.ts",
    name,
    line,
    complexity,
    coverage,
    score: complexity ** 2 * (1 - coverage) ** 3 + complexity,
  });

  it("fails on one offender and lists its file, line, name, complexity, coverage and score", () => {
    const { exitCode, output } = buildReport(
      [scored("helper", 3, 1), scored("handleKey", 6, 0, 12)],
      "/repo",
    );
    expect(exitCode).toBe(1);
    const row = output.split("\n").find((l: string) => l.includes("handleKey"));
    expect(row).toMatch(/42\.0\s+6\s+0%\s+handleKey\s+src\/components\/useGherkinKeyboard\.ts:12/);
    expect(output).not.toContain("helper");
  });

  it("lists offenders worst first", () => {
    const { output } = buildReport([scored("mild", 6, 0), scored("worse", 8, 0)], "/repo");
    expect(output.indexOf("worse")).toBeLessThan(output.indexOf("mild"));
  });

  it("passes when the worst function scores exactly 30", () => {
    expect(CRAP_THRESHOLD).toBe(30);
    const { exitCode, output } = buildReport([scored("edge", 5, 0)], "/repo");
    expect(exitCode).toBe(0);
    expect(output).toMatch(
      /^✓ crap: 1 function\(s\) scored, worst 30\.0 \(edge src\/components\/useGherkinKeyboard\.ts:1\)/,
    );
  });

  it("still fails an offender with a comment asking to skip the CRAP check", () => {
    const content = `// crap-ignore: skip the CRAP check for this function\n${ifChain("handleKey", 5)}`;
    const fns = scoreFunctions([{ file: FILE, content }], {});
    const { exitCode, output } = buildReport(fns, "/repo");
    expect(exitCode).toBe(1);
    expect(output).toContain("handleKey");
  });
});

describe("buildReport with all", () => {
  const scored = (name: string, complexity: number, coverage: number, line = 1) => ({
    file: "/repo/src/lib/example.ts",
    name,
    line,
    complexity,
    coverage,
    score: complexity ** 2 * (1 - coverage) ** 3 + complexity,
  });

  it("lists every function when every score passes, and exits zero", () => {
    const { exitCode, output } = buildReport([scored("tidy", 12, 1, 7)], "/repo", { all: true });
    expect(exitCode).toBe(0);
    expect(output).toMatch(/^✓ crap: 1 function\(s\) scored/);
    const row = output.split("\n").find((l: string) => l.includes("tidy"));
    expect(row).toMatch(/12\.0\s+12\s+100%\s+tidy\s+src\/lib\/example\.ts:7/);
  });

  it("lists an offender above a passing function, and exits non-zero", () => {
    const { exitCode, output } = buildReport(
      [scored("tidy", 12, 1), scored("risky", 6, 0)],
      "/repo",
      { all: true },
    );
    expect(exitCode).toBe(1);
    expect(output).toMatch(/^✗ crap: 2 function\(s\) scored, 1 above 30/);
    expect(output).toMatch(/42\.0\s+6\s+0%\s+risky/);
    expect(output.indexOf("risky")).toBeLessThan(output.indexOf("tidy"));
  });
});

describe("reportFor with file", () => {
  const at = (file: string, complexity: number, coverage: number) => ({
    file: `/repo/${file}`,
    name: file.split("/").pop()?.replace(".ts", "") ?? "",
    line: 1,
    complexity,
    coverage,
    score: complexity ** 2 * (1 - coverage) ** 3 + complexity,
  });
  const tree = [at("src/lib/a.ts", 6, 0), at("src/lib/b.ts", 12, 1), at("src/library/c.ts", 6, 0)];

  it("ignores an offender outside a file path, so the run passes", () => {
    const { exitCode, output } = reportFor(tree, "/repo", { file: "src/lib/b.ts" });
    expect(exitCode).toBe(0);
    expect(output).not.toContain("src/lib/a.ts");
  });

  it("covers the files under a directory path, and only those", () => {
    const { exitCode, output } = reportFor(tree, "/repo", { file: "src/lib/" });
    expect(exitCode).toBe(1);
    expect(output).toContain("src/lib/a.ts:1");
    expect(output).not.toContain("src/library/c.ts");
  });

  it("reports that no scored file matches the path, and exits 2", () => {
    expect(reportFor(tree, "/repo", { file: "src/missing" })).toEqual({
      exitCode: 2,
      output: "✗ crap: no scored file matches --file src/missing.",
    });
  });

  it("covers every file for the working directory itself", () => {
    const { output } = reportFor(tree, "/repo", { file: ".", all: true });
    expect(output).toMatch(/^✗ crap: 3 function\(s\) scored/);
  });
});

describe("parseArgs", () => {
  it("defaults to the offender report over the whole tree", () => {
    expect(parseArgs([])).toEqual({ all: false, file: undefined });
  });

  it("reads --all", () => {
    expect(parseArgs(["--all"])).toEqual({ all: true, file: undefined });
  });

  it("reads --file <path>", () => {
    expect(parseArgs(["--file", "src/lib"])).toEqual({ all: false, file: "src/lib" });
  });

  it("reads --all and --file together", () => {
    expect(parseArgs(["--file", "src/lib", "--all"])).toEqual({ all: true, file: "src/lib" });
  });

  it("rejects an unknown option", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/bogus/);
  });
});
