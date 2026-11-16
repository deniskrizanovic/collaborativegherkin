## 1. Baseline and dependency

- [x] 1.1 On branch `collaborativegherkin-71`, before any code change (still TypeScript 6), run `pnpm lint:crap --all > /tmp/crap-before.txt` and confirm it exits 0 (design D6)
- [x] 1.2 `pnpm add -D @babel/parser@^8.1.2` and confirm `package.json` and `pnpm-lock.yaml` list it as a direct devDependency

## 2. Tests first

- [x] 2.1 In `scripts/lint-crap.test.ts`, add a `measureFunctions — TypeScript syntax` describe block with these cases (spec "The gate reads TypeScript and TSX source"):
  - "adds no complexity for type annotations, generics, as, satisfies and non-null"
  - "skips overload signatures and declare functions"
  - "scores a TSX component with a JSX conditional"
  - "parses an angle-bracket assertion in a .ts file"
  - "names private methods, quoted keys and computed keys as written" (`#p`, `'k'`, `[KEY]`)
  - "names class property arrows by their key"
- [x] 2.2 Add a `measureFunctions — parse failure` case, "throws a parse error naming the file, line and column", for a file with a syntax error on line 3. Also add a report case, "reports an unparseable file and exits 2", against the exported helper from 3.4 (spec "A source file the gate cannot parse fails the run")
- [x] 2.3 Add "does not import the typescript package". It reads `scripts/lint-crap.mjs` and asserts that no `import`/`require` of `"typescript"` appears (spec "Complexity measurement does not depend on the TypeScript compiler API")
- [x] 2.4 Run `pnpm exec vitest run scripts/lint-crap.test.ts`. The existing cases pass. The new cases fail (overloads, `.tsx`, assertion and naming may pass already on TypeScript 6; parse failure and the import case must fail)

## 3. Rewrite on `@babel/parser`

- [x] 3.1 Replace `import ts from "typescript"` with `import { parse } from "@babel/parser"`. Swap the `SyntaxKind` sets for the Babel type-name sets in design D2: `SwitchCase` counts only with a non-null `test`, and `LogicalExpression` replaces the `BinaryExpression`+operator check
- [x] 3.2 Add the generic child walker from design D3. It skips `loc`, `extra` and the `*Comments` keys, and passes the parent along. Rewrite `countDecisions` and the `measureFunctions` visit to use it, stopping at nested scored functions as now
- [x] 3.3 In `measureFunctions`, parse with `{ sourceType: "module", plugins: .tsx ? ["typescript", "jsx"] : ["typescript"] }`. Take `start`/`end` from `node.loc`, delete `positionOf`, and rewrite `functionName` per design D4 (constructor, key/id source text, `[...]` for computed keys, and parent `VariableDeclarator`/`ObjectProperty`/`ClassProperty`/`ClassPrivateProperty`)
- [x] 3.4 When Babel throws, rethrow an error carrying `file`, `line` and `column`. Export a helper that turns it into `{ exitCode: 2, output: "✗ crap: cannot parse <relative path>:<line>:<column> — <message>" }`, and call it from `main()` around source scoring (design D5)
- [x] 3.5 Update the header comment: complexity now comes from `@babel/parser`, the same parser istanbul uses, and an unparseable file is exit 2
- [x] 3.6 `pnpm exec vitest run scripts/lint-crap.test.ts`: all cases pass

## 4. Equivalence and gates

- [x] 4.1 `pnpm lint:crap --all > /tmp/crap-after.txt` exits 0, and `diff /tmp/crap-before.txt /tmp/crap-after.txt` is empty. Investigate any difference and resolve it before continuing (spec "Swapping the parser leaves every score unchanged")
- [x] 4.2 Prove there is no TypeScript API dependency: temporarily `pnpm add -D typescript@7.0.2`, run `pnpm exec vitest run scripts/lint-crap.test.ts` and `pnpm lint:crap`, confirm both pass, then revert `package.json` and `pnpm-lock.yaml` with `git checkout -- package.json pnpm-lock.yaml && pnpm install`
- [x] 4.3 Update the `> **Tests:**` lines in `specs/crap-metric/spec.md` from `none` to the cases added in section 2. The equivalence scenario cites `none` plus the diff procedure, since it is a manual check
- [x] 4.4 `pnpm lint`, `pnpm lint:format`, `pnpm typecheck`, `pnpm lint:specs`, `pnpm lint:given` and `pnpm test` all pass

## 5. Follow-up after merge (owner)

- [ ] 5.1 Comment `@dependabot rebase` on PR #67 and confirm its `ci` check passes on TypeScript 7
- [ ] 5.2 On the rebased #67 branch, run `pnpm build` locally (CI does not build) before merging the major bump
