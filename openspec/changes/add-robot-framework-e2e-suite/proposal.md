## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/42

## Why

The e2e suite is 15 Playwright TypeScript files (~1,950 lines) that have picked
up a lot of hard-won robustness over time: two-context sync checks, held network
routes, response-status assertions, raw WebSocket auth probes, download-content
checks, and a second identity for owner-vs-collaborator paths. We want the same
coverage in Robot Framework with the Browser library (which drives Playwright
underneath), so tests read as keyword-driven acceptance tests. None of that
robustness can be lost along the way. The work has to land in small chunks,
each one proven by green tests, because the author is new to Robot Framework
and needs visible progress.

## What Changes

- Add a Python toolchain managed by `uv` (`pyproject.toml` + `uv.lock`) that pins
  `robotframework` and `robotframework-browser`, plus a `pnpm test:robot` script
  that wraps `uv run robot`.
- Add a `robot/` tree: a shared resource file holding the keyword equivalents of
  `e2e/helpers.ts` (`Open Session`, `Create Session Via API`, `Press Enter And Wait
  For Block`, `Block Types In Editor`, ...), suite setup/teardown, and one `.robot`
  suite per existing `.spec.ts`.
- Reuse the existing `e2e/global-setup.ts` auth minting (NextAuth JWT storage
  states `user.json` / `user2.json`) instead of re-implementing JWT encoding in
  Python. Both suites load the same storage-state files.
- Add a small Python keyword library for the one thing Browser cannot do: the raw,
  cookie-controlled WebSocket upgrade probe used by the ENG-005 auth tests.
- API-contract tests (non-owner GET/PATCH/DELETE in `session-access-control`) use
  Robot's RequestsLibrary (`robotframework-requests`) and run without a browser.
  They authenticate with the cookie from the same storage-state files.
- Port the suites in ordered chunks. Each chunk is a working, green, reviewable
  increment: (0) toolchain plus one smoke test, (1) simple UI suites, (2) keyboard
  and editor-structure suites, (3) download/file suites, (4) network-interception
  suites, (5) multi-context and multi-identity suites, (6) the raw WebSocket suite,
  (7) CI wiring.
- Add a parity checklist that maps every Playwright test title to its Robot test
  case, so no test or assertion is dropped without anyone noticing.
- Keep the Playwright TypeScript suite permanently. Both suites run in CI against
  the same server, and neither replaces the other.
- Extend the `> **Tests:**` lines in the baseline specs to cite the Robot suite next
  to the existing `.spec.ts` citation as each chunk lands.

## Capabilities

### New Capabilities
- `robot-e2e-suite`: the Robot Framework e2e suite: how it is installed and run,
  how it authenticates, the parity contract with the Playwright suite (every test
  ported, every robustness technique preserved), the chunk-by-chunk delivery rule,
  and CI execution alongside Playwright.

### Modified Capabilities
<!-- None. Product behaviour is unchanged. Only test citations in existing specs
     grow (traceability metadata, not requirements). -->

## Impact

- **New files:** `pyproject.toml`, `uv.lock`, `.python-version`, `robot/**`
  (resources, suites, Python keyword library), `robot/PARITY.md`.
- **Modified files:** `package.json` (new `test:robot` and `test:robot:init`
  scripts; `test:all` gains `test:robot`), `.github/workflows/ci.yml` (uv setup,
  `rfbrowser init`, Robot run, results artifact upload), `.gitignore` (Robot output
  `robot/results/`, `.venv/`), baseline `openspec/specs/*/spec.md` `> **Tests:**`
  lines.
- **Unchanged:** all application code, `e2e/**`, `playwright.config.ts`, and
  `e2e/global-setup.ts` (it is invoked by Robot, not edited). Nothing on the
  Do Not Touch list is affected.
- **Dependencies:** Python ≥ 3.10 via `uv`; `robotframework`,
  `robotframework-browser` (it needs Node and installs its own Playwright through
  `rfbrowser init`), `robotframework-requests` for the API-contract tests, and
  `websockets` for the WS probe library.
- **CI time:** the e2e phase roughly doubles because both suites run serially
  against one dev server and one SQLite DB.