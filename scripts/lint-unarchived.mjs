#!/usr/bin/env node

// Unarchived-change lint gate.
//
// An active OpenSpec change (`openspec/changes/<name>/`, excluding
// `archive/**`) whose `tasks.md` has at least one checkbox and no unchecked
// `- [ ]` item is finished but not archived. The gate fails and names each
// one. Pure filesystem check, no network.
//
// Wired into `.husky/pre-merge-commit` and the Claude `PreToolUse` hook on
// `git branch -d/-D`; deliberately NOT in `pre-commit` or CI, because a branch
// legitimately has every task checked between finishing and archiving.
//
// See openspec/changes/gate-archive-and-commit-tokencost.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectActiveChanges } from "./lint-issue-link.mjs";

const CHECKBOX_RE = /^\s*[-*+]\s+\[([ xX])\]/gm;

/**
 * True when `tasksContent` has at least one checkbox item and none unchecked.
 * @param {string} tasksContent
 * @returns {boolean}
 */
export function isFinished(tasksContent) {
  const boxes = [...tasksContent.matchAll(CHECKBOX_RE)];
  return boxes.length > 0 && boxes.every((m) => m[1] !== " ");
}

/**
 * Names of active changes under `changesDir` that are finished but unarchived.
 * A change with no readable `tasks.md` is not finished.
 * @param {string} changesDir
 * @returns {string[]}
 */
export function findFinishedChanges(changesDir) {
  return collectActiveChanges(changesDir).filter((name) => {
    try {
      return isFinished(readFileSync(join(changesDir, name, "tasks.md"), "utf8"));
    } catch {
      return false;
    }
  });
}

/** CLI entry point. Exits non-zero when any active change is finished but unarchived. */
function main() {
  const changesDir = join(process.cwd(), "openspec", "changes");
  const finished = findFinishedChanges(changesDir);

  if (finished.length === 0) {
    console.log("✓ unarchived: no finished change is waiting to be archived");
    return;
  }

  console.error(`✗ unarchived: ${finished.length} finished change(s) not archived:\n`);
  for (const name of finished) {
    console.error(`  ${name}`);
  }
  console.error(
    "\nEvery task is checked but the change is still under openspec/changes/. " +
      "Archive it on the feature branch (openspec-archive-change) before merging " +
      "or deleting the branch.",
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
