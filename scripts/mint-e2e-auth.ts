/**
 * Mints the e2e auth storage states (e2e/.auth/user.json, user2.json) outside
 * Playwright, so the Robot suite authenticates exactly like the Playwright one.
 * Reuses e2e/global-setup.ts rather than re-implementing NextAuth JWT encoding.
 * Run with: pnpm exec tsx scripts/mint-e2e-auth.ts
 */

import globalSetup from "../e2e/global-setup";

await globalSetup();
