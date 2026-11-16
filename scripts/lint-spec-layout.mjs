#!/usr/bin/env node
// Spec-layout lint gate.
//
// Two rules over the archived baseline (`openspec/specs/**`) and unarchived
// change deltas (`openspec/changes/*/specs/**`):
//
// 1. Every `spec.md` sits under a category folder (`product/`, `quality/` or
//    `process/`) with at least one capability folder below it, so archiving a
//    change never creates an uncategorised capability.
// 2. Every local Markdown link uses a repo-root target (`/scripts/x.test.ts`)
//    that exists. Relative targets point somewhere else once a spec moves or
//    its delta is archived two levels shallower.
//
// Sibling of the traceability gate (`lint-spec-traceability.mjs`): pure
// filesystem, no network, offline-safe. See
// openspec/changes/organise-specs-into-categories.

import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collectSpecFiles } from "./lint-spec-traceability.mjs";

/** Allowed top-level spec folders. Adding one is a reviewed code change. */
export const CATEGORIES = ["product", "quality", "process"];

const FENCE_RE = /^\s*(```|~~~)/;
// An inline code span, opened and closed by the same run of backticks.
const CODE_SPAN_RE = /(`+)(.*?)\1/g;
// `[text](target)`. Link text may hold one level of brackets (`[id]`); the
// target is everything up to the closing `)`.
const LINK_RE = /\[(?:[^[\]]|\[[^[\]]*\])*\]\(([^)]*)\)/g;
const EXTERNAL_RE = /^(https?:|mailto:)/;

/**
 * Path of `file` relative to its `specs/` root: `openspec/specs/` for main
 * specs, `openspec/changes/<change>/specs/` for deltas.
 * @param {string} file
 * @param {string} openspecRoot
 * @returns {string}
 */
function specPathOf(file, openspecRoot) {
  const parts = relative(openspecRoot, file).split(sep);
  const rest = parts[0] === "specs" ? parts.slice(1) : parts.slice(3);
  return rest.join("/");
}

/**
 * Find every `spec.md` under `openspecRoot` that is not inside a category
 * folder with a capability folder below it.
 * @param {string} openspecRoot
 * @returns {{ file: string, specPath: string }[]}
 */
export function findLayoutViolations(openspecRoot) {
  const violations = [];
  for (const file of collectSpecFiles(openspecRoot)) {
    if (!file.endsWith(`${sep}spec.md`)) continue;
    const specPath = specPathOf(file, openspecRoot);
    const segments = specPath.split("/");
    if (!CATEGORIES.includes(segments[0]) || segments.length < 3) {
      violations.push({ file, specPath });
    }
  }
  return violations;
}

/**
 * Find local links in one spec's content that are relative, or repo-root but
 * pointing at nothing under `repoRoot`. Skips fenced code blocks, inline code
 * spans, external links and pure anchors.
 * @param {string} content
 * @param {string} file
 * @param {string} repoRoot
 * @returns {{ file: string, line: number, target: string, reason: "relative" | "missing" }[]}
 */
export function findLinkViolations(content, file, repoRoot) {
  const lines = content.split(/\r?\n/);
  const violations = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const text = lines[i].replace(CODE_SPAN_RE, (span) => " ".repeat(span.length));
    for (const match of text.matchAll(LINK_RE)) {
      const target = match[1].trim().split(/\s+/)[0];
      if (target === "" || target.startsWith("#") || EXTERNAL_RE.test(target)) continue;

      if (!target.startsWith("/")) {
        violations.push({ file, line: i + 1, target, reason: "relative" });
        continue;
      }
      const path = decodeURIComponent(target.split("#")[0]);
      if (!existsSync(join(repoRoot, path))) {
        violations.push({ file, line: i + 1, target, reason: "missing" });
      }
    }
  }

  return violations;
}

/** CLI entry point. Exits non-zero on any layout or link violation. */
function main() {
  const repoRoot = process.cwd();
  const openspecRoot = join(repoRoot, "openspec");
  const files = collectSpecFiles(openspecRoot);

  const layout = findLayoutViolations(openspecRoot);
  const links = files.flatMap((file) =>
    findLinkViolations(readFileSync(file, "utf8"), file, repoRoot),
  );

  if (layout.length === 0 && links.length === 0) {
    console.log(
      `✓ spec layout: ${files.length} spec file(s) scanned, every spec is categorised and every link resolves`,
    );
    return;
  }

  if (layout.length > 0) {
    console.error(`✗ spec layout: ${layout.length} spec(s) outside a category folder:\n`);
    for (const v of layout) console.error(`  ${relative(repoRoot, v.file)}`);
    console.error(
      `\nMove each spec under one of: ${CATEGORIES.map((c) => `${c}/`).join(", ")} ` +
        `(e.g. specs/quality/<capability>/spec.md).\n`,
    );
  }

  if (links.length > 0) {
    console.error(`✗ spec layout: ${links.length} spec link(s) that are relative or dangling:\n`);
    for (const v of links) {
      const why = v.reason === "relative" ? "relative, use the repo-root form" : "missing target";
      console.error(`  ${relative(repoRoot, v.file)}:${v.line}  ${v.target}  (${why})`);
    }
    console.error(
      `\nSpec links must be repo-root paths that exist, e.g. [\`scripts/x.test.ts\`](/scripts/x.test.ts).`,
    );
  }
  process.exitCode = 1;
}

// Run only when invoked directly, not when imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
