## 1. Install and configure Biome

- [x] 1.1 Confirm the branch is not `main`. Run `pnpm view @biomejs/biome dist-tags --json`, then install the newest stable 2.x the registry allows: `pnpm add -D -E @biomejs/biome@<version>` (design D6). Confirm `package.json` shows the exact version with no `^`/`~`. If pnpm reports a blocked build script, stop and report it; don't add an `allowBuilds` entry unasked.
- [x] 1.2 Create root `biome.json` (design D1–D3):
  - `$schema` set to `./node_modules/@biomejs/biome/configuration_schema.json`;
  - `vcs` with `enabled`, `clientKind: "git"`, `useIgnoreFile: true`, `defaultBranch: "main"`;
  - `files.includes` as the extension allowlist `**/*.{ts,tsx,js,mjs,cjs,json,jsonc,css}`, plus force-ignore for `src/generated` and an ignore for `next-env.d.ts`;
  - `formatter` with `enabled: true`, `indentStyle: "space"`, `indentWidth: 2`, `lineWidth: 100`;
  - `javascript.formatter` with `quoteStyle: "double"`, `semicolons: "always"`;
  - `linter.enabled: false`;
  - `assist.actions.source.organizeImports: "on"`.
- [x] 1.3 Check the scope by hand. Each of these must report zero files processed:
  - `pnpm exec biome check openspec/specs/gherkin-editor/spec.md`;
  - `pnpm exec biome check .github/dependabot.yml`;
  - `pnpm exec biome check src/generated/prisma/client.ts`.
- [x] 1.4 Check the style match without writing: run `pnpm exec biome format src/app/layout.tsx src/lib/logger.ts` and read the reported diff. Expect only long-line wraps or import order changes, not quote, semicolon or indent changes. If quotes, semicolons or indentation would change, adjust `biome.json` before continuing. Confirm side-effect CSS imports in `layout.tsx` keep their position (design Risks).

## 2. Config test (write first, expect failures until wiring is done)

- [x] 2.1 Create `scripts/biome-config.test.ts`. It runs `node_modules/.bin/biome` via `execFileSync` with no shell and no `vi.mock` (design D7). Cover each scenario in `specs/code-formatting/spec.md` that cites this file:
  - an unused-variable fixture produces no diagnostics;
  - `@biomejs/biome` is pinned exactly;
  - single-quoted, tab-indented, semicolon-free input formats to house style;
  - unsorted imports get sorted;
  - a house-style fixture is unchanged;
  - Markdown and YAML are not processed;
  - the `src/generated` file is not processed;
  - in `lint-staged`, the `*.{ts,tsx}` list starts with `biome check --write` before `eslint`;
  - `test:all` and `ci.yml` (parsed with `yaml`) include `lint:format`, and the checkout uses `fetch-depth: 0`.
- [x] 2.2 Run `pnpm test -- --run scripts/biome-config.test.ts`. The style and scope cases should pass, and the wiring cases should fail until section 3 is done.

## 3. Wire into commit hook, scripts and CI

- [x] 3.1 In `package.json`, add `"lint:format": "biome ci --changed --no-errors-on-unmatched"` and add `lint:format` to the `run-p` group in `test:all` (design D5). Do not add a whole-tree `format` script.
- [x] 3.2 In `package.json` `lint-staged`:
  - prepend `biome check --write --no-errors-on-unmatched --files-ignore-unknown=true` to the `*.{ts,tsx}` list;
  - add a disjoint `*.{js,mjs,cjs,json,jsonc,css}` glob that runs the same Biome command (design D4).
- [x] 3.3 In `.github/workflows/ci.yml`:
  - set `fetch-depth: 0` on `actions/checkout`;
  - add a "Lint format" step after "Lint" that computes `BASE` from `github.event.pull_request.base.sha || github.event.before`, falls back to `HEAD^` when it is empty, all zeros, or missing (`git cat-file -e`), and runs `pnpm run lint:format --since="$BASE"`;
  - add `biome.json` to both `paths` filters.
- [x] 3.4 Re-run `pnpm test -- --run scripts/biome-config.test.ts`. All cases pass.

## 4. Verify behaviour by hand (scenarios marked `Tests: none`)

- [x] 4.1 Staged-only formatting:
  - edit a scratch `.ts` file under `src/` so it uses single quotes, and stage it;
  - leave a second off-style file unstaged;
  - run `pnpm exec lint-staged`;
  - confirm the staged file now uses double quotes and the unstaged file is byte-identical;
  - revert both.
- [x] 4.2 Changed-file check:
  - on the feature branch, commit a scratch off-style `.ts` change to a throwaway local branch;
  - run `pnpm lint:format` and confirm it names the file and exits non-zero;
  - with only a formatted change, confirm it exits zero even though other off-style files exist;
  - delete the throwaway branch.
- [x] 4.3 On a branch whose diff against `main` has no in-scope files, `pnpm lint:format` exits zero.

## 5. Documentation

- [x] 5.1 Write `docs/adr/0006-biome-formatter-tool-split.md` in the ADR 0004 format (Status, Date, Context, Decision, Consequences). Cover (design D8):
  - Biome formats only and the linter lints;
  - Markdown and YAML are excluded, and why;
  - adoption is staged-only, with no bulk reformat;
  - next step: oxlint, with `eslint-plugin-oxlint` cutting ESLint down to the rules oxlint lacks.
- [x] 5.2 Update `CLAUDE.md`: add Biome (formatter) to Stack, and add `pnpm lint:format` to Key commands.
- [x] 5.3 Update `README.md`: add a `pnpm lint:format` row to the command table, plus a short note on the manual fix (`pnpm exec biome check --write <path>`) and the Biome IDE plugin.

## 6. Full verification

- [x] 6.1 Run `pnpm lint` and confirm ESLint passes on the files Biome formatted in this change.
- [x] 6.2 Run `pnpm test:all` and confirm it is green, including the new `lint:format` and the spec gates (`lint:specs`, `lint:given`).
- [x] 6.3 Run `openspec validate introduce-biome-formatter` and confirm no errors.
- [x] 6.4 Report the results and wait for an explicit commit instruction.
