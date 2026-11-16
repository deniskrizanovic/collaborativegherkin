## ADDED Requirements

### Requirement: Complexity measurement does not depend on the TypeScript compiler API

The gate SHALL find functions and measure their cyclomatic complexity without
importing the `typescript` package. Its scores SHALL NOT change when the
installed TypeScript version changes, including a TypeScript release that
ships no JavaScript compiler API.

#### Scenario: The gate runs with a TypeScript release that has no compiler API
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — does not import the typescript package
- **GIVEN** the project depends on a `typescript` release whose package exposes no JavaScript compiler API
- **WHEN** the CRAP gate's unit tests run
- **THEN** they load the gate and pass

#### Scenario: Swapping the parser leaves every score unchanged
> **Tests:** none — manual check: `diff` of `pnpm lint:crap --all` output before and after the swap (design D6)
- **GIVEN** the `pnpm lint:crap --all` report produced on the current tree before the parser swap
- **WHEN** the gate runs with `--all` on the same tree after the swap
- **THEN** every function appears with the same name, file, line, complexity, coverage and score

### Requirement: The gate reads TypeScript and TSX source

The gate SHALL parse `.ts` files as TypeScript and `.tsx` files as TypeScript
with JSX. Type-only syntax (annotations, generics, `as`, `satisfies`, non-null
`!`, enums, interfaces and type aliases) SHALL NOT add decision points.
Bodiless signatures (function and method overload signatures, `declare`
functions and abstract methods) SHALL NOT be scored. In a `.ts` file, an
angle-bracket type assertion (`<T>value`) SHALL parse as a type assertion,
not as JSX.

#### Scenario: Type syntax adds no complexity
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — adds no complexity for type annotations, generics, as, satisfies and non-null
- **GIVEN** a function with typed parameters, a generic type parameter, an `as` cast, a `satisfies` check, a non-null `!` and a single `if`
- **WHEN** the gate measures its complexity
- **THEN** its cyclomatic complexity is 2

#### Scenario: Overload signatures are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — skips overload signatures and declare functions
- **GIVEN** a file declaring two overload signatures for `parse` followed by one implementation, and a `declare function` with no body
- **WHEN** the gate measures the file
- **THEN** it reports exactly one function, the `parse` implementation

#### Scenario: A TSX component is scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — scores a TSX component with a JSX conditional
- **GIVEN** a `.tsx` file exporting a component that renders JSX inside a `cond ? <A /> : <B />` expression
- **WHEN** the gate measures the file
- **THEN** it reports the component by name with cyclomatic complexity 2

#### Scenario: An angle-bracket assertion in a .ts file is not JSX
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — parses an angle-bracket assertion in a .ts file
- **GIVEN** a `.ts` file whose function returns `<string>value`
- **WHEN** the gate measures the file
- **THEN** it reports that function with cyclomatic complexity 1

### Requirement: A source file the gate cannot parse fails the run

When a file in scope cannot be parsed, the gate SHALL NOT report any score.
It SHALL print the file's path and the parse error's line and column, and
exit 2.

#### Scenario: A syntax error stops the gate
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — throws a parse error naming the file, line and column; reports an unparseable file and exits 2
- **GIVEN** a source tree in which `src/lib/broken.ts` contains a syntax error on line 3
- **WHEN** the gate runs
- **THEN** it reports `src/lib/broken.ts` with line 3 as unparseable, lists no scores, and exits 2
