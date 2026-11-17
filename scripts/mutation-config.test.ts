// Guards the Stryker contract in the openspec mutation-testing spec: Vitest
// runner, which files are mutated, the break/low/high threshold ordering, the
// report location, that the mutation run stays out of test:all and ci.yml, and
// that lint-staged runs the staged-file run last for .ts files.
// Reads the real config files; the mutation run itself is exercised by
// dispatching the weekly workflow.

import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

const config = JSON.parse(readFileSync(resolve(ROOT, "stryker.config.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const ci = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");

/** Files Stryker would mutate: the positive `mutate` globs minus the `!` ones. */
function mutatedFiles(): string[] {
  const patterns: string[] = config.mutate;
  const expand = (globs: string[]) => globs.flatMap((glob) => globSync(glob, { cwd: ROOT }));
  const included = expand(patterns.filter((p) => !p.startsWith("!")));
  const excluded = new Set(
    expand(patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1))),
  );
  return included.filter((file) => !excluded.has(file));
}

describe("stryker.config.json", () => {
  it("runs the Vitest unit suite with no type checker", () => {
    expect(config.testRunner).toBe("vitest");
    expect(config.checkers ?? []).toEqual([]);
  });

  describe("mutate scope", () => {
    const files = mutatedFiles();

    it("mutates library source", () => {
      expect(files).toContain("src/lib/gherkin.ts");
      expect(files).toContain("src/lib/session.ts");
    });

    it("does not mutate declarative and wiring files", () => {
      for (const file of [
        "src/lib/llm-constants.ts",
        "src/lib/logger.ts",
        "src/lib/db.ts",
        "src/db/schema.sqlite.ts",
        "src/db/schema.pg.ts",
      ]) {
        expect(files).not.toContain(file);
      }
    });

    it("does not mutate test files or declaration files", () => {
      expect(files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))).toEqual([]);
      expect(files.filter((file) => file.endsWith(".d.ts"))).toEqual([]);
    });

    it("does not mutate application code outside src/lib", () => {
      expect(files.filter((file) => !file.startsWith("src/lib/"))).toEqual([]);
      expect(files.some((file) => file.startsWith("src/components/"))).toBe(false);
    });
  });

  describe("thresholds", () => {
    const { break: breakAt, low, high } = config.thresholds;

    it("sets break to at least 80", () => {
      expect(breakAt).toBeGreaterThanOrEqual(80);
    });

    it("orders break below low below high", () => {
      expect(breakAt).toBeLessThan(low);
      expect(low).toBeLessThan(high);
    });
  });

  it("writes the HTML and JSON reports under reports/mutation/", () => {
    expect(config.reporters).toEqual(expect.arrayContaining(["html", "json", "clear-text"]));
    expect(config.htmlReporter.fileName).toBe("reports/mutation/mutation.html");
    expect(config.jsonReporter.fileName).toBe("reports/mutation/mutation.json");
  });

  it("keeps run output out of git", () => {
    const ignored = readFileSync(resolve(ROOT, ".gitignore"), "utf8").split("\n");
    expect(ignored).toContain("reports/");
    expect(ignored).toContain(`${config.tempDirName}/`);
  });
});

describe("mutation run wiring", () => {
  it("is exposed as the test:mutation script", () => {
    expect(pkg.scripts["test:mutation"]).toBe("stryker run");
  });

  it("is not part of test:all", () => {
    expect(pkg.scripts["test:all"]).not.toContain("mutation");
  });

  it("is not run by per-push CI", () => {
    expect(ci).not.toContain("test:mutation");
  });
});

describe("staged mutation run wiring", () => {
  it("is exposed as the test:mutation:staged script", () => {
    expect(pkg.scripts["test:mutation:staged"]).toBe("node scripts/mutation-staged.mjs");
  });

  it("runs last in lint-staged for .ts files", () => {
    const commands: string[] = pkg["lint-staged"]["*.{ts,tsx}"];
    expect(commands.at(-1)).toBe("pnpm run test:mutation:staged");
  });

  it("is not run by per-push CI", () => {
    expect(ci).not.toContain("test:mutation:staged");
  });
});
