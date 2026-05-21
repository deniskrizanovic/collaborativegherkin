# Explicit dependency injection over module-level mocking

New modules in `src/lib/` accept their dependencies (database client, fetch, API keys) as constructor or factory arguments rather than importing them directly and relying on `vi.mock()` in tests.

The existing `sessions-api.test.ts` uses `vi.mock("@/lib/db")` — that pattern is retained where it already exists but should not be extended. Explicit injection lets tests pass fakes directly with no mocking infrastructure, and makes the module's dependencies part of its interface rather than hidden implementation details.

The `Coaching` module (`src/lib/coaching.ts`) is the first to follow this pattern.
