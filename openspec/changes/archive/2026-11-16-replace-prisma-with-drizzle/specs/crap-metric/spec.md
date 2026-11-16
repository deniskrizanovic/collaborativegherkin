## REMOVED Requirements

### Requirement: The gate scores application code under src/
**Reason**: Its exclusion names the generated Prisma client (`src/generated/`), which this change deletes.
**Migration**: Replaced by "The gate scores source files under src/", which keeps the test, declaration and outside-`src/` exclusions.

## ADDED Requirements

### Requirement: The gate scores source files under src/

The gate SHALL score every `.ts` and `.tsx` file under `src/`. It SHALL skip
test files (`*.test.*`, `*.spec.*`) and type declaration files (`*.d.ts`).
Files outside `src/` SHALL NOT be scored.

#### Scenario: Test files are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations and scripts/
- **GIVEN** a complex untested function in `src/lib/session.test.ts`
- **WHEN** the gate runs
- **THEN** that function does not appear in its report and does not affect its exit code

#### Scenario: Scripts outside src/ are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations and scripts/
- **GIVEN** a complex untested function in a file under `scripts/`
- **WHEN** the gate runs
- **THEN** that function does not appear in its report
