// Guards the Biome formatter contract in openspec code-formatting spec:
// house style, import sorting, no linting, file scope, and the wiring into
// lint-staged, test:all and CI. Runs the real Biome binary as a child process
// (spawnSync, no shell, no vi.mock) against the repo's biome.json.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = resolve(__dirname, "..");
const BIOME = join(ROOT, "node_modules", ".bin", "biome");
const CONFIG = join(ROOT, "biome.json");

/**
 * Run Biome with `args`. Returns the exit code, stdout (formatted source in
 * stdin mode) and stderr (diagnostics and the "Checked N files" summary).
 */
function biome(args: string[], { cwd = ROOT, input }: { cwd?: string; input?: string } = {}) {
  const result = spawnSync(BIOME, args, { cwd, input, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Format TypeScript source from stdin as if it lived at `src/x.ts`. */
function format(source: string) {
  return biome(["format", "--stdin-file-path=src/x.ts"], { input: source });
}

/** Run format + assists (import sorting) with fixes on stdin source. */
function checkWrite(source: string) {
  return biome(["check", "--write", "--stdin-file-path=src/x.ts"], { input: source });
}

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("Biome formatter config", () => {
  it("Biome reports no lint diagnostics", () => {
    // Biome's stdin mode bypasses file scope and lint reporting, so check a
    // real file. It lives outside the repo so `eslint .` running in parallel
    // under test:all never sees it; VCS is off because the file is outside
    // the Git root.
    const dir = mkdtempSync(join(tmpdir(), "biome-config-test-"));
    try {
      writeFileSync(
        join(dir, "unused.ts"),
        "export function f() {\n  const unused = 1;\n  return 2;\n}\n",
      );
      const args = ["check", `--config-path=${CONFIG}`, "--vcs-enabled=false", "unused.ts"];
      const result = biome(args, { cwd: dir });
      const output = result.stdout + result.stderr;
      expect(output).not.toMatch(/lint\//);
      expect(output).toMatch(/Checked 1 file/);
      expect(result.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("devDependency pinned without a range", () => {
    expect(packageJson.devDependencies["@biomejs/biome"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("formats to house style", () => {
    const result = format(
      "function greet(name: string) {\n\tconst msg = 'hi ' + name\n\treturn msg\n}\n",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'function greet(name: string) {\n  const msg = "hi " + name;\n  return msg;\n}\n',
    );
  });

  it("sorts imports", () => {
    const result = checkWrite(
      'import { b } from "b";\nimport { a } from "a";\n\nexport const c = a + b;\n',
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'import { a } from "a";\nimport { b } from "b";\n\nexport const c = a + b;\n',
    );
  });

  it("leaves house-style source unchanged", () => {
    const source = [
      'import { describe, expect, it } from "vitest";',
      'import { canFollow } from "./gherkin";',
      "",
      "const steps = [",
      '  { keyword: "Given", text: "a signed-in user with a session open in the collaborative editor" },',
      '  { keyword: "When", text: "they add a step" },',
      "];",
      "",
      'describe("steps", () => {',
      '  it("follows", () => {',
      "    expect(steps.every((step, i) => i === 0 || canFollow(steps[i - 1], step))).toBe(true);",
      "  });",
      "});",
      "",
    ].join("\n");
    const result = checkWrite(source);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(source);
  });

  it("ignores Markdown and YAML", () => {
    const result = biome([
      "check",
      "--no-errors-on-unmatched",
      "openspec/specs/gherkin-editor/spec.md",
      ".github/dependabot.yml",
    ]);
    expect(result.stderr).toMatch(/Checked 0 files/);
    expect(result.status).toBe(0);
  });

  it("ignores generated client", () => {
    const result = biome(["check", "--no-errors-on-unmatched", "src/generated/prisma/client.ts"]);
    expect(result.stderr).toMatch(/Checked 0 files/);
    expect(result.status).toBe(0);
  });

  it("lint-staged runs Biome write before ESLint", () => {
    const tsTasks: string[] = packageJson["lint-staged"]["*.{ts,tsx}"];
    const biomeIndex = tsTasks.findIndex((task) => task.startsWith("biome check --write"));
    const eslintIndex = tsTasks.findIndex((task) => task.startsWith("eslint"));
    expect(biomeIndex).toBe(0);
    expect(eslintIndex).toBeGreaterThan(biomeIndex);

    const otherTasks: string[] = packageJson["lint-staged"]["*.{js,mjs,cjs,json,jsonc,css}"];
    expect(otherTasks).toEqual([expect.stringMatching(/^biome check --write/)]);
  });

  it("lint:format wired into CI and test:all", () => {
    expect(packageJson.scripts["lint:format"]).toMatch(/^biome ci --changed/);
    expect(packageJson.scripts["test:all"]).toMatch(/\blint:format\b/);
    expect(packageJson.scripts.format).toBeUndefined();

    const ci = parse(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
    const steps: { uses?: string; run?: string; with?: Record<string, unknown> }[] =
      ci.jobs.ci.steps;
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    expect(steps.some((step) => step.run?.includes("pnpm run lint:format"))).toBe(true);
  });
});
