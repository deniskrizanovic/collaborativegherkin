// Guards the OpenSpec validation gate in openspec spec-authoring-standards:
// main specs and active changes pass `openspec validate --all --strict`, and
// the gate is wired into pre-commit, CI and test:all. Runs the pinned openspec
// binary (spawnSync, no shell, no vi.mock) against fixture trees in a temp dir
// outside the repo, so the fixtures never join the real spec tree.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = resolve(__dirname, "..");
const OPENSPEC = join(ROOT, "node_modules", ".bin", "openspec");

const WRITTEN_PURPOSE = "Widgets greet the user, so the fixture has a Purpose someone wrote.";
const PLACEHOLDER_PURPOSE =
  "TBD - created by archiving change add-widget. Update Purpose after archive.";

/** A minimal main spec with one requirement and one scenario. */
function specSource(purpose: string, requirementText: string) {
  return [
    "# widget Specification",
    "",
    "## Purpose",
    "",
    purpose,
    "",
    "## Requirements",
    "",
    "### Requirement: Widget greets",
    "",
    requirementText,
    "",
    "#### Scenario: Greeting shown",
    "- **GIVEN** a widget",
    "- **WHEN** it renders",
    "- **THEN** it greets the user",
    "",
  ].join("\n");
}

/**
 * Write `source` as `openspec/specs/widget/spec.md` in a fresh temp dir, then
 * run the strict validator there with telemetry off. Returns the exit status
 * and combined output.
 */
function validateFixture(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "openspec-validate-test-"));
  try {
    mkdirSync(join(dir, "openspec", "specs", "widget"), { recursive: true });
    writeFileSync(join(dir, "openspec", "specs", "widget", "spec.md"), source);
    const result = spawnSync(OPENSPEC, ["validate", "--all", "--strict", "--no-interactive"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, OPENSPEC_TELEMETRY: "0" },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("openspec validate gate", () => {
  it("fails a spec whose Purpose is the archive placeholder", () => {
    const result = validateFixture(specSource(PLACEHOLDER_PURPOSE, "The widget SHALL greet."));
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/✗ spec\/widget/);
  });

  it("fails a spec with a requirement over 500 characters", () => {
    const longText = `The widget SHALL greet the user. ${"It greets politely. ".repeat(30)}`;
    expect(longText.length).toBeGreaterThan(500);
    const result = validateFixture(specSource(WRITTEN_PURPOSE, longText));
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/✗ spec\/widget/);
  });

  it("passes a spec with a written Purpose and short requirements", () => {
    const result = validateFixture(specSource(WRITTEN_PURPOSE, "The widget SHALL greet."));
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/✓ spec\/widget/);
  });

  it("passes the repository's spec tree", () => {
    const result = spawnSync(OPENSPEC, ["validate", "--all", "--strict", "--no-interactive"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, OPENSPEC_TELEMETRY: "0" },
    });
    expect(`${result.stdout}${result.stderr}`).toMatch(/\b0 failed\b/);
    expect(result.status).toBe(0);
  });

  it("lint:openspec wired into pre-commit, CI and test:all", () => {
    expect(packageJson.scripts["lint:openspec"]).toBe(
      "OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive",
    );
    expect(packageJson.devDependencies).toHaveProperty("@fission-ai/openspec");
    expect(packageJson.scripts["test:all"]).toMatch(/(^|\s)lint:openspec(\s|$)/);

    const preCommit = readFileSync(join(ROOT, ".husky", "pre-commit"), "utf8");
    expect(preCommit.split("\n")).toContain("pnpm run lint:openspec");

    const ci = parse(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
    const steps: { run?: string }[] = ci.jobs.ci.steps;
    expect(steps.some((step) => step.run === "pnpm run lint:openspec")).toBe(true);
  });
});
