## Context

`scripts/lint-crap.mjs` scores every function under `src/` with
`comp² × (1 − cov)³ + comp`. Coverage comes from istanbul's
`coverage-final.json`; complexity and function spans come from the TypeScript
compiler API (`ts.createSourceFile` + `ts.forEachChild`). The two are joined by
position: each istanbul branch or statement is credited to the innermost
function whose span contains its start (`innermostAt`).

TypeScript 7 (PR #67) ships no JavaScript compiler API, so `import ts from
"typescript"` yields an object without `SyntaxKind` and the module throws at
load. Everything below `measureFunctions` (scoring, report, options, CLI, the
coverage run) uses plain data and does not touch the AST.

The compiler-API surface in use is small: `createSourceFile`, `forEachChild`,
`SyntaxKind`, `ScriptKind`, `ScriptTarget`, `getLineAndCharacterOfPosition`,
`getStart`/`getEnd`/`getText`, and three `is*` guards for naming.

## Goals / Non-Goals

**Goals:**

- `lint-crap.mjs` imports no `typescript` module, so any TypeScript version can
  be installed.
- Identical output on today's tree: same functions, names, lines, complexity,
  coverage and scores.
- Exported API (`measureFunctions`, `scoreFunctions`, `collectSourceFiles`,
  `buildReport`, `reportFor`, `parseArgs`, `filterByPath`, `CRAP_THRESHOLD`)
  and its return shapes unchanged, so existing tests pass untouched.

**Non-Goals:**

- Bumping `typescript` to 7. PR #67 does that once it is rebased on this
  change.
- Changing which constructs count as decision points (for example, counting
  `?.` or `&&=`). Neither counts today, and neither will after this change.
- Fixing a `next build` problem on TypeScript 7, if there is one. CI does not
  run `next build`. Check it on PR #67.

## Decisions

### D1. Parse with `@babel/parser` 8

`@babel/parser` with the `typescript`, `decorators` and
`decoratorAutoAccessors` plugins, plus `jsx` for `.tsx` only. Without the
decorator plugins Babel rejects decorators and `accessor` fields, which the
TypeScript parser accepted.

- **Why Babel:** istanbul instruments with Babel, so the coverage locations
  the gate joins against come from the same parser's `loc`, using the same
  conventions: 1-based lines, 0-based UTF-16 columns, starts after leading
  comments. Span matching stays exact without any offset conversion. The parser
  has no native binary and only small pure-JS `@babel/*` dependencies.
- **Why 8:** ADR 0004 asks for the latest stable release, which is 8.1.2. It
  is ESM-only and needs Node `^22.18.0 || >=24.11.0`. The script is already
  `.mjs`, CI uses `node-version: '22'` (latest 22.x), and local Node is 24.
- **Alternatives considered:**
  - `oxc-parser`: faster and matches oxlint, but it is a native addon, and it
    reports byte offsets that we would have to map to UTF-16 line and column
    to line up with istanbul. The gate already spends nearly all its time on
    the Vitest coverage run, so speed does not matter here.
  - `@typescript-eslint/typescript-estree`: depends on the `typescript`
    package, which is the exact coupling we are removing.
  - Aliasing TypeScript 6 (`"typescript6": "npm:typescript@^6"`): works today,
    but keeps a second TypeScript install alive just for this script, and that
    alias falls further behind with every release.
  - `@ast-grep/napi`: tree-sitter CSTs have no `parent`/`kind` model close to
    the one the code uses now, and it is another native addon.

### D2. Node-kind mapping

| Current (`ts.SyntaxKind`) | Babel node |
| --- | --- |
| `FunctionDeclaration`, `FunctionExpression`, `ArrowFunction` | `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression` |
| `MethodDeclaration`, `Constructor`, `GetAccessor`, `SetAccessor` | `ClassMethod` (all `kind`s), `ClassPrivateMethod`, `ObjectMethod` |
| bodiless overloads / `declare` / abstract | `TSDeclareFunction`, `TSDeclareMethod`, which are not in the function set |
| `IfStatement`, `ConditionalExpression`, `For*`, `While`, `Do` | `IfStatement`, `ConditionalExpression`, `ForStatement`, `ForInStatement`, `ForOfStatement`, `WhileStatement`, `DoWhileStatement` |
| `CaseClause` | `SwitchCase` with `test !== null` (`default` has `test: null`) |
| `CatchClause` | `CatchClause` |
| `BinaryExpression` with `&&`/`\|\|`/`??` | `LogicalExpression` (its operators are exactly these three) |

A `body != null` guard stays as a belt-and-braces check.

### D3. Walk the AST without `@babel/traverse`

A small recursive walker visits every property value that is a node (an
object with a string `type`) or an array of nodes. It skips `loc`, `extra`
and the `*Comments` keys, and passes the parent along, because Babel nodes
have no `.parent`. `@babel/traverse` would add scope tracking and a large
dependency tree that this gate does not need. `countDecisions` keeps its
current shape: it stops at a nested scored function.

### D4. Positions and names

- `start` = `node.loc.start`, `end` = `node.loc.end`. They have the same shape
  as today's `positionOf` output, so `innermostAt` is unchanged and
  `positionOf` is deleted.
- Names, matching what `getText` returns today:
  - `ClassMethod` with `kind: "constructor"` gives `constructor`.
  - A node with a key or id gives that key's source text,
    `content.slice(key.start, key.end)`. That covers `#private` names and
    quoted keys. An `Identifier` gives its `name` instead, because Babel's
    `Identifier` span also covers its type annotation (`f: Handler`). A `computed` key is wrapped in `[...]`, which
    matches TypeScript's `ComputedPropertyName` text.
  - An anonymous function whose parent is a `VariableDeclarator` (`id`),
    `ObjectProperty` (`key`) or `ClassProperty`/`ClassPrivateProperty`/
    `ClassAccessorProperty` (`key`) takes the parent's name the same way.
  - Anything else gives `<anonymous>`.

### D5. Parse failure is exit 2

`measureFunctions` wraps Babel's `SyntaxError` in a `SourceParseError`
carrying `file`, `line` and `column`, with Babel's ` (line:column)` message
suffix removed. `main()` catches that error type around source scoring, passes
it to the exported `parseFailureReport`, prints the returned `✗ crap: cannot parse <relative path>:<line>:<column> — <message>`
and sets exit 2. This follows the gate's existing rule: exit 2 means the gate
could not produce a trustworthy score. The TypeScript parser recovered from
errors silently. That was safe in practice, because `tsc --noEmit` runs
first, but nothing guaranteed it.

### D6. Prove equivalence with a before/after report

Before touching the parser, capture `pnpm lint:crap --all` on `main`'s tree
(which runs on TypeScript 6) to a scratch file. After the rewrite, run it again
and diff the two. The diff must be empty. This checks every real function in
`src/`, not just the unit fixtures.

## Risks / Trade-offs

- [Babel and TypeScript disagree on a node's start, for example around
  decorators or `export default`] → D6's diff catches any change on the real
  tree. Babel's positions are the ones istanbul uses, so where they differ,
  Babel is the more correct join.
- [Babel 8 AST shape differs from Babel 7 in a node type we rely on] → The
  mapping in D2 was checked with a probe against `@babel/parser@8.1.2`
  (overloads, `declare`, abstract, private, accessor, constructor and computed
  members). The new unit cases pin it.
- [A future TypeScript syntax lands before Babel supports it] → The gate
  exits 2 and names the file, rather than mis-scoring it. Dependabot keeps
  `@babel/parser` current.
- [Two parsers now read `src/`: tsc for types, Babel for the gate] → Accepted.
  It is the same split istanbul already has.

## Migration Plan

1. Merge this change to `main`. The gate behaves identically on TypeScript 6.
2. Comment `@dependabot rebase` on PR #67. CI should go green on TypeScript 7.
3. On the rebased #67 branch, run `pnpm build` locally before merging, since
   CI does not build.

Rollback: revert the commit. Nothing else depends on the new code.

## Open Questions

None.
