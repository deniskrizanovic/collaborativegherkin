# Dependency Upgrade to Latest Stable Versions

**Created:** 2026-05-25T11:03

## Context

The project has drifted from latest stable versions across most of its major dependencies. The goal is to get every package onto its latest stable major version, establishing a baseline that aligns with the principle "this project tracks latest stable LTS." NextAuth v5 beta is a documented exception — it was adopted in error and rollback cost exceeds benefit.

A Dependabot config (`dependabot.yml`) currently blocks major Tiptap bumps; that exception contradicts the new principle and must be removed.

The upgrade is split into atomic steps. Every step ends with a full test run before proceeding. If a step's test run fails, it is fixed before moving to the next step — never carry a red test suite forward.

---

## Packages to upgrade

| Package | Current | Target | Notes |
|---|---|---|---|
| `ws` | 8.20.1 | 8.21.0 | Minor only |
| `vitest` | 2.1.9 | 4.x latest | Two major jumps |
| `typescript` | 5.9.3 | 6.x latest | Major |
| `@types/node` | 22.x | 22.x latest | **Stay on 22** — runtime is Node 22 LTS; `@types/node@25` would be ahead of the runtime |
| `eslint` | 9.x | 10.x latest | Major |
| `eslint-config-next` | 15.x | 16.x latest | Must move with Next.js |
| `pino` | 9.14.0 | 10.x latest | Major |
| `pino-pretty` | 13.x | latest | Move with pino |
| `zod` | 3.25.76 | 4.x latest | Major — schema API changes |
| `@tiptap/core` + all `@tiptap/*` | 2.27.2 | 3.x latest | Major — remove Dependabot pin first |
| `next` | 15.5.18 | 16.x latest | Major — largest blast radius |
| `next-auth` | 5.0.0-beta.31 | **skip** | ADR exception |

---

## Step 0 — [ ] Write ADR

**File:** `docs/adr/0004-latest-stable-dependency-principle.md`

Content:
- **Principle:** This project targets the latest stable (LTS where applicable) version for all dependencies.
- **Exception:** `next-auth` is pinned to v5 beta. v5 was adopted in error (v4 was the correct stable choice at the time). Rolling back to v4 now would require rewriting the auth configuration; the cost exceeds the benefit. This exception should be revisited when NextAuth v5 reaches stable.
- **Remove:** The Dependabot major-version exception for `@tiptap/*` packages in `dependabot.yml` — it contradicts this principle.

No code changes. No test run needed.

---

## Step 1 — [ ] Remove Dependabot Tiptap exception

**File:** `.github/dependabot.yml`

Remove the `ignore` rule blocking major `@tiptap/*` bumps (added in commit `5025cb1`).

**Test run:** none required (config-only change).

---

## Step 2 — [ ] `ws` patch

```bash
npm install ws@latest --save-dev
```

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 3 — [ ] Vitest 2 → 4

Upgrade the test runner first so all subsequent test runs use the latest runner.

```bash
npm install vitest@latest --save-dev
```

Check Vitest 4 changelog for breaking changes in config or test API. `vitest.config.ts` is minimal (node environment, include glob, path alias) — likely no changes needed, but verify.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 4 — [ ] TypeScript 5 → 6 + `@types/node`

```bash
npm install typescript@latest @types/node@22 --save-dev
```

Note: `@types/node` stays on the `22` major to match the Node 22 LTS runtime. Do not jump to `@types/node@25`.

TypeScript 6 may tighten strictness — fix any new type errors before proceeding.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 5 — [ ] ESLint 9 → 10

```bash
npm install eslint@latest --save-dev
```

ESLint 10 continues the flat config format from v9 — `eslint.config.mjs` should not need structural changes, but check for any deprecated rules.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 6 — [ ] Pino 9 → 10 + pino-pretty

```bash
npm install pino@latest pino-pretty@latest
```

Check Pino 10 changelog for logger API changes. Usage is centralised in `src/lib/logger.ts` — one file to audit.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 7 — [ ] Zod 3 → 4

```bash
npm install zod@latest
```

Zod 4 has breaking changes to the schema API. Audit all files importing from `zod` — search with `grep -r "from 'zod'" src/`.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 8 — [ ] Tiptap 2 → 3

```bash
npm install @tiptap/core@latest @tiptap/extension-collaboration@latest @tiptap/extension-collaboration-cursor@latest @tiptap/pm@latest @tiptap/react@latest @tiptap/starter-kit@latest
```

Tiptap 3 has breaking changes to extension API and configuration. All Tiptap usage is in `src/components/GherkinEditor.tsx`. Read the Tiptap 3 migration guide before editing.

After upgrading, verify real-time collaboration manually (open two browser tabs, confirm Y.js sync still works) in addition to the automated test run.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Step 9 — [ ] Next.js 15 → 16 + `eslint-config-next`

The largest blast radius step — done last so all other packages are stable first.

```bash
npm install next@latest eslint-config-next@latest
```

Also update `@types/react` and `@types/react-dom` if needed for Next 16 compatibility:
```bash
npm install @types/react@latest @types/react-dom@latest --save-dev
```

Check Next.js 16 migration guide for App Router changes, changed APIs, or dropped Node.js version requirements.

**Test run:**
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

---

## Critical files

- `src/components/GherkinEditor.tsx` — all Tiptap usage
- `src/lib/logger.ts` — all Pino usage
- `src/lib/gherkin.ts` — Zod usage (Do Not Touch the validation rules, only fix API changes if Zod 4 requires it)
- `src/app/api/**` — Zod usage in request validation
- `vitest.config.ts` — may need updates for Vitest 4
- `eslint.config.mjs` — may need updates for ESLint 10
- `.github/dependabot.yml` — remove Tiptap major-version exception

## Verification (final)

After all steps pass individually, do one final full run:
```bash
npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e
```

Then open the app manually and verify:
1. Session list loads
2. Create a new session
3. Open in two tabs — confirm real-time collaboration sync still works
4. Export works

---

## Implementation notes (completed 2026-05-25)

**Final result:** 96 e2e passed, 1 skipped, 177 unit tests passed, 0 failures.

### Deviations and additional fixes required

| Issue | Root cause | Fix |
|---|---|---|
| Vitest 4 constructor mocks | Arrow functions no longer accepted for `mockImplementation` of constructors | Changed to `function () { return ... }` in `llm-settings/route.test.ts` and `llm-review/route.test.ts` |
| TypeScript 6 CSS side-effect imports | TS6 now errors on `import "@fontsource/..."` and `import "*.css"` without type declarations | Added `src/types/declarations.d.ts` |
| ESLint 10 blocked | `eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y` (bundled in `eslint-config-next@16`) have not shipped ESLint 10 support | Stayed on ESLint 9 — revisit when Next.js ecosystem catches up |
| `eslint-config-next@16` drops `FlatCompat` | v16 exports native flat config arrays only; `FlatCompat` bridge causes circular JSON crash | Rewrote `eslint.config.mjs` to import `coreWebVitals` and `nextTypescript` directly |
| New `react-hooks/refs` rule | `eslint-config-next@16` ships a newer `react-hooks` plugin that forbids reading `ref.current` in render body | Rewrote `useCollabProvider.ts` to use `useState` lazy initializers instead of ref-in-render pattern |
| Tiptap 3 `StarterKit` renames `history` → `undoRedo` | Breaking rename in StarterKit options | Updated `GherkinEditor.tsx` |
| Tiptap 3 `getPos()` returns `number \| undefined` | Stricter types in NodeView API | Added `!` assertions in `GherkinDataTable.tsx` (guarded by `typeof getPos !== "function"` check above) |
| `@tiptap/extension-collaboration-cursor` incompatible with Tiptap 3 | Package has no Tiptap 3 stable release; its `3.0.0` stable still depends on `y-prosemirror` while Tiptap core 3 uses `@tiptap/y-tiptap` — two different `PluginKey` instances cause a crash | Removed the extension entirely; `SC-3.5.2` cursor colour test skipped with explanatory comment |
| Tiptap 3 `useEditor` no longer re-renders on selection change | Breaking change in `@tiptap/react` v3: selection updates do not trigger re-renders unless explicitly subscribed | Added `useEditorState` selector in `GherkinEditor.tsx` to subscribe to `getCurrentBlockType` / `getPreviousBlockType` for toolbar re-renders |
| Tiptap 3 StarterKit new default extensions | v3 adds `trailingNode`, `link`, and `underline` by default; `trailingNode` appended a phantom paragraph affecting block detection | Disabled `trailingNode: false`, `link: false`, `underline: false` in StarterKit config |
