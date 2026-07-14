import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { createSession } from "./helpers";

// ENG-005 — the sync WebSocket must refuse an unauthenticated upgrade before any
// room is joined or any document/awareness state is sent. These tests connect a
// raw ws client to the single server on :3000 (no browser, so we control the
// cookie header exactly) and assert the upgrade is rejected.
//
// The suite default storageState authenticates the browser `page`; we do NOT
// reuse it for the raw socket — we send no cookie to prove the anonymous path is
// closed.

const WS_BASE = "ws://localhost:3000";

// Wait for a ws client to reach a terminal state, capturing whether the upgrade
// succeeded and whether the server sent any payload before/without opening.
function connectResult(url: string, headers?: Record<string, string>) {
  return new Promise<{ opened: boolean; statusCode?: number; receivedData: boolean }>((resolve) => {
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    let opened = false;
    let receivedData = false;
    let statusCode: number | undefined;

    // 'unexpected-response' fires when the HTTP upgrade is refused (e.g. 401).
    ws.on("unexpected-response", (_req, res) => {
      statusCode = res.statusCode;
      ws.terminate();
      resolve({ opened, statusCode, receivedData });
    });
    ws.on("open", () => {
      opened = true;
    });
    ws.on("message", () => {
      receivedData = true;
    });
    ws.on("error", () => {
      // A refused upgrade surfaces here too; resolve if not already handled.
      resolve({ opened, statusCode, receivedData });
    });
    ws.on("close", () => {
      resolve({ opened, statusCode, receivedData });
    });

    // Safety timeout so a hung socket can't stall the test.
    setTimeout(() => {
      ws.terminate();
      resolve({ opened, statusCode, receivedData });
    }, 3000);
  });
}

test.describe("WebSocket sync auth (ENG-005)", () => {
  test("unauthenticated upgrade is refused with 401 — no room joined, no data sent", async ({ page }) => {
    // Create a real session so the room name is well-formed; the point is that
    // even a valid room is refused without a session cookie.
    const sessionId = await createSession(page, "WS auth negative test");

    const result = await connectResult(`${WS_BASE}/session-${sessionId}`);

    expect(result.opened, "upgrade must not open without a session cookie").toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.receivedData, "no document/awareness state may be sent").toBe(false);
  });

  test("authenticated upgrade to a valid room succeeds", async ({ page }) => {
    const sessionId = await createSession(page, "WS auth positive test");

    // Reuse the browser context's authenticated session cookie on the raw socket.
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const result = await connectResult(`${WS_BASE}/session-${sessionId}`, { Cookie: cookieHeader });

    expect(result.opened, "a valid session cookie must be accepted").toBe(true);
    // Sync step 1 is sent immediately on connect, so authenticated clients get data.
    expect(result.receivedData).toBe(true);
  });

  test("authenticated upgrade to a malformed room is refused", async ({ page }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const result = await connectResult(`${WS_BASE}/default`, { Cookie: cookieHeader });

    expect(result.opened, "a malformed room name must be refused even when authenticated").toBe(false);
    expect(result.statusCode).toBe(401);
  });
});
