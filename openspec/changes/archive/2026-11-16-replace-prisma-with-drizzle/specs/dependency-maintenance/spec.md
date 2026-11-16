## MODIFIED Requirements

### Requirement: Held auth packages move in lockstep

`next-auth` pins an exact `@auth/core` version, and `@auth/drizzle-adapter`
pins one too. `next-auth`, `@auth/core` and `@auth/drizzle-adapter` SHALL
therefore be declared at exact versions in `package.json` (no `^` or `~`
range), and the resolved dependency tree SHALL contain exactly one version of
`@auth/core`. Dependabot SHALL NOT raise standalone updates for `@auth/core` or
`@auth/drizzle-adapter`. Those two move only when `next-auth` itself is
upgraded.

#### Scenario: Auth packages resolve to a single core version
> **Tests:** none
- **GIVEN** `package.json` declares `next-auth`, `@auth/core` and `@auth/drizzle-adapter` at exact versions whose `@auth/core` requirements agree
- **WHEN** dependencies are installed with `pnpm install --frozen-lockfile`
- **THEN** `pnpm why @auth/core` reports exactly one resolved `@auth/core` version

#### Scenario: Standalone auth-core bumps are not proposed
> **Tests:** none
- **GIVEN** a new patch release of `@auth/core` is published while `next-auth` is unchanged
- **WHEN** Dependabot runs its weekly npm update
- **THEN** Dependabot opens no pull request that bumps `@auth/core` or `@auth/drizzle-adapter`
