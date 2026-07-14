import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: () => ({}),
}));

const upsert = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { user: { upsert } },
}));

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
  return providers.find(
    (p) => p?.id === "test-bypass" || p?.options?.id === "test-bypass"
  );
}

describe("auth providers — test-bypass guard", () => {
  beforeEach(() => {
    upsert.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      const user = { id: "u1", email: "dev@example.com", name: null };
      upsert.mockResolvedValue(user);

      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
        secret: "super-secret",
      });

      expect(result).toEqual(user);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it("signs the dev user in when no secret is submitted (the client flow)", async () => {
      // SignInForm no longer carries the secret — it submits only email +
      // callbackUrl. An absent secret must default to the server-side value.
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TEST_AUTH_SECRET", "super-secret");
      const user = { id: "u1", email: "dev@example.com", name: null };
      upsert.mockResolvedValue(user);

      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
      });

      expect(result).toEqual(user);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it("returns null and does not upsert a user for a non-matching secret", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TEST_AUTH_SECRET", "super-secret");

      const provider = findTestBypass(await loadProviders());
      const result = await authorizeOf(provider)?.({
        email: "dev@example.com",
        secret: "wrong-secret",
      });

      expect(result).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
