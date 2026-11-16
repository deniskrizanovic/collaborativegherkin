import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// Capture the config object passed to NextAuth() so we can inspect the
// resolved providers list per environment scenario.
type CapturedConfig = { providers?: unknown[] };
const capturedConfig: { current: CapturedConfig | null } = { current: null };

// Read the captured config through a function so TS control-flow analysis does
// not narrow `current` to the `null` we reset it to — the NextAuth mock
// repopulates it during the dynamic import.
function getCapturedConfig(): CapturedConfig | null {
  return capturedConfig.current;
}

vi.mock("next-auth", () => ({
  default: (config: CapturedConfig) => {
    capturedConfig.current = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

// A real in-memory database. Vitest keeps the factory result across
// `vi.resetModules()`, so every `@/auth` import shares it.
vi.mock("@/lib/db", async () => {
  const { createTestDb } = await import("@/db/testing");
  return createTestDb("sqlite");
});

/** The users stored for `email` in the database the current `@/auth` import uses. */
async function usersWithEmail(email: string) {
  const { db, tables } = await import("@/lib/db");
  return db.select().from(tables.users).where(eq(tables.users.email, email));
}

type ProviderLike = {
  id?: string;
  authorize?: (creds: unknown) => unknown;
  options?: { id?: string; authorize?: (creds: unknown) => unknown };
};

/** The custom `authorize` we passed lives on `options.authorize` in NextAuth v5. */
function authorizeOf(provider: ProviderLike | undefined) {
  return provider?.options?.authorize ?? provider?.authorize;
}

/**
 * Re-import `@/auth` under a fresh module registry so the module-load-time
 * `providers` array is rebuilt against the currently-stubbed env, then return
 * the providers NextAuth was configured with.
 */
async function loadProviders(): Promise<ProviderLike[]> {
  vi.resetModules();
  capturedConfig.current = null;
  await import("@/auth");
  return (getCapturedConfig()?.providers ?? []) as ProviderLike[];
}

function findTestBypass(providers: ProviderLike[]): ProviderLike | undefined {
  // NextAuth v5 keeps the top-level provider `id` as "credentials" and stores
  // the custom `id` we pass on `options.id`.
  return providers.find((p) => p?.id === "test-bypass" || p?.options?.id === "test-bypass");
}

describe("auth providers — test-bypass guard", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    const { db, tables } = await import("@/lib/db");
    await db.delete(tables.users);
  });

  it("omits the test-bypass provider under NODE_ENV=production even when the secret is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_AUTH_SECRET", "super-secret");

    const providers = await loadProviders();

    expect(findTestBypass(providers)).toBeUndefined();
  });

  it("registers the test-bypass provider outside production when the secret is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_AUTH_SECRET", "super-secret");

    const providers = await loadProviders();

    expect(findTestBypass(providers)).toBeDefined();
  });

  it("omits the test-bypass provider when the secret is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_AUTH_SECRET", "");

    const providers = await loadProviders();

    expect(findTestBypass(providers)).toBeUndefined();
  });

  describe("authorize", () => {
    it("returns the user for the matching secret", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TEST_AUTH_SECRET", "super-secret");
      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
        secret: "super-secret",
      });

      const stored = await usersWithEmail("dev@example.com");
      expect(stored).toHaveLength(1);
      expect(result).toEqual({ id: stored[0].id, email: "dev@example.com", name: null });
    });

    it("signs the dev user in when no secret is submitted (the client flow)", async () => {
      // SignInForm no longer carries the secret — it submits only email +
      // callbackUrl. An absent secret must default to the server-side value.
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TEST_AUTH_SECRET", "super-secret");
      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
      });

      const stored = await usersWithEmail("dev@example.com");
      expect(stored).toHaveLength(1);
      expect(result).toEqual({ id: stored[0].id, email: "dev@example.com", name: null });
    });

    it("returns null and does not create a user for a non-matching secret", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TEST_AUTH_SECRET", "super-secret");

      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
        secret: "wrong-secret",
      });

      expect(result).toBeNull();
      expect(await usersWithEmail("dev@example.com")).toHaveLength(0);
    });
  });
});
