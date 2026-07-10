import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findViolations, collectSpecFiles, lintFiles } from "./lint-spec-given-clause.mjs";

const withGiven = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Scenario with GIVEN
> **Tests:** none
- **GIVEN** a known initial state
- **WHEN** something
- **THEN** something else
`;

const withStarGiven = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Scenario with star bullet GIVEN
> **Tests:** none
* **GIVEN** a known initial state
* **WHEN** something
* **THEN** something else
`;

const withIndentedGiven = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Scenario with indented GIVEN
> **Tests:** none
  - **GIVEN** a known initial state
- **WHEN** something
- **THEN** something else
`;

const missing = `### Requirement: Example
A thing SHALL happen.

#### Scenario: Scenario without GIVEN
> **Tests:** none
- **WHEN** something
- **THEN** something else
`;

describe("findViolations", () => {
  it("passes when a scenario contains a '- **GIVEN**' bullet", () => {
    expect(findViolations(withGiven)).toEqual([]);
  });

  it("passes when the GIVEN bullet uses a '*' marker", () => {
    expect(findViolations(withStarGiven)).toEqual([]);
  });

  it("passes when the GIVEN bullet has leading whitespace", () => {
    expect(findViolations(withIndentedGiven)).toEqual([]);
  });

  it("passes when GIVEN appears after the '> **Tests:**' line and among other bullets", () => {
    const content = `#### Scenario: GIVEN not first
> **Tests:** none
- **WHEN** something
- **GIVEN** a known initial state
- **THEN** something else
`;
    expect(findViolations(content)).toEqual([]);
  });

  it("fails when a scenario has only WHEN/THEN bullets, naming the scenario", () => {
    const violations = findViolations(missing, "spec.md");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "spec.md", scenario: "Scenario without GIVEN" });
  });

  it("fails when the next heading arrives before any GIVEN bullet", () => {
    const content = `#### Scenario: First
> **Tests:** none
- **WHEN** x
- **THEN** y
#### Scenario: Second
> **Tests:** none
- **GIVEN** a state
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
    root = mkdtempSync(join(tmpdir(), "spec-given-"));
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
    writeSpec("specs/baseline/spec.md", withGiven);
    const deltaFile = writeSpec("changes/some-change/specs/cap/spec.md", missing);

    const files = collectSpecFiles(root);
    expect(files).toContain(deltaFile);

    const violations = lintFiles(files);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe(deltaFile);
  });

  it("returns no violations when every scanned scenario declares a GIVEN", () => {
    writeSpec("specs/baseline/spec.md", withGiven);
    writeSpec("changes/some-change/specs/cap/spec.md", withStarGiven);

    expect(lintFiles(collectSpecFiles(root))).toEqual([]);
  });
});
