## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/71

## Why

Dependabot PR #67 (typescript 6.0.3 → 7.0.2) fails CI. TypeScript 7 is the
native Go port: the `typescript` npm package now ships a `tsc` binary and no
longer exposes the JavaScript compiler API. `scripts/lint-crap.mjs` is the only
file in the repo that imports that API (`ts.SyntaxKind`, `ts.createSourceFile`,
`ts.forEachChild`, `ts.is*`), so `scripts/lint-crap.test.ts` crashes on load
with `TypeError: Cannot read properties of undefined (reading 'IfStatement')`.
`tsc --noEmit` already passes on TypeScript 7.

ADR 0004 commits the project to the latest stable version of every dependency.
The CRAP gate's dependence on a compiler API that TypeScript has dropped blocks
that, and will block every later TypeScript major too.

## What Changes

- Rewrite the function discovery and cyclomatic-complexity measurement in
  `scripts/lint-crap.mjs` on `@babel/parser` instead of the TypeScript
  compiler API. The CRAP formula, the decision points counted, nested-function
  handling, function naming, coverage attribution, report format, options and
  exit codes stay as they are.
- Add `@babel/parser` as an explicit devDependency. It is in the tree today only
  as a transitive dependency of the istanbul coverage tooling.
- A source file the parser cannot read now fails the gate with exit 2, naming
  the file. The TypeScript parser recovered from syntax errors silently; Babel
  throws.
- Add unit cases for TypeScript-only syntax (type annotations, generics,
  overload signatures, `declare`, `satisfies`, `as`, enums, abstract members)
  and for the parse-failure exit, so a parser swap cannot silently change what
  the gate measures.
- No change to `package.json`'s `typescript` version. PR #67 lands the bump
  once this change is merged and Dependabot rebases it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `crap-metric`: complexity measurement must not depend on the TypeScript
  compiler API; it must read TypeScript and TSX syntax, skip bodiless
  signatures, and exit 2 on a file it cannot parse.

## Impact

- Code: `scripts/lint-crap.mjs` (parser and AST walk only),
  `scripts/lint-crap.test.ts` (new cases; existing cases unchanged).
- Dependencies: adds `@babel/parser` to devDependencies. After this change
  `typescript` is used only for `tsc` and by Next.js tooling.
- CI: no workflow change. The `Unit tests` and `Lint CRAP score` steps keep
  running as before.
- Follow-up outside this change: rebase PR #67 and confirm CI and `pnpm build`
  pass on TypeScript 7.
