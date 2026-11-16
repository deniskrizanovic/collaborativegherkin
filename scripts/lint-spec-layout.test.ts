// Guards the spec-layout gate in openspec process/spec-authoring-standards:
// every spec sits under a category folder, and every local link in a spec is
// a repo-root target that exists. Fixtures are temp-dir trees outside the
// repo, so they never join the real spec tree.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CATEGORIES, findLayoutViolations, findLinkViolations } from "./lint-spec-layout.mjs";

const ROOT = resolve(__dirname, "..");

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lint-spec-layout-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Write `content` at `relPath` under the fixture root, creating folders. */
function write(relPath: string, content = "# spec\n") {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

describe("findLayoutViolations", () => {
  it("accepts specs under each category", () => {
    write("openspec/specs/product/gherkin/gherkin-editor/spec.md");
    write("openspec/specs/quality/code-linting/spec.md");
    write("openspec/specs/process/spec-authoring-standards/spec.md");
    expect(findLayoutViolations(join(root, "openspec"))).toEqual([]);
  });

  it("rejects a spec outside the categories", () => {
    const file = write("openspec/specs/gherkin-editor/spec.md");
    expect(findLayoutViolations(join(root, "openspec"))).toEqual([
      { file, specPath: "gherkin-editor/spec.md" },
    ]);
  });

  it("allows exactly product, quality and process", () => {
    expect(CATEGORIES).toEqual(["product", "quality", "process"]);
  });

  it("rejects a spec sitting directly in a category with no capability folder", () => {
    const file = write("openspec/specs/quality/spec.md");
    expect(findLayoutViolations(join(root, "openspec"))).toEqual([
      { file, specPath: "quality/spec.md" },
    ]);
  });

  it("scans change deltas", () => {
    write("openspec/changes/add-widget/specs/product/gherkin/gherkin-editor/spec.md");
    const file = write("openspec/changes/add-widget/specs/gherkin-editor/spec.md");
    expect(findLayoutViolations(join(root, "openspec"))).toEqual([
      { file, specPath: "gherkin-editor/spec.md" },
    ]);
  });

  it("ignores the archive", () => {
    write("openspec/changes/archive/2026-01-01-add-widget/specs/gherkin-editor/spec.md");
    expect(findLayoutViolations(join(root, "openspec"))).toEqual([]);
  });
});

describe("findLinkViolations", () => {
  it("accepts a resolving repo-root link", () => {
    write("scripts/lint-spec-layout.test.ts", "");
    const content =
      "> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — x\n";
    expect(findLinkViolations(content, "spec.md", root)).toEqual([]);
  });

  it("rejects a relative link", () => {
    write("scripts/lint-crap.test.ts", "");
    const content = "# spec\n\nSee [`lint-crap`](../../../scripts/lint-crap.test.ts).\n";
    expect(findLinkViolations(content, "spec.md", root)).toEqual([
      {
        file: "spec.md",
        line: 3,
        target: "../../../scripts/lint-crap.test.ts",
        reason: "relative",
      },
    ]);
  });

  it("rejects a dangling repo-root link", () => {
    const content = "[missing](/scripts/does-not-exist.test.ts)\n";
    expect(findLinkViolations(content, "spec.md", root)).toEqual([
      { file: "spec.md", line: 1, target: "/scripts/does-not-exist.test.ts", reason: "missing" },
    ]);
  });

  it("ignores external links and anchors", () => {
    const content = [
      "[issue](https://github.com/deniskrizanovic/collaborativegherkin/issues/74)",
      "[site](http://example.com) and [mail](mailto:a@example.com)",
      "[purpose](#purpose)",
    ].join("\n");
    expect(findLinkViolations(content, "spec.md", root)).toEqual([]);
  });

  it("resolves a target containing [id] and strips a #fragment", () => {
    write("src/app/api/sessions/[id]/route.test.ts", "");
    const content =
      "[`src/app/api/sessions/[id]/route.test.ts`](/src/app/api/sessions/[id]/route.test.ts#L10)\n";
    expect(findLinkViolations(content, "spec.md", root)).toEqual([]);
  });

  it("URL-decodes the target before resolving it", () => {
    write("docs/my file.md", "");
    expect(findLinkViolations("[doc](/docs/my%20file.md)\n", "spec.md", root)).toEqual([]);
  });

  it("finds every link on a line", () => {
    write("e2e/a.spec.ts", "");
    const content = "> **Tests:** [a](/e2e/a.spec.ts), [b](e2e/b.spec.ts), [c](/e2e/c.spec.ts)\n";
    expect(findLinkViolations(content, "spec.md", root)).toEqual([
      { file: "spec.md", line: 1, target: "e2e/b.spec.ts", reason: "relative" },
      { file: "spec.md", line: 1, target: "/e2e/c.spec.ts", reason: "missing" },
    ]);
  });

  it("skips links inside fenced code blocks", () => {
    const content = [
      "```markdown",
      "[x](../relative.md)",
      "```",
      "",
      "~~~",
      "[y](../z.md)",
      "~~~",
    ].join("\n");
    expect(findLinkViolations(content, "spec.md", root)).toEqual([]);
  });

  it("skips link syntax inside inline code spans", () => {
    expect(findLinkViolations("Write `[text](../x.md)` links.\n", "spec.md", root)).toEqual([]);
  });
});

describe("lint:spec-layout wiring", () => {
  it("lint:spec-layout wired into pre-commit, CI and test:all", () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(packageJson.scripts["lint:spec-layout"]).toBe("node scripts/lint-spec-layout.mjs");
    expect(packageJson.scripts["test:all"]).toMatch(/(^|\s)lint:spec-layout(\s|$)/);

    const preCommit = readFileSync(join(ROOT, ".husky", "pre-commit"), "utf8");
    expect(preCommit.split("\n")).toContain("pnpm run lint:spec-layout");

    const ci = parse(readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
    const steps: { run?: string }[] = ci.jobs.ci.steps;
    expect(steps.some((step) => step.run === "pnpm run lint:spec-layout")).toBe(true);
  });
});
