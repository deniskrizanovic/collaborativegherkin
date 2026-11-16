## MODIFIED Requirements

### Requirement: Rules are suppressed with oxlint comments

A deliberate rule exception in project source SHALL be written as an
`oxlint-disable-next-line <rule>` or `oxlint-disable <rule>` /
`oxlint-enable <rule>` comment that names the oxlint rule and says why.
Project source SHALL NOT contain `eslint-disable` comments.

#### Scenario: A named suppression silences only its rule
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — oxlint-disable-next-line suppresses the named rule
- **GIVEN** a TSX component with an `<img>` element preceded by `oxlint-disable-next-line nextjs/no-img-element`, and an unused local variable on a later line
- **WHEN** the lint runs on that file
- **THEN** it reports the unused variable and does not report the `<img>` element

#### Scenario: No ESLint suppression comments remain in project source
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — no eslint disable directives in project source
- **GIVEN** the tracked TypeScript and JavaScript files in the repository
- **WHEN** they are searched for `eslint-disable`
- **THEN** no file contains it

### Requirement: Application code does not call console

`.oxlintrc.json` SHALL enable `no-console` as an error for files under `src/`,
so application code logs through the Pino logger (`src/lib/logger.ts`). Test
files (`*.test.*`, `*.spec.*`) under `src/` SHALL be exempt. Files outside
`src/`, such as `scripts/` (including the database seed), `server.js` and
`e2e/`, SHALL NOT be checked by this rule.

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

## REMOVED Requirements

### Requirement: Lint scope excludes generated and tool output
**Reason**: Drizzle generates no client code, so `src/generated/**` no longer exists and its exclusion has nothing to cover.
**Migration**: Replaced by "Lint scope excludes tool output", which keeps the `next-env.d.ts` and tool-output exclusions.

## ADDED Requirements

### Requirement: Lint scope excludes tool output

The lint SHALL respect the repository's Git ignore files. It SHALL also
exclude `next-env.d.ts`, even though it is tracked, and the gitignored test and
tool output directories (`test-results/`, `playwright-report/`, `.venv/`,
`robot/results/`).

#### Scenario: Next.js type declarations are not linted
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../../../scripts/oxlint-config.test.ts) — ignores next-env.d.ts
- **GIVEN** a directory linted with the project config that contains a `next-env.d.ts` which declares an unused variable and has no suppression header
- **WHEN** the lint runs on the whole directory
- **THEN** it reports no diagnostics for `next-env.d.ts`
