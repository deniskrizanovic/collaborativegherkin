// Guards the oxlint contract in openspec code-linting spec: oxlint is the only
// linter, the rule set matches the former Next.js ESLint preset, any warning
// fails, suppressions use oxlint comments, generated code is out of scope, and
// the lint is wired into lint-staged, CI and test:all. Runs the real oxlint
// binary (execFileSync, no shell, no vi.mock) against fixtures in a temp dir
// outside the repo, so a parallel `pnpm lint` under test:all never sees them.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = resolve(__dirname, "..");
const OXLINT = join(ROOT, "node_modules", ".bin", "oxlint");
const CONFIG = join(ROOT, ".oxlintrc.json");

interface Diagnostic {
  code: string;
  message: string;
  severity: string;
  filename: string;
}

/**
 * Write `files` (relative path → source) into a fresh temp dir alongside a
 * copy of `.oxlintrc.json`, so override globs resolve against the fixture,
 * then run oxlint there. Returns the exit status and parsed diagnostics.
 */
function lintFixture(files: Record<string, string>, extraArgs: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "oxlint-config-test-"));
  try {
    copyFileSync(CONFIG, join(dir, ".oxlintrc.json"));
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), source);
    }
    const args = ["-c", ".oxlintrc.json", "--format", "json", "--max-warnings=0", ...extraArgs];
    let status = 0;
    let stdout: string;
    try {
      stdout = execFileSync(OXLINT, args, { cwd: dir, encoding: "utf8" });
    } catch (error) {
      const failed = error as { status: number | null; stdout: string };
      status = failed.status ?? -1;
      stdout = failed.stdout;
    }
    const diagnostics: Diagnostic[] = JSON.parse(stdout).diagnostics;
    return { status, diagnostics };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Rule name from an oxlint code such as `next(no-img-element)`. */
function ruleOf(diagnostic: Diagnostic) {
  return diagnostic.code.match(/\(([^)]+)\)$/)?.[1] ?? diagnostic.code;
}

const IMG_COMPONENT = 'export function Logo() {\n  return <img src="/logo.png" alt="Logo" />;\n}\n';

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("oxlint config", () => {
  it("no ESLint packages or config remain", () => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    expect(deps).not.toHaveProperty("eslint");
    expect(deps).not.toHaveProperty("eslint-config-next");
    expect(readdirSync(ROOT).filter((name) => name.startsWith("eslint.config."))).toEqual([]);
    expect(packageJson.scripts.lint).toMatch(/^oxlint\b/);
  });

  it("devDependency pinned without a range", () => {
    expect(packageJson.devDependencies.oxlint).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("warning-only file exits non-zero", () => {
    const result = lintFixture({ "logo.tsx": IMG_COMPONENT });
    expect(result.diagnostics.map(ruleOf)).toEqual(["no-img-element"]);
    expect(result.diagnostics[0].severity).toBe("warning");
    expect(result.status).not.toBe(0);
  });

  it("reports set-state-in-effect", () => {
    const result = lintFixture({
      "counter.tsx": [
        'import { useEffect, useState } from "react";',
        "",
        "export function Counter() {",
        "  const [count, setCount] = useState(0);",
        "  useEffect(() => {",
        "    setCount(1);",
        "  }, []);",
        "  return <p>{count}</p>;",
        "}",
        "",
      ].join("\n"),
    });
    const hit = result.diagnostics.find((d) => ruleOf(d) === "set-state-in-effect");
    expect(hit?.severity).toBe("error");
    expect(result.status).not.toBe(0);
  });

  it("unused vars honor the underscore pattern", () => {
    const result = lintFixture({
      "handler.ts": [
        "export function handle(_event: string, count: number) {",
        "  const total = 1;",
        '  return "done";',
        "}",
        "",
      ].join("\n"),
    });
    const unused = result.diagnostics.filter((d) => ruleOf(d) === "no-unused-vars");
    const messages = unused.map((d) => d.message).join("\n");
    expect(messages).toMatch(/'count'/);
    expect(messages).toMatch(/'total'/);
    expect(messages).not.toMatch(/'_event'/);
    expect(unused).toHaveLength(2);
  });

  it("no-explicit-any off in test files only", () => {
    const source = "export const widget: any = 1;\n";
    const result = lintFixture({ "widget.ts": source, "widget.test.ts": source });
    const anyHits = result.diagnostics.filter((d) => ruleOf(d) === "no-explicit-any");
    expect(anyHits.map((d) => d.filename)).toEqual(["widget.ts"]);
    expect(result.diagnostics.filter((d) => d.filename === "widget.test.ts")).toEqual([]);
  });

  it("default categories off", () => {
    const files = {
      "backdrop.tsx": [
        "export function Backdrop({ onClose }: { onClose: () => void }) {",
        "  return <div onMouseDown={onClose} />;",
        "}",
        "",
      ].join("\n"),
    };
    expect(lintFixture(files)).toEqual({ status: 0, diagnostics: [] });
    // The fixture is meaningful: with `correctness` switched on, it reports.
    const withCorrectness = lintFixture(files, ["-D", "correctness"]);
    expect(withCorrectness.diagnostics.map(ruleOf)).toContain("no-static-element-interactions");
  });

  it("oxlint-disable-next-line suppresses the named rule", () => {
    const result = lintFixture({
      "logo.tsx": [
        "export function Logo() {",
        "  return (",
        "    // oxlint-disable-next-line nextjs/no-img-element -- fixture",
        '    <img src="/logo.png" alt="Logo" />',
        "  );",
        "}",
        "",
        "export function f() {",
        "  const unused = 1;",
        "  return 2;",
        "}",
        "",
      ].join("\n"),
    });
    expect(result.diagnostics.map(ruleOf)).toEqual(["no-unused-vars"]);
  });

  it("no eslint-disable outside generated code", () => {
    // Built from parts so this file does not match its own search.
    const needle = ["eslint", "disable"].join("-");
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((path) => /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(path))
      .filter((path) => !path.startsWith("src/generated/"))
      // Tracked files deleted in the working tree are still listed until staged.
      .filter((path) => existsSync(join(ROOT, path)));
    const offenders = tracked.filter((path) =>
      readFileSync(join(ROOT, path), "utf8").includes(needle),
    );
    expect(offenders).toEqual([]);
  });

  it("ignores generated client", () => {
    const result = lintFixture({
      "src/generated/prisma/bad.ts": "export function f() {\n  const unused = 1;\n  return 2;\n}\n",
      "src/ok.ts": "export const ok = 1;\n",
    });
    expect(result.diagnostics.filter((d) => d.filename.includes("bad.ts"))).toEqual([]);
    expect(result.status).toBe(0);
  });

  it("lint wired into lint-staged, CI and test:all", () => {
    const tsTasks: string[] = packageJson["lint-staged"]["*.{ts,tsx}"];
    const biomeIndex = tsTasks.findIndex((task) => task.startsWith("biome check --write"));
    const oxlintIndex = tsTasks.indexOf("oxlint --max-warnings=0");
    expect(biomeIndex).toBe(0);
    expect(oxlintIndex).toBeGreaterThan(biomeIndex);

    expect(packageJson.scripts.lint).toBe("oxlint --max-warnings=0");
    expect(packageJson.scripts["test:all"]).toMatch(/(^|\s)lint(\s|$)/);

    const ci = parse(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
    const steps: { run?: string }[] = ci.jobs.ci.steps;
    expect(steps.some((step) => step.run === "pnpm run lint")).toBe(true);
  });
});
