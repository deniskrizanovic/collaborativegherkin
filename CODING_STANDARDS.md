# Coding standards

Read by the reviewer (`.claude/agents/reviewer.md`) against a diff. Every rule
here is a judgement call. Anything a linter, test or gate can check belongs in
that tool instead (`oxlint`, Biome, `lint:*` scripts, `lint:crap`).

## Server code

- **Failures are logged before they propagate.** A database, network or
  filesystem call in server code sits in a `try/catch` that logs through
  `src/lib/logger.ts` (Pino) and then re-throws. Look for a new `await` on a
  Drizzle query, `fetch` or `fs` with no surrounding handler.
- **The server validates what the client validates.** Every API route parses
  its request body and params with a Zod schema, even when the UI already
  checks the same fields.
- **Secrets come from the environment.** Keys, tokens and passwords are read
  from `process.env`, with the variable named in `.env.example`.

## Gherkin rules

- **One source of truth.** Block types, ordering (`canFollow()`), Enter
  progression and export formats come from `src/lib/gherkin.ts`. A diff that
  re-states a block-type list or an ordering rule elsewhere duplicates it;
  import it instead.
- **Every block sequence passes `canFollow()`.** Code that inserts, moves,
  imports or converts blocks checks the result with `canFollow()`, so no path
  produces a sequence the editor would reject.

## Protected areas

- **Do Not Touch list.** A diff changing behaviour in any item of CLAUDE.md's
  Do Not Touch list needs the user's explicit permission, stated in the
  conversation or the change's proposal. Flag it otherwise. Tests added
  beside a protected file are fine; edits to the file are not.

## Tests

- **Inject dependencies.** New `src/lib/` modules take their collaborators
  (database client, `fetch`, API keys) as factory or constructor arguments,
  and tests pass fakes in (ADR 0001). New `vi.mock` calls extend acknowledged debt; flag
  them. `vi.stubGlobal` for a browser global jsdom lacks is fine.
- **Each test proves a behaviour.** A test names the behaviour it checks and
  fails when that behaviour breaks. Flag tests that only raise coverage
  (render and assert nothing) to get under the CRAP threshold.

## Consistency

- **Match the surrounding code.** Naming, comment density, file layout and
  error-message style follow the neighbouring files. Sibling `scripts/lint-*.mjs`
  gates share a header-comment, exported-pure-functions and main-guard
  layout; a new gate follows it.
