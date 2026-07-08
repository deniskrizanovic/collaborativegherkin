## 1. Gate script (TDD)

- [x] 1.1 Write `scripts/lint-issue-link.test.ts` covering the spec scenarios: valid open issue URL passes; missing `## GitHub Issue` section / no issue URL flags; issue `closed` flags; issue not-found flags; lookup error fails closed; `archive/` changes ignored. Inject the issue-state lookup as a function so tests never hit the network.
- [x] 1.2 Implement `scripts/lint-issue-link.mjs` mirroring `scripts/lint-spec-traceability.mjs`: exported pure helpers (`collectActiveChanges`, `parseIssueUrl(content)` — extracts issue number `N` from a `github.com/.../issues/N` URL, `findViolations(...)`) plus a thin `main()`. Skip `openspec/changes/archive/**`.
- [x] 1.3 In `main()`, resolve each issue's state via `gh api repos/deniskrizanovic/collaborativegherkin/issues/N --hostname github.com --jq .state`; treat only `open` as valid; fail closed (non-zero) on any `gh` error. Print an actionable message naming the change and issue on violation.
- [x] 1.4 Run `node scripts/lint-issue-link.mjs` and the unit test; confirm both pass against the current tree (this change links #21).

## 2. Wiring

- [x] 2.1 Add `"lint:issue-link": "node scripts/lint-issue-link.mjs"` to `package.json` scripts and include it in `test:all`.
- [x] 2.2 Add the `lint:issue-link` invocation to `.git/hooks/pre-commit` alongside the existing test run.
- [x] 2.3 Mirror the gate into the `.claude/settings.json` `PreToolUse` commit hook so Claude's own commits are blocked when a change is unlinked.

## 3. Backfill existing active changes

- [x] 3.1 Resolve `add-session-ownership-authz`: create and link a GitHub issue (`GH_HOST=github.com gh issue create ...`, add a `## GitHub Issue` section with the full issue URL to its `proposal.md`) or archive it, so the gate is green before the hooks are wired.
- [x] 3.2 Run `npm run lint:issue-link` and confirm zero violations across all active changes.

## 4. Docs and workflow

- [x] 4.1 Update the `/opsx:propose` command doc to auto-create the issue (`GH_HOST=github.com gh issue create`, after user approves title/body) and write the returned issue URL (`https://github.com/deniskrizanovic/collaborativegherkin/issues/N`) into the `## GitHub Issue` section of `proposal.md` before finalising artifacts.
- [x] 4.2 Record the issue-first standard in CLAUDE.md, noting the gate as the enforcer and the host-pinning convention (`--hostname github.com` for `gh api`, `GH_HOST=github.com` for `gh issue create`).

## 5. Verify

- [x] 5.1 Negative test: temporarily point a change at a closed/non-existent issue and confirm both the git and Claude commit gates block; restore afterward.
- [x] 5.2 Run `npm run test:all` and confirm the full suite (including `lint:issue-link`) passes.
