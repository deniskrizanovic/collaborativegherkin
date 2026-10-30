// Browser library JS extension: Playwright `page.route` handlers for Robot.
//
// Browser's built-in keywords can wait for requests and responses, but cannot
// register an arbitrary route handler or hold a request open until the test
// says so. Each export below becomes a keyword (`fulfillRoute` → `Fulfill
// Route`). The argument names `page` and `logger` are filled in by Browser
// (the active page), so Robot passes only the other arguments.
//
// A handler registered with `method` hands requests of other methods to the
// route registered before it (Playwright `route.fallback()`), or to the server
// when there is none, so routes for one URL and different methods compose.
//
// CommonJS (.cjs) because the root package.json sets "type": "module" and
// Browser loads extensions with require(). Loaded from
// robot/resources/common.resource via
// `Library    Browser    jsextension=...`. See
// openspec/changes/archive/2026-10-29-add-robot-framework-e2e-suite (design D8).

// page -> (url -> resolver of the promise a held route handler awaits). Keyed
// by page so two pages or contexts can each hold the same URL.
const held = new Map();

// page -> (url -> (request method -> number of requests the counted and held
// routes for url have handled)). Keyed by page like `held`, so each page or
// context counts on its own.
const counts = new Map();

// page -> ("<METHOD|*> <url>" -> handler of the counted route registered for
// that url and method), so registering it again replaces the earlier handler.
const countedHandlers = new Map();

/** The map `registry` keeps for `page`, created on first use. */
function mapFor(registry, page) {
  if (!registry.has(page)) registry.set(page, new Map());
  return registry.get(page);
}

/** Whether `route`'s request is one a handler registered with `method` serves. */
function servesMethod(route, method) {
  return !method || route.request().method() === method.toUpperCase();
}

/** Start counting the requests to `url` on `page`; keeps an existing count. */
function startCounting(page, url) {
  const routeCounts = mapFor(counts, page);
  if (!routeCounts.has(url)) routeCounts.set(url, new Map());
}

/** Count `route`'s request against `url` on `page`, under its method. */
function countRequest(page, url, route) {
  const byMethod = mapFor(counts, page).get(url);
  const requestMethod = route.request().method();
  byMethod.set(requestMethod, (byMethod.get(requestMethod) ?? 0) + 1);
}

/**
 * Fulfill every request to `url` with `status` and the JSON string `body`.
 * When `method` is set, requests of other methods fall back (see above).
 */
async function fulfillRoute(url, status, body, method = null, page) {
  await page.route(url, async (route) => {
    if (!servesMethod(route, method)) return route.fallback();
    await route.fulfill({ status: Number(status), contentType: "application/json", body });
  });
}
fulfillRoute.rfdoc =
  "Fulfill requests to ``url`` with ``status`` and JSON ``body``. With ``method``, other methods fall back to the earlier route or the server.";

/**
 * Like `fulfillRoute`, but also counts the requests it fulfills, so a test can
 * assert with `routeRequestCount(url)` that no further request was made.
 * Registering it again for the same `url` and `method` replaces the earlier
 * handler and keeps counting from where it was, so the count is every request
 * to `url` the test's counted and held routes handled.
 */
async function fulfillCountedRoute(url, status, body, method = null, page) {
  startCounting(page, url);
  const handlers = mapFor(countedHandlers, page);
  const key = `${method ? method.toUpperCase() : "*"} ${url}`;
  if (handlers.has(key)) await page.unroute(url, handlers.get(key));
  const handler = async (route) => {
    if (!servesMethod(route, method)) return route.fallback();
    countRequest(page, url, route);
    await route.fulfill({ status: Number(status), contentType: "application/json", body });
  };
  handlers.set(key, handler);
  await page.route(url, handler);
}
fulfillCountedRoute.rfdoc =
  "Like `Fulfill Route`, and count the requests fulfilled for ``url`` (read with `Route Request Count`). Registering it again for the same ``url`` and ``method`` replaces the earlier handler and keeps the count.";

/**
 * Number of requests to `url` that the counted and held routes on the active
 * page have handled: of `method` only when it is set, else of every method.
 */
async function routeRequestCount(url, method = null, page) {
  const byMethod = mapFor(counts, page).get(url);
  if (!byMethod) throw new Error(`No counted or held route for ${url}`);
  if (method) return byMethod.get(method.toUpperCase()) ?? 0;
  return [...byMethod.values()].reduce((sum, n) => sum + n, 0);
}
routeRequestCount.rfdoc =
  "Return how many requests to ``url`` the routes registered with `Fulfill Counted Route` or `Hold Route` have handled on the active page; with ``method``, only requests of that method.";

/**
 * Like `fulfillRoute`, but the handler waits until `releaseRoute(url)` before
 * fulfilling, so the UI stays in its in-flight state until then. Its requests
 * count towards `routeRequestCount(url)`. When `method` is set, requests of
 * other methods fall back and are never held.
 */
async function holdRoute(url, status, body, method = null, page) {
  const routes = mapFor(held, page);
  if (routes.has(url)) throw new Error(`A route for ${url} is already held`);
  startCounting(page, url);
  const release = new Promise((resolve) => routes.set(url, resolve));
  await page.route(url, async (route) => {
    if (!servesMethod(route, method)) return route.fallback();
    countRequest(page, url, route);
    await release;
    try {
      await route.fulfill({ status: Number(status), contentType: "application/json", body });
    } catch {
      // The page closed while the route was held; nothing left to fulfill.
    }
  });
}
holdRoute.rfdoc =
  "Hold requests to ``url`` until `Release Route`, then fulfill them with ``status`` and JSON ``body``. They count towards `Route Request Count`. With ``method``, other methods fall back to the earlier route or the server.";

/** Let a route registered with `holdRoute` on the active page fulfill its requests. */
async function releaseRoute(url, page) {
  const routes = mapFor(held, page);
  const resolve = routes.get(url);
  if (!resolve) throw new Error(`No held route for ${url}`);
  routes.delete(url);
  resolve();
}
releaseRoute.rfdoc = "Release the route held with `Hold Route` for ``url``.";

/**
 * Release every held route (on every page, so no handler is left awaiting a
 * promise nothing will resolve), reset every request count, then remove every
 * route handler from the active page. A test that failed before
 * `Release Route` cannot leak into the next one.
 */
async function clearRoutes(page) {
  for (const routes of held.values()) {
    for (const resolve of routes.values()) resolve();
  }
  held.clear();
  counts.clear();
  countedHandlers.clear();
  if (page) await page.unrouteAll({ behavior: "ignoreErrors" });
}
clearRoutes.rfdoc = "Release every held route, reset every request count, then remove all route handlers from the active page.";

module.exports = { fulfillRoute, fulfillCountedRoute, routeRequestCount, holdRoute, releaseRoute, clearRoutes };
