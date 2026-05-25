# ADR 0004 — Latest Stable Dependency Principle

**Status:** Accepted  
**Date:** 2026-05-25

## Context

The project has accumulated version drift across most of its major dependencies. A recurring question arises when Dependabot opens PRs: should major version bumps be taken, and if so when?

## Decision

This project targets the **latest stable** version for all dependencies (LTS versions where applicable). Deferred upgrades accumulate migration cost; staying current keeps that cost small and incremental.

### Exception: `@tiptap/extension-collaboration-cursor`

`@tiptap/extension-collaboration-cursor` is installed at `^3.0.0` but **not used** in the codebase. The `3.0.0` stable release still depends on `y-prosemirror`, which conflicts with `@tiptap/extension-collaboration` v3 (which uses `@tiptap/y-tiptap`). Installing two conflicting Y.js ProseMirror bindings causes a `PluginKey` crash at startup.

The package is retained in `package.json` solely so Dependabot raises a PR when a new version ships. When that PR arrives, check whether the new release has switched its peer dependency from `y-prosemirror` to `@tiptap/y-tiptap` — that is the signal that compatibility is restored and the extension can be re-enabled to restore collaborator cursor highlighting.

E2E test `SC-3.5.2: Remote user cursors visible in distinct colour` (`e2e/collaboration.spec.ts`) is skipped until this is resolved.

### Exception: `next-auth`

`next-auth` is pinned to `5.0.0-beta.31`. v5 was adopted while still in beta; v4 was the correct stable choice at the time. Rolling back to v4 now would require rewriting the entire auth configuration — the migration cost exceeds the benefit. This exception should be revisited when NextAuth v5 reaches a stable release.

## Consequences

- The Dependabot major-version exception for `@tiptap/*` packages (added in commit `5025cb1`) is removed — it contradicts this principle.
- The Dependabot major-version exception for `next` is also removed.
- Each major upgrade is performed as an atomic step with a full test run (`typecheck + lint + unit tests + e2e`) before the next step begins.
