## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/44

## Why

Three Dependabot PRs are open and none can be merged safely as they stand:

- **#41** (minor-and-patch group, 27 updates) has never run CI. The CI workflow's
  `paths` filter covers only `src/**`, `openspec/**`, `prisma/**` and similar, so a
  PR that changes only `package.json` and `pnpm-lock.yaml` triggers nothing. The
  PR is also three weeks old, and newer patch releases have shipped since.
- **#18** (ESLint 9 → 10) fails CI. The plugins that `eslint-config-next` pulls in
  (`eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`) still
  declare peer support only up to ESLint 9.
- **#17** (lint-staged 16 → 17) is green, but its CI result predates the
  path filter and every change since.

Two problems sit under these PRs. First, `.github/dependabot.yml` has been invalid
YAML since `ea7a3e6` (2026-07-08): a stray `W` after `"minor"` breaks the group
list. Dependabot cannot apply a config it cannot parse, so scheduled updates, and
the PR notifications that come with them, have been unreliable since then.
Second, #41 bumps `@auth/core` to 0.41.3 and `@auth/prisma-adapter` to
2.11.3, while `next-auth@5.0.0-beta.31` pins `@auth/core` at exactly `0.41.2`.
Merging #41 would install two copies of `@auth/core`, so the 0.41.3 security fixes
would never reach the sign-in path. The user has decided to hold the auth packages
at their current versions for this change.

## What Changes

- Fix the `.github/dependabot.yml` syntax error. Add `ignore` rules that match the
  documented ADR 0004 exceptions: `eslint` semver-major (new), plus
  `@auth/core` and `@auth/prisma-adapter` all updates, because those two move in
  lockstep with the `next-auth` pin (new). The existing `next-auth` semver-major
  rule stays.
- Assign every Dependabot PR to the owner: add `assignees: ["deniskrizanovic"]`
  to the `npm` update entry, and remove the `reviewers` key, which is no longer a
  documented Dependabot option. Assignment makes the owner a participant, and
  GitHub emails participants. Email delivery itself is a GitHub account
  notification setting and is out of scope for this repo.
- Add a `lint:dependabot` gate (pure filesystem, offline-safe). It parses
  `.github/dependabot.yml` as YAML and fails on any of: a parse error; an
  `ignore` entry whose `dependency-name` is not cited in ADR 0004; an update entry
  without `deniskrizanovic` in `assignees`; a `reviewers` key. Wire it into husky
  pre-commit, CI and `test:all`, alongside `lint:specs`.
- Widen the CI `paths` filter so changes to dependency manifests and build/lint
  configuration trigger CI: `package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `.github/**`, `eslint.config.mjs`, `tsconfig.json`,
  `next.config.*`, `vitest.config.*`, `playwright.config.*`, `server.js`.
- Apply every available minor and patch upgrade, resolved at implementation time
  (newer than #41's snapshot), except the held auth trio. Also take the
  lint-staged 17 major.
- Pin `@auth/prisma-adapter` exactly at `2.11.2` (it is currently `^2.11.2`), so a
  routine `pnpm update` cannot pull in a second `@auth/core`. `next-auth` and
  `@auth/core` are already exact pins.
- Defer ESLint 10. Record it in ADR 0004 as an exception, with the re-check
  signal: every plugin in `eslint-config-next`'s dependency set declares an
  `eslint` peer range that includes `^10`.
- Extend the ADR 0004 `next-auth` exception to say that `@auth/core` and
  `@auth/prisma-adapter` are held in lockstep with it.
- Close #41, #18 and #17 as superseded by this change's branch, with a comment
  linking issue #44 (outward-facing; confirm with the user first).

## Capabilities

### New Capabilities
- `dependency-maintenance`: how the project keeps dependencies current. It covers
  valid Dependabot configuration, every Dependabot `ignore` rule being backed by
  a documented ADR 0004 exception, Dependabot PRs being assigned to the owner,
  and CI running on any PR that changes
  dependency manifests or build/lint configuration.

### Modified Capabilities
<!-- None. Library upgrades do not change existing spec-level behavior; existing
     specs' scenarios are the regression net for the upgrade. -->

## Impact

- **Files:** `.github/dependabot.yml`, `.github/workflows/ci.yml`,
  `.husky/pre-commit`, `package.json`, `pnpm-lock.yaml`,
  `prisma/postgres/prisma.config.ts` (schema path only, design D8),
  regenerated `src/generated/prisma/`,
  `src/components/useCollabProvider.ts` and `src/components/GherkinEditor.tsx`
  (provider lifecycle only, design D9),
  `docs/adr/0004-latest-stable-dependency-principle.md`, new
  `scripts/lint-dependabot.mjs` and `scripts/lint-dependabot.test.ts`.
- **New devDependency:** `yaml` (already in the tree transitively at 2.9.0).
- **Runtime packages upgraded (minor/patch):** Next.js 16.2 → 16.x latest, Tiptap
  3.23 → 3.x latest, React 19.2 → 19.3, Prisma 7.8 → 7.10, Zod 4.4 → 4.6, `yjs`,
  `y-websocket` 3.0 → 3.1, `ws`, `lib0`, `nsw-design-system`, Playwright.
  Tiptap/Y.js configuration is on the Do-Not-Touch list. This change bumps
  versions only and edits no Tiptap/Y.js config; the one sync-layer edit is the
  provider lifecycle fix Next 16.4 needs (design D9). The collaboration e2e and Robot suites are
  the gate.
- **Not changed:** `src/auth.ts`, NextAuth configuration, the `next-auth` /
  `@auth/core` / `@auth/prisma-adapter` versions, ESLint major version,
  `src/lib/gherkin.ts`, Prisma migrations.
- **Known follow-up (out of scope):** the 0.41.3 `@auth/core` security fixes (NFKC
  email normalisation homoglyph bypass, provider-bound OAuth check cookies) stay
  unapplied until `next-auth` moves to `5.0.0-beta.32` in lockstep. The project
  uses Resend magic-link only (no OAuth), so the email-normalisation fix is the
  relevant one.
