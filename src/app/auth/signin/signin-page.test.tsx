import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The render test asserts properties of the rendered client payload, not the
// click flow, so signIn is mocked to a no-op.
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

const SECRET = "super-secret-value";

/**
 * Import SignInPage under a fresh module registry so the server component reads
 * the currently-stubbed env when computing `devLoginEnabled`.
 */
async function renderSignInPage(): Promise<string> {
  vi.resetModules();
  const { default: SignInPage } = await import("./page");
  return renderToStaticMarkup(<SignInPage />);
}

describe("SignInPage rendered payload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the dev-login control and leaks no secret when devLoginEnabled is true", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_AUTH_SECRET", SECRET);

    const markup = await renderSignInPage();

    expect(markup).toContain("Sign in as dev@example.com");
    expect(markup).not.toContain(SECRET);
  });

  it("omits the dev-login control and leaks no secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_AUTH_SECRET", SECRET);

    const markup = await renderSignInPage();

    expect(markup).not.toContain("Sign in as dev@example.com");
    expect(markup).not.toContain(SECRET);
  });
});
