import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findViolations, collectSpecFiles, lintFiles } from "./lint-spec-traceability.mjs";

const withLink = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Linked scenario
> **Tests:** [\`e2e/example.spec.ts\`](../../e2e/example.spec.ts) — a case
- **WHEN** something
- **THEN** something else
`;

const withNone = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Untested scenario
> **Tests:** none
- **WHEN** something
- **THEN** something else
`;

const missing = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Undocumented scenario
- **WHEN** something
- **THEN** something else
`;

describe("findViolations", () => {
  it("passes when a scenario is followed by a linked tests line", () => {
    expect(findViolations(withLink)).toEqual([]);
  });

  it("passes when a scenario is followed by '> **Tests:** none'", () => {
    expect(findViolations(withNone)).toEqual([]);
  });

  it("fails when a scenario has no tests line, naming the scenario", () => {
    const violations = findViolations(missing, "spec.md");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "spec.md", scenario: "Undocumented scenario" });
  });

  it("fails when the next heading arrives before any tests line", () => {
    const content = `#### Scenario: First
#### Scenario: Second
> **Tests:** none
- **WHEN** x
- **THEN** y
`;
    const violations = findViolations(content);
    expect(violations).toHaveLength(1);
    expect(violations[0].scenario).toBe("First");
  });
});

describe("collectSpecFiles + lintFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "spec-trace-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeSpec(relPath: string, content: string) {
    const full = join(root, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
    return full;
  }

  it("scans change-delta specs, not only the archived baseline", () => {
    writeSpec("specs/baseline/spec.md", withLink);
    const deltaFile = writeSpec("changes/some-change/specs/cap/spec.md", missing);

    const files = collectSpecFiles(root);
    expect(files).toContain(deltaFile);

    const violations = lintFiles(files);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe(deltaFile);
  });

  it("returns no violations when every scanned scenario declares its tests", () => {
    writeSpec("specs/baseline/spec.md", withLink);
    writeSpec("changes/some-change/specs/cap/spec.md", withNone);

    expect(lintFiles(collectSpecFiles(root))).toEqual([]);
  });
});
