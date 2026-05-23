# Plan: Pre-commit hooks (item #8)

**Date:** 2026-05-23  
**Feature:** Add husky + lint-staged to enforce lint and type-checking before every commit

---

## Context

CLAUDE.md prohibits `console.log` in server-side code and relies on TypeScript for correctness, but nothing enforces these rules at commit time. The project improvement recommendations (item #8) call for `husky` + `lint-staged` to catch type errors and lint violations on staged files before they land in git history.

---

## What changes

### 1. Install dependencies

```
npm install --save-dev husky lint-staged
```

### 2. Initialise husky

```
npx husky init
```

This creates `.husky/pre-commit` and adds a `"prepare": "husky"` script to `package.json`. The generated hook file will be replaced in step 3.

### 3. `.husky/pre-commit`

Replace the generated content with:

```sh
#!/usr/bin/env sh
npx lint-staged
```

### 4. `lint-staged` config in `package.json`

Add a top-level `"lint-staged"` key:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --max-warnings=0",
    "bash -c 'tsc --noEmit'"
  ]
}
```

**Why `bash -c 'tsc --noEmit'`:** `tsc --noEmit` must run against the whole project (it reads `tsconfig.json` and checks all included files), not just the files lint-staged passes to it. Wrapping it in `bash -c` prevents lint-staged from appending filenames as arguments, which would cause tsc to ignore `tsconfig.json`.

**Why `--max-warnings=0`:** The existing ESLint config promotes several rules to `error`, but `--max-warnings=0` also catches any warnings that might creep in, keeping the gate strict.

---

## Files touched

| File | Change |
|------|--------|
| `package.json` | adds `husky`, `lint-staged` to `devDependencies`; adds `"prepare": "husky"` script; adds `"lint-staged"` config block |
| `.husky/pre-commit` | new file created by `husky init`, then edited |

No application code changes — this is tooling-only.

---

## Verification

1. **Happy path:** stage a clean `.ts` file and run `git commit` — the hook runs, lint and typecheck pass, commit succeeds.
2. **Lint failure:** introduce a `console.log` in a staged `.ts` file — the hook blocks the commit and prints the ESLint error.
3. **Type error:** add an untyped variable to a staged `.ts` file — the hook blocks the commit and prints the tsc error.
4. **No staged TS files:** commit a non-TS change (e.g. edit `README.md`) — lint-staged skips the checks and the commit proceeds immediately.
5. CI is unaffected — `prepare` only runs `husky` when the `.git` directory is present; husky v9 also skips automatically when the `CI` env var is set, which GitHub Actions sets by default.
