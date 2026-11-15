# ADR 0007 — oxlint Replaces ESLint

**Status:** Accepted  
**Date:** 2026-11-13

## Context

The project linted with ESLint 9 through `eslint-config-next` (`core-web-vitals` + `typescript`). That preset pulls in six plugins whose `eslint` peer ranges held ESLint at 9.x, which was a standing exception to ADR 0004 plus a Dependabot ignore rule (issue #61).

ADR 0006 planned a hybrid move to oxlint: `eslint-plugin-oxlint` would turn off the ESLint rules oxlint already covered, and ESLint would keep the rules oxlint lacked, `react-hooks/set-state-in-effect` and `@next/next/no-img-element`. oxlint 1.93 ships both (`react/set-state-in-effect`, `nextjs/no-img-element`), along with the React Compiler rules the preset enables. A config copying the preset's rule set linted the repository clean, and it honored the existing suppression comments.

## Decision

**oxlint is the only linter.** `eslint`, `eslint-config-next` and `eslint.config.mjs` are removed. The hybrid period is dropped, because no rule still needs ESLint. Keeping ESLint would also keep the six plugins, their hold on ESLint 9 and two suppression syntaxes.

`pnpm lint` runs `oxlint --max-warnings=0`, so any warning fails the lint. It runs in the `lint-staged` pre-commit task for `*.{ts,tsx}` (after Biome), in the CI "Lint" step and in `test:all`.

### Parity rule set, categories off

`.oxlintrc.json` is an explicit rule list generated once from `eslint --print-config` on a `.tsx`, a `.test.ts` and a `.js` file. Each active rule maps to its oxlint name (`@typescript-eslint/*` to `typescript/*`, with the extension rules `no-unused-vars`, `no-unused-expressions` and `no-array-constructor` mapped to the core names; `@next/next/*` to `nextjs/*`; `react-hooks/*` to `react/*`). Severities and options are kept. The project's two local rules stay: `no-unused-vars` ignores `_`-prefixed arguments, and `typescript/no-explicit-any` is off in `*.test.*` / `*.spec.*` files. `no-var`, `prefer-const`, `prefer-rest-params` and `prefer-spread` apply to TypeScript files only, as they did under typescript-eslint.

Every oxlint rule category is `off`, so only the listed rules report. Turning on a category such as `correctness` (which would flag the modal backdrops in `SessionView.tsx`) or type-aware linting is a separate, deliberate change.

### Accepted coverage gaps

These preset rules have no oxlint equivalent and are dropped. None of them matters to this codebase:

- `@next/next/no-location-assign-relative-destination`: the code never calls `location.assign`/`replace` or sets `location.href`.
- `react/no-deprecated`: React 19 removed those legacy APIs, and `tsc` rejects them.
- `react-hooks/config` and `react-hooks/gating`: these validate React Compiler options, which the project does not configure.

`react/jsx-uses-react` and `react/jsx-uses-vars` are not needed, because oxlint's `no-unused-vars` already counts JSX usage. A later oxlint release that adds any of these rules can bring it back.

### Exact version pin

`oxlint` is pinned to an exact version in `package.json`. With every warning failing the lint, a release that changes what a rule reports could break CI, so the change shows up only in the Dependabot PR that bumps the pin. This matches the Biome pin (ADR 0006).

### Suppression syntax

A deliberate exception is written as `oxlint-disable-next-line <rule>` or `oxlint-disable <rule>` / `oxlint-enable <rule>`, naming the oxlint rule and saying why. Project source has no `eslint-disable` comments. The generated Prisma client keeps its generated `/* eslint-disable */` header, and it is excluded from lint scope anyway.

## Consequences

- This ADR supersedes the "Next step: oxlint" section of ADR 0006.
- The ADR 0004 `eslint` exception and its Dependabot ignore are removed. `unrs-resolver` leaves `pnpm-workspace.yaml` `allowBuilds`, because only the ESLint import resolver needed it.
- Contributors whose editor runs the ESLint extension should install the oxlint extension instead.
- An oxlint port can report slightly different cases than the ESLint rule it replaces. Parity was checked on the code at the time of the switch (no diagnostics either way); later differences show up in the PR that causes them.
