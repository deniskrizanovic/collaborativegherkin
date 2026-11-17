#!/usr/bin/env node

// Staged-file mutation run, wired as the last `*.{ts,tsx}` command in
// lint-staged (see package.json). Keeps the staged paths that the `mutate`
// globs in stryker.config.json match and runs Stryker on those whole files.
// Stryker applies the config's `break` threshold, so a staged file whose
// mutants the unit suite misses fails the commit. Only console reporters run,
// so the full run's reports under reports/mutation/ are left alone.
//
// See openspec/changes/add-stryker-mutation-testing (design D9).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join, matchesGlob, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repo-relative paths from `paths` that the Stryker `mutate` globs select: a
 * path must match a positive glob and no `!` glob. Absolute paths (as
 * lint-staged passes them) are made relative to `cwd`.
 * @param {string[]} paths
 * @param {string[]} mutateGlobs
 * @param {string} cwd
 * @returns {string[]}
 */
export function filterMutateTargets(paths, mutateGlobs, cwd) {
  const include = mutateGlobs.filter((glob) => !glob.startsWith("!"));
  const exclude = mutateGlobs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1));
  return paths
    .map((path) => (isAbsolute(path) ? relative(cwd, path) : path).split(sep).join("/"))
    .filter(
      (path) =>
        include.some((glob) => matchesGlob(path, glob)) &&
        !exclude.some((glob) => matchesGlob(path, glob)),
    );
}

/**
 * Arguments for `stryker` that mutate exactly `files` with console reporters only.
 * @param {string[]} files
 * @returns {string[]}
 */
export function strykerArgs(files) {
  return ["run", "--mutate", files.join(","), "--reporters", "clear-text,progress", "--allowEmpty"];
}

/**
 * Run Stryker on the in-scope `paths` through `spawn`, or skip it when none
 * are in scope. Returns the exit code: Stryker's status, or 0 when skipped.
 * @param {string[]} paths
 * @param {{ mutateGlobs: string[], cwd: string, spawn: typeof spawnSync }} deps
 * @returns {number}
 */
export function runStaged(paths, { mutateGlobs, cwd, spawn }) {
  const files = filterMutateTargets(paths, mutateGlobs, cwd);

  if (files.length === 0) {
    console.log("✓ mutation:staged: no staged file in the mutate scope");
    return 0;
  }

  console.log(`mutation:staged: mutating ${files.join(", ")}`);
  const result = spawn("pnpm", ["exec", "stryker", ...strykerArgs(files)], { stdio: "inherit" });
  return result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();
  const config = JSON.parse(readFileSync(join(cwd, "stryker.config.json"), "utf8"));
  process.exitCode = runStaged(process.argv.slice(2), {
    mutateGlobs: config.mutate,
    cwd,
    spawn: spawnSync,
  });
}
