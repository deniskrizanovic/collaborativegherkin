## ADDED Requirements

### Requirement: The report can list every function

With `--all`, the gate's report SHALL list every scored function, worst first,
in the same columns as the offender list. The exit code SHALL still follow the
threshold. `test:all` and CI SHALL run the gate without `--all`.

#### Scenario: All functions are listed when every score passes
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — lists every function when every score passes, and exits zero
- **GIVEN** a source tree whose only function scores 12
- **WHEN** the gate runs with `--all`
- **THEN** its report lists that function with its file, line, complexity, coverage and score of 12, and it exits zero

#### Scenario: Listing all functions still fails on an offender
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — lists an offender above a passing function, and exits non-zero
- **GIVEN** a source tree with one function scoring 42 and another scoring 12
- **WHEN** the gate runs with `--all`
- **THEN** its report lists the 42 function above the 12 function, and it exits non-zero

### Requirement: The report can be limited to one path

With `--file <path>`, the gate's report and exit code SHALL cover only
functions in that file, or in files under that directory. The path is relative
to the working directory, and `--file` SHALL combine with `--all`. When the
path matches no scored file, or an argument is not a known option, the gate
SHALL say why and exit 2. `test:all` and CI SHALL run the gate without
`--file`.

#### Scenario: An offender outside the path does not fail a path run
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — ignores an offender outside a file path, so the run passes
- **GIVEN** a function scoring 42 in `src/lib/a.ts` and a function scoring 12 in `src/lib/b.ts`
- **WHEN** the gate runs with `--file src/lib/b.ts`
- **THEN** its report does not mention `src/lib/a.ts`, and it exits zero

#### Scenario: A directory path covers the files under it
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — covers the files under a directory path, and only those
- **GIVEN** a function scoring 42 in `src/lib/a.ts`
- **WHEN** the gate runs with `--file src/lib`
- **THEN** its report lists that function, and it exits non-zero

#### Scenario: A path matching no scored file is an error
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — reports that no scored file matches the path, and exits 2
- **GIVEN** a source tree with no file under `src/missing/`
- **WHEN** the gate runs with `--file src/missing`
- **THEN** it reports that no scored file matches the path, and it exits 2
