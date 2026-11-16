## ADDED Requirements

### Requirement: Application code does not call console

`.oxlintrc.json` SHALL enable `no-console` as an error for files under `src/`,
so application code logs through the Pino logger (`src/lib/logger.ts`). Test
files (`*.test.*`, `*.spec.*`) under `src/` SHALL be exempt. Files outside
`src/`, such as `scripts/`, `server.js`, `prisma/seed.ts` and `e2e/`, SHALL NOT
be checked by this rule.

#### Scenario: A console call in application code is reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — reports a console call in application code
- **GIVEN** a file `src/lib/widget.ts` that calls `console.log`
- **WHEN** the lint runs on that file
- **THEN** it reports `no-console` for that call and exits non-zero

#### Scenario: A console call in a test file is not reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — allows a console call in a src/ test file
- **GIVEN** a file `src/lib/widget.test.ts` that calls `console.log`
- **WHEN** the lint runs on that file
- **THEN** it reports no diagnostics

#### Scenario: A console call outside src/ is not reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — allows a console call outside src/
- **GIVEN** a file `scripts/tool.mjs` that calls `console.error`
- **WHEN** the lint runs on that file
- **THEN** it reports no diagnostics
