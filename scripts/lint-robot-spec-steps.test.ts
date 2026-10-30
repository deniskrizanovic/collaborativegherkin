import { describe, it, expect } from "vitest";
import {
  lintSpecSteps,
  matchSpecStep,
  normalizeStep,
  parseRobotSuite,
  parseSpecScenarios,
  scenarioTitleOf,
} from "./lint-robot-spec-steps.mjs";

const spec = `### Requirement: Slash-command block picker

#### Scenario: Typing / opens picker
> **Tests:** none
- **GIVEN** the cursor is inside a block
- **WHEN** the user types \`/\`
- **THEN** a block picker menu opens
- **AND** the menu always includes \`Image\` as the final option

#### Scenario: Escape closes picker without inserting
> **Tests:** none
- **GIVEN** the block picker menu is open
- **WHEN** the user presses Escape
- **THEN** the menu closes without inserting a block

### Requirement: Something else
- **GIVEN** a line outside any scenario
`;

const specs = [{ file: "spec.md", content: spec }];

function suite(tests: string, tags = "pilot    bdd") {
  return `*** Settings ***
Resource            ../resources/steps/gherkin_editor.resource
Test Tags           ${tags}

*** Test Cases ***
${tests}

*** Keywords ***
Not A Test
    Click    .x
`;
}

const passing = suite(`SC-3.3.1: Typing / opens picker
    Given the cursor is inside a block on a new line after Feature
    When the user types /
    Then a block picker menu opens
    And the menu always includes Image as the final option

SC-3.3.6: Escape closes picker without inserting
    [Tags]    smoke
    # a comment
    Given the block picker menu is open
    When the user presses Escape
    Then the menu closes without inserting a block`);

function lint(content: string) {
  return lintSpecSteps(specs, [{ file: "s.robot", content }]).map((v) => [v.file, v.line, v.message]);
}

describe("parsers", () => {
  it("reads scenario steps and resolves AND to the kind before it", () => {
    const [first, second] = parseSpecScenarios(spec, "spec.md");
    expect(first.title).toBe("Typing / opens picker");
    expect(first.steps.map((s) => s.kind)).toEqual(["given", "when", "then", "then"]);
    expect(second.steps).toHaveLength(3);
  });

  it("detects the bdd tag and splits steps from other lines", () => {
    const parsed = parseRobotSuite(passing);
    expect(parsed.bdd).toBe(true);
    expect(parsed.tests.map((t) => t.steps.length)).toEqual([4, 3]);
    expect(parsed.tests.every((t) => t.other.length === 0)).toBe(true);
    expect(parseRobotSuite(suite("x\n    Click    .y", "chunk2")).bdd).toBe(false);
  });

  it("detects bdd on a continuation line, in Force Tags, and per test in [Tags]", () => {
    expect(parseRobotSuite(suite("x\n    Click    .y", "pilot\n...                 bdd")).bdd).toBe(true);
    expect(parseRobotSuite("*** Settings ***\nForce Tags    BDD\n").bdd).toBe(true);
    const perTest = parseRobotSuite(
      suite("A\n    [Tags]    smoke\n    ...    bdd\n    Given x\n\nB\n    Given y", "chunk2")
    );
    expect(perTest.bdd).toBe(false);
    expect(perTest.tests.map((t) => t.bdd)).toEqual([true, false]);
  });

  it("drops a trailing comment from a step", () => {
    const [test] = parseRobotSuite(suite("A\n    Given the block picker menu is open    # opens on Feature")).tests;
    expect(test.steps[0].text).toBe("the block picker menu is open");
  });

  it("strips the SC id and variant suffix from test names", () => {
    expect(scenarioTitleOf("SC-3.3.1: Typing / opens picker — Image always last")).toBe("Typing / opens picker");
  });

  it("normalizes case, backticks, whitespace and a trailing period", () => {
    expect(normalizeStep("The user  types `/`.")).toBe("the user types /");
  });
});

describe("matchSpecStep", () => {
  const lines = [{ text: "the menu closes" }, { text: "the menu closes without inserting a block" }];

  it("prefers an exact line, then the longest line the step refines", () => {
    expect(matchSpecStep("the menu closes", lines)).toBe(0);
    expect(matchSpecStep("the menu closes without inserting a block", lines)).toBe(1);
    expect(matchSpecStep("the menu closes without inserting a block at all", lines)).toBe(1);
    expect(matchSpecStep("the menu stays open", lines)).toBe(-1);
  });
});

describe("lintSpecSteps", () => {
  it("passes when every step states or refines a spec line and every line is covered", () => {
    expect(lint(passing)).toEqual([]);
  });

  it("checks a single test tagged bdd in a suite without the tag", () => {
    const content = suite("SC-9.9.9: Unknown scenario\n    [Tags]    bdd\n    Given anything\n\nOther\n    Click    .x", "chunk2");
    expect(lint(content)).toEqual([["s.robot", 6, 'no spec scenario titled "Unknown scenario"']]);
  });

  it("ignores suites without the bdd tag", () => {
    expect(lint(suite("SC-9: Unknown\n    Click    .x", "chunk2"))).toEqual([]);
  });

  it("fails on a test whose title matches no scenario", () => {
    expect(lint(suite("SC-9.9.9: Unknown scenario\n    Given anything"))).toEqual([
      ["s.robot", 6, 'no spec scenario titled "Unknown scenario"'],
    ]);
  });

  it("fails on technical keywords in a test body", () => {
    const content = passing.replace("    When the user presses Escape", "    Keyboard Key    press    Escape");
    const messages = lint(content).map((v) => v[2]);
    expect(messages).toContain("not a Given/When/Then step: Keyboard Key    press    Escape");
  });

  it("fails on a step that drifted from the spec, and reports the uncovered spec line", () => {
    const content = passing.replace("the menu closes without inserting a block", "the picker is closed");
    expect(lint(content)).toEqual([
      [
        "s.robot",
        17,
        expect.stringMatching(/^step not in spec scenario "Escape closes picker without inserting" .*: Then the picker is closed$/),
      ],
      ["spec.md", 14, expect.stringMatching(/^spec step not exercised .*: THEN the menu closes without inserting a block$/)],
    ]);
  });

  it("fails on a step of the wrong kind", () => {
    const content = passing.replace("    When the user presses Escape", "    Then the user presses Escape");
    expect(lint(content).map((v) => v[2])).toEqual([
      "step is a THEN here but a WHEN in the spec: Then the user presses Escape",
    ]);
  });

  it("fails when two scenarios share a title", () => {
    const twice = [...specs, { file: "other.md", content: spec }];
    const messages = lintSpecSteps(twice, [{ file: "s.robot", content: passing }]).map((v) => v.message);
    expect(messages).toContain('2 spec scenarios titled "Typing / opens picker"');
  });
});
