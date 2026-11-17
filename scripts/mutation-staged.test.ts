// Guards the staged-file mutation run in the openspec mutation-testing spec:
// which staged paths reach Stryker, that out-of-scope commits skip it, and that
// the Stryker arguments leave the full run's reports alone. Uses the real
// `mutate` globs from stryker.config.json.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { filterMutateTargets, runStaged, strykerArgs } from "./mutation-staged.mjs";

const ROOT = resolve(__dirname, "..");
const { mutate: MUTATE } = JSON.parse(readFileSync(resolve(ROOT, "stryker.config.json"), "utf8"));

describe("filterMutateTargets", () => {
  it("keeps in-scope src/lib files, given as absolute or relative paths", () => {
    expect(
      filterMutateTargets([resolve(ROOT, "src/lib/wsAuth.ts"), "src/lib/gherkin.ts"], MUTATE, ROOT),
    ).toEqual(["src/lib/wsAuth.ts", "src/lib/gherkin.ts"]);
  });

  it("drops tests, excluded files and paths outside src/lib", () => {
    expect(
      filterMutateTargets(
        [
          "src/lib/gherkin.test.ts",
          "src/lib/llm-constants.ts",
          "src/lib/logger.ts",
          "src/lib/db.ts",
          "src/db/schema.sqlite.ts",
          "src/components/GherkinEditor.tsx",
          "scripts/mutation-staged.mjs",
        ].map((path) => resolve(ROOT, path)),
        MUTATE,
        ROOT,
      ),
    ).toEqual([]);
  });
});

describe("strykerArgs", () => {
  it("names each kept file and uses only console reporters and --allowEmpty", () => {
    expect(strykerArgs(["src/lib/wsAuth.ts", "src/lib/session.ts"])).toEqual([
      "run",
      "--mutate",
      "src/lib/wsAuth.ts,src/lib/session.ts",
      "--reporters",
      "clear-text,progress",
      "--allowEmpty",
    ]);
  });
});

describe("runStaged", () => {
  const deps = (status: number | null) => ({
    mutateGlobs: MUTATE,
    cwd: ROOT,
    spawn: vi.fn(() => ({ status })) as never,
  });

  it("does not start Stryker when no staged file is in scope", () => {
    const d = deps(0);
    expect(runStaged([resolve(ROOT, "src/lib/gherkin.test.ts")], d)).toBe(0);
    expect(d.spawn).not.toHaveBeenCalled();
  });

  it("mutates the whole staged file and returns Stryker's exit code", () => {
    const d = deps(1);
    expect(runStaged([resolve(ROOT, "src/lib/wsAuth.ts")], d)).toBe(1);
    expect(d.spawn).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "stryker", ...strykerArgs(["src/lib/wsAuth.ts"])],
      { stdio: "inherit" },
    );
  });

  it("fails when Stryker exits without a status", () => {
    expect(runStaged(["src/lib/session.ts"], deps(null))).toBe(1);
  });
});
