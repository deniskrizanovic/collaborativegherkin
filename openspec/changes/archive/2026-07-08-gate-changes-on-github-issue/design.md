## Context

The project already enforces one traceability standard deterministically:
`scripts/lint-spec-traceability.mjs` (the `lint:specs` gate) fails any commit
whose OpenSpec scenarios lack a `> **Tests:**` line. It runs from the git
`pre-commit` hook and, for Claude's own commits, from a `PreToolUse` hook in
`.claude/settings.json`. This change adds a second, structurally identical gate
for a different invariant: every active change must be backed by a real, open
GitHub issue.

The repository is hosted on `github.com/deniskrizanovic/collaborativegherkin`.
The `gh` CLI is authenticated per-host; the active `github.com` account is
`deniskrizanovic` with `ADMIN` permission on the repo and `repo` scope — which
fully covers issue create/read. A second account 
exists for unrelated work and must never be used here.

## Goals / Non-Goals

**Goals:**
- Make it impossible to commit an active OpenSpec change with no valid, open
  linked issue, without relying on Claude or a human remembering to check.
- Reuse the existing gate architecture (standalone `.mjs` script, unit-tested
  pure functions, wired into both hook points and `test:all`) so the new gate is
  familiar and maintainable.
- Auto-create the issue during `/opsx:propose` so the gate almost never fires in
  practice — it is a safety net, not the primary workflow.

**Non-Goals:**
- Adding issues to a GitHub Project board (needs a `project` token scope not
  currently held; deferred).
- Gating code commits that skip OpenSpec entirely. OpenSpec is the front door
  for changes here, so the proposal gate covers them transitively.
- Verifying issue *content* (title/body quality). The gate checks existence and
  open state only.

## Decisions

**Link location: a `## GitHub Issue` section in `proposal.md` (vs. branch name
or sidecar file).** The proposal is OpenSpec's own artifact and is always present
for an active change, so the link stays inside the schema and travels with the
change. Branch names are easy to fabricate and couple naming to issues; a sidecar
`.issue` file introduces an artifact type outside the schema. The section
contains the full issue URL
(`https://github.com/deniskrizanovic/collaborativegherkin/issues/N`) rather than
a bare `#N`, so it is directly clickable from the proposal; the gate parses the
issue number `N` out of the URL for verification.

**Validation: a new `scripts/lint-issue-link.mjs` mirroring
`lint-spec-traceability.mjs`.** Pure, exported functions (discover active
changes, parse the issue URL from a proposal's content, decide violations)
are unit-tested with in-memory content; a thin `main()` walks
`openspec/changes/`, skips `archive/`, resolves each issue's state, and exits
non-zero on any violation. The GitHub lookup is injected as a function parameter
so tests never hit the network — consistent with the project's dependency-
injection preference over module mocking.

**Issue-state lookup via `gh api`, host pinned.** The gate shells out to
`gh api repos/deniskrizanovic/collaborativegherkin/issues/N --hostname github.com
--jq .state` and treats only `open` as valid. `--hostname github.com` guarantees
the `github.com`/`deniskrizanovic` account is used regardless of which account is
"active," so the Salesforce account can never leak in. (Note: `gh issue create`,
used by the `/opsx:propose` flow, does not accept `--hostname`; it is pinned with
the `GH_HOST=github.com` environment variable instead.)

**Fail closed.** If `gh` errors (unauthenticated, offline, rate-limited, API
failure), the gate exits non-zero rather than assuming the issue is fine. A hard
guarantee that silently degrades to "pass" on error is not a guarantee.

**Two enforcement points, plus `test:all`.** The gate is added to the git
`pre-commit` hook and the `.claude/settings.json` `PreToolUse` commit hook so
both human and Claude commits are covered, matching exactly how `lint:specs` is
wired. Adding it to `test:all` keeps CI/local parity.

## Risks / Trade-offs

- **Offline commits fail** → Accepted and documented. The whole point is a hard
  gate; a network dependency is inherent to verifying a remote issue. A developer
  who is genuinely offline can bypass with the standard `git commit --no-verify`
  escape hatch (a deliberate, visible action), consistent with the existing
  test/spec gates.
- **`gh` not installed / wrong account active** → The host-pinned call surfaces a
  clear error and fails closed; the gate's message tells the user to authenticate
  `gh` to `github.com`. No silent pass.
- **Extra latency per commit (one API call per active change)** → Active changes
  are few (usually one). Negligible next to the existing test run in the same
  hook.
- **Someone edits `proposal.md` to point at an unrelated open issue** → Out of
  scope to detect; the gate guarantees traceability to *an* open issue, not
  semantic correctness. The `/opsx:propose` auto-creation flow makes the correct
  issue the path of least resistance.

## Migration Plan

1. Add `scripts/lint-issue-link.mjs` + `scripts/lint-issue-link.test.ts`; add the
   `lint:issue-link` script and include it in `test:all`.
2. Backfill: ensure every currently-active change links a valid open issue. This
   change links issue #21 (as a full URL); `add-session-ownership-authz` must get
   an issue (created and linked) or be archived before the gate is wired, or the
   first commit will (correctly) fail.
3. Wire the gate into the git `pre-commit` hook and the `.claude/settings.json`
   `PreToolUse` commit hook.
4. Update the `/opsx:propose` command doc and CLAUDE.md with the issue-first
   standard.

Rollback: remove the gate invocation from both hooks and `test:all`; the script
and the harmless `## GitHub Issue` sections can stay.

## Open Questions

- Should `add-session-ownership-authz` get a backfilled issue or be archived
  first? (Resolved in tasks as an explicit pre-wiring step; default is to
  backfill an issue so the gate goes green.)
