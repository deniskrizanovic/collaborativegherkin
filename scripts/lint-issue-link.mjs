#!/usr/bin/env node
// Issue-link lint gate.
//
// Every active OpenSpec change (`openspec/changes/<name>/`, excluding
// `archive/**`) MUST have a `## GitHub Issue` section in its `proposal.md`
// containing a full github.com issues URL for a real, open issue. The gate
// fails closed: if the `gh` CLI errors (unauthenticated, offline, etc.) the
// change is treated as a violation rather than silently passed.
//
// See openspec/changes/gate-changes-on-github-issue.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ISSUE_URL_RE =
  /https:\/\/github\.com\/deniskrizanovic\/collaborativegherkin\/issues\/(\d+)/;

/**
 * Returns the change names (directory names) directly under `changesDir`,
 * excluding `archive` and any non-directory entries.
 * @param {string} changesDir
 * @returns {string[]}
 */
export function collectActiveChanges(changesDir) {
  let entries;
  try {
    entries = readdirSync(changesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== "archive")
    .map((e) => e.name);
}

/**
 * Parses the issue number from the `## GitHub Issue` section of a
 * `proposal.md` content string. Returns the number as a string, or null if
 * the section is absent or contains no recognisable URL.
 * @param {string} content
 * @returns {string|null}
 */
export function parseIssueUrl(content) {
  const lines = content.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+GitHub Issue\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^##\s/.test(line)) break; // next section — stop
      const m = ISSUE_URL_RE.exec(line);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * Check each active change for a valid, open GitHub issue.
 *
 * `changes` is an array of `{ name, proposalContent }` objects.
 * `lookupState` is an async function `(issueNumber: string) => string`
 * that returns the issue state (e.g. `"open"`, `"closed"`) or throws on
 * error — injected so tests never hit the network.
 *
 * Returns an array of violation objects: `{ change, reason }`.
 * @param {{ name: string, proposalContent: string }[]} changes
 * @param {(n: string) => Promise<string>} lookupState
 * @returns {Promise<{ change: string, reason: string }[]>}
 */
export async function findViolations(changes, lookupState) {
  const violations = [];
  for (const { name, proposalContent } of changes) {
    const issueNumber = parseIssueUrl(proposalContent);
    if (!issueNumber) {
      violations.push({
        change: name,
        reason:
          "proposal.md has no '## GitHub Issue' section with a recognisable issue URL",
      });
      continue;
    }
    try {
      const state = await lookupState(issueNumber);
      if (state !== "open") {
        violations.push({
          change: name,
          reason: `issue #${issueNumber} is '${state}' (must be 'open')`,
        });
      }
    } catch (err) {
      violations.push({
        change: name,
        reason: `issue #${issueNumber} could not be verified: ${err.message}`,
      });
    }
  }
  return violations;
}

/** CLI entry point. Exits non-zero when any active change lacks a valid open issue. */
async function main() {
  const repoRoot = process.cwd();
  const changesDir = join(repoRoot, "openspec", "changes");

  const changeNames = collectActiveChanges(changesDir);

  const changes = changeNames.map((name) => {
    const proposalPath = join(changesDir, name, "proposal.md");
    let proposalContent;
    try {
      proposalContent = readFileSync(proposalPath, "utf8");
    } catch {
      proposalContent = "";
    }
    return { name, proposalContent };
  });

  const lookupState = async (issueNumber) => {
    const output = execSync(
      `gh api repos/deniskrizanovic/collaborativegherkin/issues/${issueNumber} --hostname github.com --jq .state`,
      { encoding: "utf8" }
    );
    return output.trim();
  };

  const violations = await findViolations(changes, lookupState);

  if (violations.length === 0) {
    console.log(
      `✓ issue-link: ${changeNames.length} active change(s) each link a valid open GitHub issue`
    );
    return;
  }

  console.error(
    `✗ issue-link: ${violations.length} active change(s) with invalid or missing issue links:\n`
  );
  for (const v of violations) {
    console.error(`  ${v.change}: ${v.reason}`);
  }
  console.error(
    `\nEach active change's proposal.md must have a '## GitHub Issue' section ` +
      `with a full URL (https://github.com/deniskrizanovic/collaborativegherkin/issues/N) ` +
      `for a real, open issue.\n` +
      `To create one: GH_HOST=github.com gh issue create --title "..." --body "..."`
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
