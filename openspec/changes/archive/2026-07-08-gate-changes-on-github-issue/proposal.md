## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/21

## Why

Every change to this project is supposed to be traceable to a GitHub issue on
the repository, including the OpenSpec proposals that are the front door for all
changes. Today that expectation lives only in prose (CLAUDE.md, memory), which
is advisory: under a long or distracting session the rule can be forgotten or
rationalised away, and a change lands with no issue behind it. We want a
deterministic gate that makes an unlinked change *impossible to commit*, not
merely discouraged — the same way `lint:specs` already makes an untraced
scenario impossible to commit.

## What Changes

- Every active OpenSpec change (`openspec/changes/<name>/`, excluding
  `archive/**`) MUST declare a real, open GitHub issue. The link is a
  `## GitHub Issue` section in `proposal.md` containing the full issue URL
  (`https://github.com/deniskrizanovic/collaborativegherkin/issues/N`); the gate
  parses the issue number `N` from that URL.
- Add a new `lint:issue-link` gate (`scripts/lint-issue-link.mjs`, modelled on
  `scripts/lint-spec-traceability.mjs`) that, for each active change:
  1. requires the `## GitHub Issue` section with the full issue URL, and parses
     the issue number `N` from it;
  2. verifies via `gh api repos/deniskrizanovic/collaborativegherkin/issues/N
     --hostname github.com --jq .state` that the issue exists and is `open`;
  3. exits non-zero with an actionable message on any failure.
- Wire `lint:issue-link` into the two enforcement points already used for the
  test gate, so it behaves identically:
  - the git `pre-commit` hook, and
  - the Claude Code `PreToolUse` commit hook in `.claude/settings.json`.
- Add `lint:issue-link` to the `test:all` aggregate script for CI/local parity.
- Update the `/opsx:propose` command doc so the flow auto-creates the issue
  (`GH_HOST=github.com gh issue create ...`, after the user approves title/body)
  and writes the returned issue URL into `proposal.md` before artifacts are
  finalised. The gate then only has to verify.
- Record the standard in CLAUDE.md so the intent is discoverable, with the gate
  as the actual enforcer.

Out of scope: adding issues to a GitHub **Project board** (requires a `project`
token scope the current github.com token does not carry); gating ad-hoc code
commits that bypass OpenSpec entirely (the repo convention is OpenSpec-first, so
the proposal gate covers changes transitively).

## Capabilities

### New Capabilities
- `change-issue-traceability`: Requires every active OpenSpec change to be
  backed by a real, open GitHub issue linked from `proposal.md`, and defines the
  deterministic gate (`lint:issue-link`) that blocks commits when the link is
  missing, malformed, or points at a non-existent or closed issue.

### Modified Capabilities
<!-- None: no existing spec covers change/issue traceability. -->

## Impact

- **New code:** `scripts/lint-issue-link.mjs` and its unit test
  `scripts/lint-issue-link.test.ts`.
- **Scripts:** `package.json` gains `lint:issue-link`; `test:all` runs it.
- **Hooks:** `.git/hooks/pre-commit` (and the mirrored `.claude/settings.json`
  `PreToolUse` commit hook) invoke the new gate alongside the test run.
- **Docs:** `.claude/commands` `/opsx:propose` flow and CLAUDE.md gain the
  issue-first standard.
- **External dependency:** relies on the `gh` CLI authenticated to `github.com`
  as the repo owner (already the case; `repo` scope is sufficient — no scope
  change needed). Calls pin the host (`--hostname github.com` for `gh api`,
  `GH_HOST=github.com` for `gh issue create`) so the Salesforce enterprise
  account can never be used by accident.
- **Behaviour:** committing an active change whose `proposal.md` lacks a valid,
  open issue link now fails locally. No effect on archived changes. Offline
  commits fail closed if `gh` cannot reach GitHub — an accepted tradeoff for a
  hard guarantee, documented in design.md.
