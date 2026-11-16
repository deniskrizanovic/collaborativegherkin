## MODIFIED Requirements

### Requirement: The whole tree is formatted with one command

A `format` script SHALL format and sort imports, with write mode, in every
in-scope file in the repository. It SHALL leave out-of-scope files (Markdown,
YAML, Drizzle migration metadata, `next-env.d.ts` and Git-ignored files)
unchanged.

#### Scenario: Off-style files anywhere in the tree are rewritten
> **Tests:** none
- **GIVEN** two off-style TypeScript files in different directories, neither of them staged or changed since `main`
- **WHEN** the developer runs `pnpm format`
- **THEN** both files are in house style

#### Scenario: Out-of-scope files are untouched by the format script
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores Markdown and YAML; ignores Drizzle migration metadata
- **GIVEN** an OpenSpec `spec.md` file and a JSON file under `drizzle/pg/meta/`
- **WHEN** the developer runs `pnpm format`
- **THEN** neither file's content changes

## REMOVED Requirements

### Requirement: Formatting scope is limited to source and config code
**Reason**: Its exclusion names the generated Prisma client (`src/generated/**`), which this change deletes.
**Migration**: Replaced by "Formatting covers source and config code only", which keeps the Markdown/YAML and `next-env.d.ts` exclusions and excludes Drizzle migration metadata instead.

## ADDED Requirements

### Requirement: Formatting covers source and config code only

Biome SHALL process only TypeScript, TSX, JavaScript (`.js`, `.mjs`, `.cjs`),
JSON/JSONC and CSS files. It SHALL NOT format Markdown or YAML, because the
spec gates (`lint:specs`, `lint:given`, `lint:robot-steps`) parse OpenSpec
Markdown and `lint:dependabot` parses `.github/dependabot.yml`. It SHALL
respect the repository's Git ignore files and SHALL exclude the Drizzle
migration metadata that `drizzle-kit` writes (`drizzle/**/meta/**`) and
`next-env.d.ts`.

#### Scenario: Spec Markdown is out of scope
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores Markdown and YAML
- **GIVEN** an OpenSpec `spec.md` file and `.github/dependabot.yml`
- **WHEN** Biome is asked to check both files
- **THEN** Biome processes neither file and reports no problems

#### Scenario: Drizzle migration metadata is out of scope
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores Drizzle migration metadata
- **GIVEN** a JSON file under `drizzle/sqlite/meta/` that is not in house style
- **WHEN** Biome is asked to check that file
- **THEN** Biome processes no file and reports no problems
