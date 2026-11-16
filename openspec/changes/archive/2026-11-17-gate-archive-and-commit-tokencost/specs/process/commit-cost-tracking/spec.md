## ADDED Requirements

### Requirement: Cost CSV is staged into every commit

The `.husky/pre-commit` hook SHALL run `git add tokencost/cost.csv` after `lint-staged`, so a modified `tokencost/cost.csv` is included in every commit made through git. An unmodified or absent file SHALL leave the commit unchanged. The repository SHALL NOT need separate `chore(tokencost)` commits to record session usage.

#### Scenario: Modified CSV rides along on a commit
> **Tests:** none
- **GIVEN** `tokencost/cost.csv` has an unstaged modification and a commit stages only other files
- **WHEN** the commit runs the `pre-commit` hook
- **THEN** the resulting commit includes the `tokencost/cost.csv` change

#### Scenario: Unchanged CSV leaves the commit alone
> **Tests:** none
- **GIVEN** `tokencost/cost.csv` has no changes
- **WHEN** the commit runs the `pre-commit` hook
- **THEN** the resulting commit contains only the files the author staged
