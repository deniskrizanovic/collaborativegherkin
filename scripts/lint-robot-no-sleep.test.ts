import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findSleepCalls,
  findLibraryDelays,
  collectRobotFiles,
  collectLibraryFiles,
  lintFiles,
} from "./lint-robot-no-sleep.mjs";

const clean = `*** Settings ***
Documentation       Waits use auto-waiting assertions. Sleep is forbidden.
Resource            ../resources/common.resource

*** Test Cases ***
Block appears after Enter
    # Never Sleep here: wait for the count to grow instead.
    Press Enter And Wait For Block
    Get Element Count    .gherkin-block    ==    6
`;

const withSleep = `*** Test Cases ***
Block appears after Enter
    Keyboard Key    press    Enter
    Sleep    1s
    Get Element Count    .gherkin-block    ==    6
`;

describe("findSleepCalls", () => {
  it("passes on a clean file that only mentions Sleep in docs and comments", () => {
    expect(findSleepCalls(clean)).toEqual([]);
  });

  it("fails on a Sleep keyword call and reports the file and line", () => {
    expect(findSleepCalls(withSleep, "robot/suites/x.robot")).toEqual([
      { file: "robot/suites/x.robot", line: 4, text: "Sleep    1s" },
    ]);
  });

  it("matches Robot's normalized keyword names (case, spaces, underscores, BuiltIn prefix)", () => {
    const variants = `*** Keywords ***
Wait Badly
    sleep    1s
    SLEEP    1s
    S_l e_ep    1s
    BuiltIn.Sleep    1s
    \${x}=    Sleep    1s
`;
    expect(findSleepCalls(variants).map((v) => v.line)).toEqual([3, 4, 5, 6, 7]);
  });

  it("catches Sleep passed to a run-keyword wrapper and in a suite setting", () => {
    const wrapped = `*** Settings ***
Suite Setup    Sleep    2s

*** Test Cases ***
Wrapped
    Run Keyword And Ignore Error    Sleep    1s
`;
    expect(findSleepCalls(wrapped).map((v) => v.line)).toEqual([2, 6]);
  });

  it("catches inline Python and JavaScript delays and a Sleep stored in a variable", () => {
    const inline = `*** Variables ***
\${KW}    Sleep

*** Test Cases ***
Inline
    Evaluate    time.sleep(2)    modules=time
    Evaluate JavaScript    \${None}    () => new Promise((r) => setTimeout(r, 1000))
    \${kw}=    Set Variable    Sleep
    Run Keyword    \${kw}    1s
`;
    expect(findSleepCalls(inline).map((v) => v.line)).toEqual([2, 6, 7, 8]);
  });

  it("ignores the *** Comments *** section and keywords that merely contain the word", () => {
    const harmless = `*** Comments ***
Sleep    1s

*** Keywords ***
Sleep Until Ready
    Wait For Condition    Element Count    .ready    ==    1
`;
    expect(findSleepCalls(harmless)).toEqual([]);
  });
});

describe("findLibraryDelays", () => {
  it("flags delay calls in Python and JS libraries, not in comments", () => {
    const py = `import time
# time.sleep(1) is forbidden
def wait():
    time.sleep(1)
    asyncio.sleep(0.5)
`;
    expect(findLibraryDelays(py).map((v) => v.line)).toEqual([4, 5]);
    const js = `// never setTimeout(r, 100)
async function x(page) {
  await page.waitForTimeout(500);
}
`;
    expect(findLibraryDelays(js).map((v) => v.line)).toEqual([3]);
  });
});

describe("collectRobotFiles / lintFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lint-robot-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("scans .robot and .resource files under suites/ and resources/ only", () => {
    mkdirSync(join(root, "suites", "nested"), { recursive: true });
    mkdirSync(join(root, "resources"), { recursive: true });
    mkdirSync(join(root, "results"), { recursive: true });
    writeFileSync(join(root, "suites", "a.robot"), clean);
    writeFileSync(join(root, "suites", "nested", "b.robot"), withSleep);
    writeFileSync(join(root, "resources", "c.resource"), withSleep);
    writeFileSync(join(root, "suites", "notes.md"), withSleep);
    writeFileSync(join(root, "results", "d.robot"), withSleep);

    const files = collectRobotFiles(root);
    expect(files.map((f) => f.slice(root.length + 1)).sort()).toEqual([
      join("resources", "c.resource"),
      join("suites", "a.robot"),
      join("suites", "nested", "b.robot"),
    ]);

    const violations = lintFiles(files);
    expect(violations.map((v) => [v.file.slice(root.length + 1), v.line]).sort()).toEqual([
      [join("resources", "c.resource"), 4],
      [join("suites", "nested", "b.robot"), 4],
    ]);
  });

  it("scans Python and JS files under libraries/ for delays", () => {
    mkdirSync(join(root, "libraries"), { recursive: true });
    writeFileSync(join(root, "libraries", "probe.py"), "import time\ntime.sleep(1)\n");
    writeFileSync(join(root, "libraries", "routes.cjs"), "module.exports = {};\n");
    writeFileSync(join(root, "libraries", "notes.md"), "time.sleep(1)\n");

    const files = collectLibraryFiles(root);
    expect(files.map((f) => f.slice(root.length + 1)).sort()).toEqual([
      join("libraries", "probe.py"),
      join("libraries", "routes.cjs"),
    ]);
    expect(lintFiles(files).map((v) => [v.file.slice(root.length + 1), v.line])).toEqual([
      [join("libraries", "probe.py"), 2],
    ]);
  });

  it("returns no files when the robot directories do not exist", () => {
    expect(collectRobotFiles(join(root, "missing"))).toEqual([]);
  });
});
