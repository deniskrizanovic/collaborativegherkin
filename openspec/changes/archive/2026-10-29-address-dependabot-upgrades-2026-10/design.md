## Context

Issue #44 tracks the Dependabot run of 2026-10-05, which produced PR #41: the
`minor-and-patch` group with 27 updates. Two older Dependabot PRs are still open
as well: #18 (ESLint 10, CI red) and #17 (lint-staged 17, CI green). Observed
state on branch `collaborativegherkin-44`:

- `.github/dependabot.yml` fails to parse. Psych reports `did not find expected '-'
  indicator ... at line 14 column 11`, from `- "minor"W`, introduced in `ea7a3e6`.
- `.github/workflows/ci.yml` triggers only on `src/**`, `openspec/**`, `prisma/**`,
  `scripts/**`, `robot/**`, `e2e/**`, `pyproject.toml` and `uv.lock` (filter
  added in `2bd48bc` to avoid runs on docs-only changes). As a result #41 has an
  empty `statusCheckRollup`.
- `next-auth@5.0.0-beta.31` depends on `@auth/core: "0.41.2"` (exact), and so does
  `@auth/prisma-adapter@2.11.2`. In #41, the bumped `@auth/prisma-adapter@2.11.3`
  depends on `0.41.3`. `src/lib/wsAuth.ts` imports `decode` from `@auth/core/jwt`
  directly, so a split tree would also mean the WebSocket auth decodes with a
  different core version than the one `next-auth` encodes with.
- On the npm registry today, `eslint-plugin-react@7.37.5`,
  `eslint-plugin-import@2.32.0` and `eslint-plugin-jsx-a11y@6.10.2` declare
  `eslint` peers that stop at `^9`, while `eslint-plugin-react-hooks` and
  `typescript-eslint` accept `^10`. `eslint-config-next` depends on all five.
- Newer releases exist than #41's snapshot (for example `next` 16.4.3, `react`
  19.3.1, `@tiptap/core` 3.32.1, `@prisma/client` 7.10.1, `zod` 4.6.7,
  `@playwright/test` 1.64.1, `lint-staged` 17.6.0).
- ADR 0004 sets the latest-stable principle and documents two exceptions
  (`@tiptap/extension-collaboration-cursor`, `next-auth`).

User decisions taken during planning: defer ESLint 10; hold `next-auth` /
`@auth/core` / `@auth/prisma-adapter` at their current versions.

## Goals / Non-Goals

**Goals:**
- Every Dependabot PR open today is resolved: its upgrade is either applied or
  deferred under a documented exception.
- Dependabot configuration is valid, and a gate keeps it valid.
- Future dependency-only PRs run CI.
- The resolved tree keeps a single `@auth/core`.

**Non-Goals:**
- Upgrading `next-auth` to `5.0.0-beta.32` or taking the `@auth/core` 0.41.3
  security fixes (held by user decision; see Open Questions).
- ESLint 10 migration.
- Re-enabling `@tiptap/extension-collaboration-cursor`. No release has switched
  it to `@tiptap/y-tiptap` yet, so the ADR 0004 exception is unchanged.
- Changing any Tiptap/Y.js, NextAuth or Prisma configuration, or
  `src/lib/gherkin.ts`. This change bumps versions only. The two exceptions are
  the `schema` path in `prisma/postgres/prisma.config.ts`, which Prisma 7.10
  requires (see D8), and the provider lifecycle in
  `src/components/useCollabProvider.ts`, which Next 16.4 exposes (see D9).
- GitHub account notification settings (email delivery). These are per-user
  settings on github.com, not repository files.
- A `CODEOWNERS` file (see D7).

## Decisions

### D1. Upgrade on the feature branch instead of merging the Dependabot PRs
Do the upgrades on `collaborativegherkin-44` with pnpm, then close #41, #18 and
#17 as superseded.
- *Why:* #41 is stale and would bring in the split `@auth/core`. Its group cannot
  drop the auth trio until the config fix lands on `main`. One branch also lets
  the config fix, CI fix, gate and upgrades be verified together in a single
  full test run.
- *Alternative:* fix the config on `main` first, then `@dependabot recreate` #41
  and merge #17. That takes two round-trips through `main`, and it waits on
  Dependabot's scheduling. Rejected.

### D2. Upgrade in ordered batches, with checks between them
Apply the upgrades in batches so a regression can be traced to its batch:
1. Dev tooling: `@playwright/test`, `@types/*`, `eslint-config-next` (minor),
   `prisma` CLI, `lint-staged` 17 (major), `tsx`, `vitest`, `typescript`
   (minor/patch only).
2. Data layer: `@prisma/client`, `@prisma/adapter-*`, then `prisma generate`
   and `pnpm db:generate:postgres`.
3. Framework: `next`, `@next/env`, `react`, `react-dom`, `zod`,
   `nsw-design-system`, `@fontsource/public-sans`, `pino*`, `dotenv`.
4. Collaboration: `@tiptap/*` (excluding `extension-collaboration-cursor`),
   `yjs`, `y-websocket`, `y-protocols`, `lib0`, `ws`.

After each batch run `typecheck`, `lint`, and `test -- --run`. After batch 4,
also run the full `test:all` (Playwright + Robot). Use
`pnpm update <pkgs>` to stay within the current major (pnpm also raises the
`package.json` floors), and `pnpm add -D lint-staged@^17` for the one major.
- *Why:* ADR 0004 asks for an atomic step plus a test run per major. Minors get
  batch-level isolation, which is cheaper than one package at a time and can
  still be bisected.

### D3. Pin `@auth/prisma-adapter` exactly; Dependabot ignores both lockstep packages
Change `@auth/prisma-adapter` from `^2.11.2` to `2.11.2`. In
`.github/dependabot.yml`, add `ignore` entries for `@auth/core` and
`@auth/prisma-adapter` with no `update-types` (all updates ignored). Keep
`next-auth` semver-major ignored only, so new v5 betas and the stable release
still raise PRs. Those PRs are the trigger to move all three together, by hand.
- *Alternative:* a pnpm `overrides` entry forcing a single `@auth/core`. It would
  silently pair `next-auth` with a core it was not released against. Rejected.

### D4. `lint:dependabot` gate
New `scripts/lint-dependabot.mjs`, matching the existing gates (exported pure
functions, a CLI entry point, a `✓`/violation report, non-zero exit on failure)
and tested by `scripts/lint-dependabot.test.ts` through injected file contents
(ADR 0001: explicit injection, no `vi.mock`).
- Parse with the `yaml` package's `parseDocument`, collecting `doc.errors` with
  their `linePos`. Add `yaml` as a direct devDependency (already in the tree
  transitively at 2.9.0).
- For each `updates[*].ignore[*].dependency-name`, require the literal name in
  backticks (`` `name` ``) somewhere in ADR 0004. A backtick match avoids false
  positives from substrings, such as `eslint` inside `eslint-config-next`
  wording; ADR prose already uses backticked package names.
- *Why a gate:* the YAML typo went unnoticed for almost four months. GitHub
  reports config errors only in the Dependabot UI. Offline-safe, so it runs in
  husky like `lint:specs`.

### D5. Widen the CI `paths` allowlist rather than drop it
Add `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/**`,
`eslint.config.mjs`, `tsconfig.json`, `next.config.*`, `vitest.config.*`,
`playwright.config.*` and `server.js` to both the `push` and `pull_request`
filters.
- *Why:* `2bd48bc` added the filter on purpose, to skip docs-only runs. Widening
  keeps that saving and closes the gap. `server.js` and the configs are code and
  were already missing from the list.
- *Alternative:* `paths-ignore` for `docs/**` and `**/*.md`. Rejected because
  `openspec/**/*.md` must still trigger CI, and allow and ignore lists cannot be
  mixed in one trigger.

### D6. ESLint 10 is deferred as an ADR 0004 exception
Add an `eslint` exception section to ADR 0004. The re-check signal: every
plugin `eslint-config-next` depends on (`eslint-plugin-react`,
`eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`,
`typescript-eslint`, `@next/eslint-plugin-next`) declares an `eslint` peer range
that includes `^10`. Add a Dependabot ignore for `eslint` semver-major.
Minor/patch ESLint 9 updates keep flowing.

### D7. Assign Dependabot PRs to the owner via `assignees`
Set `assignees: ["deniskrizanovic"]` on the `npm` update entry and delete
`reviewers:`. `lint:dependabot` checks that every `updates[*]` entry has
`deniskrizanovic` in `assignees` and none has a `reviewers` key.
- *Why:* GitHub's Dependabot options reference documents `assignees` ("All pull
  requests for version updates are created with the chosen assignees"; the
  assignee needs write access, which the owner has). It no longer lists
  `reviewers`. Being assigned makes the owner a participant, and GitHub emails
  participants by default.
- *Alternative:* keep `reviewers`. It is undocumented, so it may already do
  nothing. Rejected.
- *Alternative:* a `CODEOWNERS` rule on `package.json` / `pnpm-lock.yaml` to get
  review requests. It adds a new file, and it fires only when the owned paths
  change. Deferred; it can be added later on top of D7.

### D8. Make the Postgres Prisma config's `schema` path config-relative
Found during apply: under Prisma 7.10.1, `pnpm db:generate:postgres` fails with
`Could not load schema from .../prisma/postgres/prisma/postgres/schema.prisma`.
Prisma now resolves the `schema` path in `prisma.config.ts` from the config
file's directory, not the working directory. The 7.10.1 release notes do not
mention it. Change `prisma/postgres/prisma.config.ts` from
`schema: "prisma/postgres/schema.prisma"` to `schema: "schema.prisma"`. The root
`prisma.config.ts` sits at the repo root, so its path resolves the same either
way and stays as it is. Migrations live beside the schema
(`prisma/postgres/migrations`), so they follow it.
- *Why:* the same config file drives `db:migrate:dev:postgres` and
  `db:migrate:prod`, so without the fix the production migrate command breaks
  too. The user chose this over holding Prisma at 7.8.
- *Verification:* `prisma validate` and `db:generate:postgres` with the Postgres
  config. Local `DATABASE_URL` is SQLite, so `prisma migrate status --config
  prisma/postgres/prisma.config.ts` must be run by the owner against a real
  Postgres database before the next `db:migrate:prod`. Never run `migrate
  deploy` as part of this change.
- *Generated client:* both schemas generate into `src/generated/prisma`, so the
  last `generate` wins. The tracked client is the SQLite one, so regenerate
  SQLite last.

### D9. Create the collaboration provider inside the effect that destroys it
Found during apply: with `next` 16.4.3, every e2e session shows "Sync server
disconnected". A bisect pins it on Next, not `y-websocket`: Next 16.2.6 with
`y-websocket` 3.1.0 passes `block-picker.spec.ts` 9/9. `useCollabProvider.ts`
created the `WebsocketProvider` in a `useState` initializer and destroyed it in
the effect cleanup. Under the React bundled with Next 16.4, dev StrictMode's
mount → unmount → mount runs that cleanup, so the first socket closes about 25ms
after opening and the editor stays bound to the destroyed provider.
- *Fix:* the effect creates the provider and its cleanup destroys it; the
  provider reaches render through state (`null` until the effect runs), and
  `GherkinEditor.tsx` skips its seed-on-`synced` effect until it exists. The
  `Y.Doc` stays in `useState` and is no longer destroyed in the cleanup, which
  StrictMode replays; the editor unbinds from it when it is destroyed. The two
  setState calls in the effect carry a scoped
  `react-hooks/set-state-in-effect` disable with the reason.
- *Why:* the user chose this over holding Next at 16.2.x, and gave explicit
  permission to edit this Do-Not-Touch file. No Tiptap or Y.js configuration
  changes.
- *Verification:* the full e2e and Robot suites, especially `collaboration`,
  `websocket-auth` and `enter-progression`.

## Risks / Trade-offs

- [Tiptap 3.23 → 3.32 or Y.js/y-websocket bumps change collaboration behaviour,
  and the sync layer is on the Do-Not-Touch list] → Versions only, no config
  edits. Batch 4 runs on its own and must pass `collaboration.spec.ts`,
  `websocket-auth.spec.ts`, `enter-progression.spec.ts` and the Robot suites
  before the change moves on. If it fails, roll back batch 4 and split Tiptap
  from Y.js.
- [Next 16.2 → 16.4 changes `proxy.ts`/middleware or custom-server behaviour
  in `server.js`] → Covered by the auth-gate and session-access e2e specs. Read
  the Next 16.3/16.4 release notes for custom-server and proxy changes before
  batch 3.
- [The D9 provider-lifecycle change touches the Do-Not-Touch sync layer] → One
  hook and one guard line, no Tiptap/Y.js configuration. The collaboration e2e
  and Robot suites gate it.
- [Prisma 7.10 generated-client differences] → Regenerate both clients. The
  `lint:schema-parity` and `typecheck` gates catch drift. No migrations are
  generated or run.
- [Prisma 7.10 resolves the config `schema` path differently, which breaks the
  Postgres commands, including `db:migrate:prod`] → D8 fixes the path. The owner
  confirms with `prisma migrate status` against Postgres before the next deploy.
- [lint-staged 17 needs Node ≥ 22.22.1] → Local Node is 22.23.4. CI's
  `node-version: '22'` resolves to the latest 22.x. Check the CI log on the
  first run.
- [Playwright 1.64 needs new browser builds] → CI already runs
  `playwright install`, and its cache key hashes `pnpm-lock.yaml`. Locally,
  re-run `pnpm exec playwright install chromium`. Robot's Browser library bundles
  its own Playwright, so it is unaffected.
- [Holding `@auth/core` at 0.41.2 leaves the NFKC email-normalisation fix
  unapplied. The app uses magic-link email sign-in, so the homoglyph `@` bypass
  applies to it] → Recorded as a known follow-up in the proposal. The user chose
  to hold.
- [Closing Dependabot PRs is outward-facing] → Done only after the branch is
  green, and confirmed with the user at that point.

## Migration Plan

No data or runtime migration. Rollback is reverting the branch's
`package.json` / `pnpm-lock.yaml` changes, which are independent of the
config/CI/gate changes. After merge, confirm the next Dependabot run parses the
config (Insights → Dependency graph → Dependabot shows no config error) and that
any dependency PR shows a `ci` check. Also confirm that the next Dependabot PR
lists `deniskrizanovic` as assignee, and that its notification email arrives
(this needs Email enabled for Participating in the owner's account settings).

## Open Questions

- Should a follow-up issue be opened for `next-auth@5.0.0-beta.32` +
  `@auth/core@0.41.3` + `@auth/prisma-adapter@2.11.3` (security fixes)?
  Recommended. To be raised with the user when this change is reported.
