Work on branch `collaborativegherkin-44`. Do not commit until the user asks.
Batches 3–6 end with a check run that must be green before the next batch
starts. On a red run, stop and report; do not work around it (see design D2).
The auth trio (`next-auth`, `@auth/core`, `@auth/prisma-adapter`) and the ESLint
major MUST NOT move in this change.

## 1. Dependabot config and gate

- [x] 1.1 Write `scripts/lint-dependabot.test.ts` first (red), with explicit file-content injection and no `vi.mock`. Cover: valid config passes; `- "minor"W` reports a parse error with its line; missing file is a violation; an ignore entry cited in ADR 0004 passes; an ignore entry for `left-pad` (not in the ADR) is a violation naming `left-pad`; backtick matching does not let `eslint` be satisfied by `eslint-config-next` alone; an update entry with `assignees: ["deniskrizanovic"]` passes; an update entry with no `assignees` is a violation naming its ecosystem; a `reviewers` key is a violation reported as a retired option.
- [x] 1.2 Add `yaml` as a direct devDependency (`pnpm add -D yaml`).
- [x] 1.3 Implement `scripts/lint-dependabot.mjs` per design D4, following the structure and header-comment style of `scripts/lint-schema-parity.mjs`. Include the assignee and `reviewers` checks (design D7). Make 1.1 green.
- [x] 1.4 Add a `lint:dependabot` script to `package.json` and include it in `test:all`'s `run-p` list.
- [x] 1.5 Run `pnpm lint:dependabot` against the current repo and confirm it fails on the `"minor"W` line (this proves the gate catches the real bug).
- [x] 1.6 Fix `.github/dependabot.yml`: remove the stray `W`. Add `ignore` entries for `eslint` (`version-update:semver-major`), `@auth/core` (all updates), and `@auth/prisma-adapter` (all updates). Keep the `next-auth` semver-major entry. Add `assignees: ["deniskrizanovic"]` to the `npm` entry and remove the `reviewers:` block (design D7).
- [x] 1.7 Update `docs/adr/0004-latest-stable-dependency-principle.md`. Add an `eslint` exception section with the design D6 re-check signal. Extend the `next-auth` exception to state that `` `@auth/core` `` and `` `@auth/prisma-adapter` `` are held in lockstep with it and move only together with a `next-auth` upgrade.
- [x] 1.8 `pnpm lint:dependabot` passes.

## 2. Wire the gate and widen CI triggers

- [x] 2.1 Add `pnpm run lint:dependabot` to `.husky/pre-commit` with a sibling comment (pure filesystem, no network), matching the existing entries.
- [x] 2.2 Add a `Lint Dependabot config` step to `.github/workflows/ci.yml` after `Lint schema parity`.
- [x] 2.3 Add `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/**`, `eslint.config.mjs`, `tsconfig.json`, `next.config.*`, `vitest.config.*`, `playwright.config.*` and `server.js` to both the `push` and `pull_request` `paths` lists in `ci.yml` (design D5).
- [x] 2.4 Verify `ci.yml` and `dependabot.yml` still parse (`pnpm lint:dependabot`, plus a `yaml` parse of `ci.yml`).

## 3. Batch 1: Dev tooling

- [x] 3.1 Record a baseline with `pnpm outdated` (saved to the apply-run notes, not committed) and `pnpm why @auth/core`, which should show exactly one version, 0.41.2.
- [x] 3.2 Pin `@auth/prisma-adapter` exactly at `2.11.2` in `package.json` (design D3).
- [x] 3.3 Run `pnpm update @playwright/test @types/jsdom @types/node @types/react @types/react-dom @types/ws eslint eslint-config-next prisma tsx vitest typescript jsdom husky npm-run-all2` (stays within each current major; ESLint stays 9.x).
- [x] 3.4 Run `pnpm add -D lint-staged@^17`. Read the lint-staged 17 changelog and confirm the `package.json` `lint-staged` block needs no change.
- [x] 3.5 Run `pnpm exec playwright install chromium`.
- [x] 3.6 **Check:** `pnpm typecheck && pnpm lint && pnpm test -- --run` green. Stage a `.ts` file and run `pnpm exec lint-staged` to confirm lint-staged 17 works.

## 4. Batch 2: Data layer

- [x] 4.1 Run `pnpm update @prisma/client @prisma/adapter-better-sqlite3 @prisma/adapter-pg prisma`.
- [x] 4.2 Change `prisma/postgres/prisma.config.ts` `schema` to `"schema.prisma"` (design D8: Prisma 7.10 resolves it relative to the config file). Confirm `prisma validate --config prisma/postgres/prisma.config.ts` passes.
- [x] 4.3 Run `pnpm db:generate:postgres && ./node_modules/.bin/prisma generate`, SQLite last so the tracked client stays SQLite (design D8). Generate or run no migrations.
- [x] 4.4 **Check:** `pnpm typecheck && pnpm lint:schema-parity && pnpm test -- --run` green.

## 5. Batch 3: Framework

- [x] 5.1 Read the Next.js 16.3 and 16.4 release notes for changes affecting custom servers (`server.js`), `proxy.ts`, or the App Router APIs in use. Note any findings in the apply-run report.
- [x] 5.2 Run `pnpm update next @next/env eslint-config-next react react-dom zod nsw-design-system @fontsource/public-sans pino pino-pretty dotenv react-markdown remark-gfm`.
- [x] 5.3 **Check:** `pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build` green.

## 6. Batch 4: Collaboration (Do-Not-Touch area: versions only, no config edits; one lifecycle fix, design D9)

- [x] 6.1 Run `pnpm update @tiptap/core @tiptap/extension-collaboration @tiptap/pm @tiptap/react @tiptap/starter-kit yjs y-websocket y-protocols lib0 ws`. Leave `@tiptap/extension-collaboration-cursor` at `^3.0.0`.
- [x] 6.2 Run `pnpm dedupe` (lockfile only), because `pnpm update` leaves transitive `prosemirror-*` on older versions and a second `prosemirror-model` breaks the editor. Confirm `pnpm why` reports one version each of `@tiptap/core`, `prosemirror-model`, `prosemirror-state`, `prosemirror-transform` and `prosemirror-view`, and that `git diff` touches no file under `src/` other than the regenerated `src/generated/prisma/` from batch 2.
- [x] 6.3 Create and destroy the `WebsocketProvider` inside the effect in `src/components/useCollabProvider.ts`, and skip the seed effect in `GherkinEditor.tsx` until the provider exists (design D9: Next 16.4 StrictMode destroyed the bound provider). Restore `next` and `@next/env` to `^16.4.3` after the bisect.
- [x] 6.4 **Check:** `pnpm typecheck && pnpm lint && pnpm test -- --run` green, then `pnpm test:e2e` and `pnpm test:robot` green, with particular attention to `collaboration`, `websocket-auth` and `enter-progression`.

## 7. Final verification

- [x] 7.1 `pnpm why @auth/core` shows exactly one version (0.41.2). `package.json` still has `next-auth` `5.0.0-beta.31`, `@auth/core` `0.41.2`, `@auth/prisma-adapter` `2.11.2`, and `eslint` `^9.x`.
- [x] 7.2 `pnpm outdated` lists only expected leftovers: `eslint` 10, the auth trio, and any major not in scope. Record the list in the report.
- [x] 7.3 `pnpm install --frozen-lockfile` succeeds from a clean `node_modules`.
- [x] 7.4a Run `typecheck` before the parallel group in `test:all` (`run-s typecheck && run-p ...`). Under Next 16.4 the e2e dev server regenerates `.next/dev/types/`, which `tsconfig.json` includes, so a concurrent `tsc` failed with TS6053 "file not found". CI runs these steps sequentially and is unaffected.
- [x] 7.4 `pnpm test:all` green (includes `lint:dependabot`, `lint:specs`, `lint:given`, `lint:issue-link`, e2e and Robot).
- [x] 7.5 Report to the user: the versions moved, the leftovers, the Next release-note findings, and the open question about a follow-up issue for `next-auth@5.0.0-beta.32` with the `@auth/core` 0.41.3 security fixes. Remind the user to enable Email for "Participating, @mentions and custom" and for "Dependabot alerts" under github.com Settings → Notifications, so that the assignment from D7 reaches their inbox.
- [x] 7.6 **STOP for user review.** After the user approves, and only on their explicit instruction, close Dependabot PRs #41, #18 and #17 with a comment linking issue #44 (`GH_HOST=github.com gh pr close N --comment ...`). Never tick this task yourself.
