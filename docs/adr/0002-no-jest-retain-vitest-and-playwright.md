# Do not introduce Jest — retain Vitest and Playwright

**Status:** Accepted  
**Date:** 2026-05-22

## Context

A test coverage review (2026-05-22) identified significant gaps: the home page flow, API HTTP contracts, image insertion, block indentation, data table keyboard navigation, and several import edge cases are all untested. The question arose whether introducing Jest would help close those gaps or improve the testing setup.

The project already runs two test tools:

- **Vitest** — unit and integration tests in `src/`
- **Playwright** — e2e browser tests in `e2e/`

## Decision

Do not introduce Jest. Vitest remains the unit test runner; Playwright remains the e2e runner. The identified coverage gaps should be addressed by writing more tests with the existing tools, not by adding a third runner.

## Reasons

**Against Jest:**

- The coverage gaps are about missing tests, not about runner capability. Switching or adding a runner closes none of them.
- Vitest runs in Vite's native ESM pipeline without transpilation and is significantly faster than Jest, which matters as the test suite grows.
- Configuring Jest for Next.js App Router with TypeScript path aliases requires non-trivial setup (`jest.config.js`, `babel-jest` or `ts-jest`, module name mappings). Vitest inherits the Vite config automatically.
- Adding Jest alongside Vitest and Playwright means three test commands, three configs, and three CI steps.
- The most significant gap — API HTTP contract tests (spec §4, §8.5–8.7) — is best addressed with Playwright's `request` fixture or a supertest-style integration harness, not Jest unit tests.

**In favour of Jest (considered and rejected):**

- Jest is more widely known and lowers onboarding cost for contributors unfamiliar with Vitest. Rejected because Vitest's API is intentionally compatible with Jest; the difference is negligible in practice.
- Jest's jsdom integration is more battle-tested. Rejected because Vitest already supports `// @vitest-environment jsdom` and this is working correctly in `GherkinDataTable.test.ts`.
- Some third-party tooling assumes Jest. Rejected because no such tooling has been identified as a requirement in this project.

## Consequences

- New unit tests continue to use Vitest with the existing `// @vitest-environment jsdom` annotation where DOM access is needed.
- New API contract tests should use Playwright's `request` fixture to test route handlers at the HTTP level, consistent with the existing e2e setup.
- The existing `vi.mock()` pattern in legacy tests is retained as acknowledged debt per ADR 0001; new tests use explicit dependency injection.
