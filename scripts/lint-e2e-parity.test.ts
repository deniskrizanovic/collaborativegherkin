import { describe, it, expect } from "vitest";
import { lintParity, parseParityTable, parsePlaywrightList } from "./lint-e2e-parity.mjs";

function spec(file: string, title: string, expectedStatus = "passed") {
  return { title, file, line: 1, column: 1, tests: [{ expectedStatus, projectName: "chromium" }] };
}

const listJson = JSON.stringify({
  config: {},
  errors: [],
  suites: [
    {
      title: "a.spec.ts",
      file: "a.spec.ts",
      specs: [spec("a.spec.ts", "SC-1.1.1: Top level")],
      suites: [
        {
          title: "nested describe",
          file: "a.spec.ts",
          specs: [spec("a.spec.ts", "SC-1.1.2: Inside describe"), spec("a.spec.ts", "SC-1.1.3: Skipped", "skipped")],
        },
      ],
    },
  ],
});

const HEADER = "| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |\n|---|---|---|---|---|---|";

function table(...rows: string[]) {
  return `# Parity\n\n## a.spec.ts\n\n${HEADER}\n${rows.join("\n")}\n`;
}

function row(file: string, title: string, suite = "a.robot", status = "ported") {
  return `| ${file} | ${title} | asserts | ${suite} | 1 | ${status} |`;
}

function robot(...tests: string[]) {
  return `*** Settings ***\nTest Tags    chunk1\n\n*** Test Cases ***\n${tests.join("\n\n")}\n`;
}

function robotTest(name: string, tags?: string) {
  return `${name}\n${tags ? `    [Tags]    ${tags}\n` : ""}    Click    .x`;
}

type Test = { file: string; title: string; skipped: boolean };

function pw(title: string, skipped = false, file = "a.spec.ts"): Test {
  return { file, title, skipped };
}

function lint(tests: Test[], rows: string[], suites = [{ file: "robot/suites/a.robot", content: robot() }]) {
  return lintParity({ tests, rows: parseParityTable(table(...rows)), suites }).map(
    (e) => `${e.file} › ${e.title}: ${e.message}`
  );
}

describe("parsePlaywrightList", () => {
  it("reads file, title and skip from nested suites", () => {
    expect(parsePlaywrightList(listJson)).toEqual([
      { file: "a.spec.ts", title: "SC-1.1.1: Top level", skipped: false },
      { file: "a.spec.ts", title: "SC-1.1.2: Inside describe", skipped: false },
      { file: "a.spec.ts", title: "SC-1.1.3: Skipped", skipped: true },
    ]);
  });

  it("uses the spec file basename", () => {
    const json = JSON.stringify({ suites: [{ file: "sub/b.spec.ts", specs: [spec("sub/b.spec.ts", "T")] }] });
    expect(parsePlaywrightList(json)[0].file).toBe("b.spec.ts");
  });

  it("throws when no tests are listed", () => {
    expect(() => parsePlaywrightList(JSON.stringify({ suites: [] }))).toThrow(/no tests/);
  });

  it("throws when the JSON lacks the expected fields", () => {
    expect(() => parsePlaywrightList(JSON.stringify({ errors: [] }))).toThrow(/suites/);
    const noStatus = JSON.stringify({ suites: [{ specs: [{ file: "a.spec.ts", title: "T", tests: [{}] }] }] });
    expect(() => parsePlaywrightList(noStatus)).toThrow(/expectedStatus/);
    const noTitle = JSON.stringify({ suites: [{ specs: [{ file: "a.spec.ts", tests: [{ expectedStatus: "passed" }] }] }] });
    expect(() => parsePlaywrightList(noTitle)).toThrow(/title/);
  });
});

describe("parseParityTable", () => {
  it("keeps only rows whose first cell ends in .spec.ts", () => {
    const md =
      table(row("a.spec.ts", "T1")) +
      `\n${HEADER}\n| — | Smoke | x | 00_smoke.robot | 0 | ported |\n\n` +
      "| Technical test | Reason | BDD |\n|---|---|---|\n| `SC-1` | why | none |\n";
    expect(parseParityTable(md).map((r) => r.title)).toEqual(["T1"]);
  });

  it("splits on unescaped pipes and reads cells by position", () => {
    const md = table("| a.spec.ts | T1 | text == `a \\| b` | a.robot | 1 | skip |");
    expect(parseParityTable(md)).toEqual([
      { file: "a.spec.ts", title: "T1", suite: "a.robot", status: "skip", line: 7 },
    ]);
  });

  it("throws on a header that doesn't match", () => {
    const md = table(row("a.spec.ts", "T1")).replace("| Playwright file | Title |", "| Title | Playwright file |");
    expect(() => parseParityTable(md)).toThrow(/header/);
  });

  it("throws on a row without 6 cells", () => {
    expect(() => parseParityTable(table("| a.spec.ts | T1 | a.robot | ported |"))).toThrow(/6 cells/);
  });
});

describe("lintParity", () => {
  const suites = (content: string) => [{ file: "robot/suites/a.robot", content }];

  it("returns no errors for a consistent fixture, including a skip row", () => {
    const errors = lint(
      [pw("T1"), pw("T2", true)],
      [row("a.spec.ts", "T1"), row("a.spec.ts", "T2", "a.robot", "skip")],
      suites(robot(robotTest("T1"), robotTest("T2", "skip")))
    );
    expect(errors).toEqual([]);
  });

  it("fails on a listed test with no PARITY.md row", () => {
    expect(lint([pw("T1"), pw("T2")], [row("a.spec.ts", "T1")], suites(robot(robotTest("T1"))))).toEqual([
      "a.spec.ts › T2: Playwright test has no robot/PARITY.md row",
    ]);
  });

  it("fails on a PARITY.md row with no listed test", () => {
    expect(
      lint([pw("T1")], [row("a.spec.ts", "T1"), row("a.spec.ts", "Gone")], suites(robot(robotTest("T1"), robotTest("Gone"))))
    ).toEqual(["a.spec.ts › Gone: robot/PARITY.md row (line 8) names no Playwright test"]);
  });

  it("fails on a row marked pending", () => {
    expect(lint([pw("T1")], [row("a.spec.ts", "T1", "a.robot", "pending")], suites(robot(robotTest("T1"))))).toEqual([
      'a.spec.ts › T1: robot/PARITY.md status is "pending", expected "ported" or "skip"',
    ]);
  });

  it("fails on an unknown status", () => {
    expect(lint([pw("T1")], [row("a.spec.ts", "T1", "a.robot", "portd")], suites(robot(robotTest("T1"))))).toEqual([
      'a.spec.ts › T1: robot/PARITY.md status is "portd", expected "ported" or "skip"',
    ]);
  });

  it("fails when the Robot suite file doesn't exist", () => {
    expect(lint([pw("T1")], [row("a.spec.ts", "T1", "missing.robot")], suites(robot(robotTest("T1"))))).toEqual([
      "a.spec.ts › T1: Robot suite robot/suites/missing.robot does not exist",
    ]);
  });

  it("fails when the suite has no test of exactly the title", () => {
    expect(lint([pw("T1")], [row("a.spec.ts", "T1")], suites(robot(robotTest("Other"))))).toEqual([
      "a.spec.ts › T1: Robot suite robot/suites/a.robot has no test named exactly this title",
    ]);
  });

  it("fails on a title that differs only in case or dash", () => {
    const title = "SC-1.1.1: Thing — variant";
    const errors = lint(
      [pw(title)],
      [row("a.spec.ts", "sc-1.1.1: thing — variant"), row("a.spec.ts", "SC-1.1.1: Thing - variant")],
      suites(robot(robotTest(title)))
    );
    expect(errors).toEqual([
      `a.spec.ts › ${title}: Playwright test has no robot/PARITY.md row`,
      "a.spec.ts › sc-1.1.1: thing — variant: robot/PARITY.md row (line 7) names no Playwright test",
      "a.spec.ts › sc-1.1.1: thing — variant: Robot suite robot/suites/a.robot has no test named exactly this title",
      "a.spec.ts › SC-1.1.1: Thing - variant: robot/PARITY.md row (line 8) names no Playwright test",
      "a.spec.ts › SC-1.1.1: Thing - variant: Robot suite robot/suites/a.robot has no test named exactly this title",
    ]);
  });

  it("checks every title generated in a loop", () => {
    const letter = "SC-3.12.3 — letter";
    const slash = "SC-3.12.3 — slash";
    expect(lint([pw(letter), pw(slash)], [row("a.spec.ts", letter)], suites(robot(robotTest(letter))))).toEqual([
      `a.spec.ts › ${slash}: Playwright test has no robot/PARITY.md row`,
    ]);
  });

  it("fails on a duplicated (file, title) pair in Playwright or PARITY.md", () => {
    expect(lint([pw("T1"), pw("T1")], [row("a.spec.ts", "T1")], suites(robot(robotTest("T1"))))).toEqual([
      "a.spec.ts › T1: Playwright lists this test 2 times",
    ]);
    expect(
      lint([pw("T1")], [row("a.spec.ts", "T1"), row("a.spec.ts", "T1")], suites(robot(robotTest("T1"))))
    ).toEqual(["a.spec.ts › T1: robot/PARITY.md has 2 rows for this test (lines 7, 8)"]);
  });

  it("fails on a duplicated Robot test name in the suite", () => {
    expect(lint([pw("T1")], [row("a.spec.ts", "T1")], suites(robot(robotTest("T1"), robotTest("T1"))))).toEqual([
      "a.spec.ts › T1: Robot suite robot/suites/a.robot has 2 tests named exactly this title",
    ]);
  });

  describe("fails when Playwright skip, row status and Robot skip tag disagree", () => {
    const cases: [string, boolean, string, string | undefined][] = [
      ["Playwright skipped only", true, "ported", undefined],
      ["row skip only", false, "skip", undefined],
      ["Robot tag only", false, "ported", "skip"],
      ["Playwright and row, not Robot", true, "skip", undefined],
      ["Playwright and Robot, not row", true, "ported", "skip"],
      ["row and Robot, not Playwright", false, "skip", "skip"],
    ];
    for (const [name, skipped, status, tags] of cases) {
      it(name, () => {
        const errors = lint([pw("T1", skipped)], [row("a.spec.ts", "T1", "a.robot", status)], suites(robot(robotTest("T1", tags))));
        expect(errors).toEqual([
          `a.spec.ts › T1: skip status disagrees: Playwright ${skipped ? "skipped" : "runs"}, ` +
            `PARITY.md "${status}", Robot ${tags ? "tagged skip" : "not tagged skip"}`,
        ]);
      });
    }
  });

  it("matches the Robot skip tag ignoring case and spaces", () => {
    const errors = lint(
      [pw("T1", true)],
      [row("a.spec.ts", "T1", "a.robot", "skip")],
      suites(robot(robotTest("T1", "smoke    SKIP")))
    );
    expect(errors).toEqual([]);
  });
});
