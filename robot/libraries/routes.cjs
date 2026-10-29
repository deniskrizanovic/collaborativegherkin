// Browser library JS extension: Playwright `page.route` handlers for Robot.
//
// Browser's built-in keywords can wait for requests and responses, but cannot
// register an arbitrary route handler or hold a request open until the test
// says so. Each export below becomes a keyword (`fulfillRoute` → `Fulfill
// Route`). The argument names `page` and `logger` are filled in by Browser
// (the active page), so Robot passes only the other arguments.
//
// CommonJS (.cjs) because the root package.json sets "type": "module" and
// Browser loads extensions with require(). Loaded from
// robot/resources/common.resource via
// `Library    Browser    jsextension=...`. See
// openspec/changes/add-robot-framework-e2e-suite (design D8).

// page -> (url -> resolver of the promise a held route handler awaits). Keyed
// by page so two pages or contexts can each hold the same URL.
const held = new Map();

/** The held-route map of `page`, created on first use. */
function heldFor(page) {
  if (!held.has(page)) held.set(page, new Map());
  return held.get(page);
}

/**
 * Fulfill every request to `url` with `status` and the JSON string `body`.
 * When `method` is set, other methods pass through to the server unchanged
 * (Playwright `route.continue()`).
 */
async function fulfillRoute(url, status, body, method = null, page) {
  await page.route(url, async (route) => {
    if (method && route.request().method() !== method.toUpperCase()) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: Number(status), contentType: "application/json", body });
  });
}
fulfillRoute.rfdoc =
  "Fulfill requests to ``url`` with ``status`` and JSON ``body``. With ``method``, other methods continue to the server.";

/**
 * Like `fulfillRoute`, but the handler waits until `releaseRoute(url)` before
 * fulfilling, so the UI stays in its in-flight state until then.
 */
async function holdRoute(url, status, body, page) {
  const routes = heldFor(page);
  if (routes.has(url)) throw new Error(`A route for ${url} is already held`);
  const release = new Promise((resolve) => routes.set(url, resolve));
  await page.route(url, async (route) => {
    await release;
    try {
      await route.fulfill({ status: Number(status), contentType: "application/json", body });
    } catch {
      // The page closed while the route was held; nothing left to fulfill.
    }
  });
}
holdRoute.rfdoc =
  "Hold requests to ``url`` until `Release Route`, then fulfill them with ``status`` and JSON ``body``.";

/** Let a route registered with `holdRoute` on the active page fulfill its requests. */
async function releaseRoute(url, page) {
  const routes = heldFor(page);
  const resolve = routes.get(url);
  if (!resolve) throw new Error(`No held route for ${url}`);
  routes.delete(url);
  resolve();
}
releaseRoute.rfdoc = "Release the route held with `Hold Route` for ``url``.";

/**
 * Release every held route (on every page, so no handler is left awaiting a
 * promise nothing will resolve), then remove every route handler from the
 * active page. A test that failed before `Release Route` cannot leak into the
 * next one.
 */
async function clearRoutes(page) {
  for (const routes of held.values()) {
    for (const resolve of routes.values()) resolve();
  }
  held.clear();
  if (page) await page.unrouteAll({ behavior: "ignoreErrors" });
}
clearRoutes.rfdoc = "Release every held route, then remove all route handlers from the active page.";

module.exports = { fulfillRoute, holdRoute, releaseRoute, clearRoutes };
