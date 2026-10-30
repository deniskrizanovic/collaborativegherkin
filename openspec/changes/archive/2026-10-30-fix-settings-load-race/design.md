## Context

`SessionView.tsx` holds the session's AI settings (`selectedModel` and
`promptText`) in local state. That state starts from `DEFAULT_MODEL` and
`DEFAULT_PROMPT`. On mount, an effect fetches `GET /api/sessions/<id>` and
overwrites both values when the response arrives. Two things are wrong with
this:

1. The "Edit prompt" button and the model `<select>` work from the first render,
   so the user can change either value before the load finishes. The late
   response then overwrites what they changed.
2. The effect has no cleanup. In dev, React StrictMode mounts it twice, so two
   GETs race (CI logs show both). A response that comes back after the
   component unmounts, or after `sessionId` changes, is still applied.

The prompt modal's textarea is bound straight to `promptText`, so an overwrite
replaces the user's text while they are typing, and Save then sends the
default. The model has the same problem: `handleModelChange` PATCHes the new
model, but a late load can put the old one back in the dropdown.

Reviews are not affected. `POST /api/llm-review` reads the model and prompt from
the stored session on the server, not from client state.

## Goals / Non-Goals

**Goals:**
- The initial settings load can never overwrite a model or prompt the user has
  changed.
- Stale or duplicate load responses are ignored.
- A regression test in both suites (Playwright and Robot) holds the settings
  GET open and checks that the controls are disabled until it resolves.
- Tests that read the model value without clicking first wait for the control
  to be enabled.

**Non-Goals:**
- Live sync of AI settings between collaborators. Settings load once per page
  view, as they do today.
- Making Cancel revert unsaved textarea edits. Today Cancel closes the modal,
  and the edited text stays in local state until reload. That is a separate
  behaviour; leave it as it is.
- Error handling for a failed PATCH network call (`handleSavePrompt` has no
  `catch`). It's out of scope; note it in the issue for later.
- Any change to the API, the schema, the Y.js sync layer, `gherkin.ts`, auth,
  or export.

## Decisions

### D1: Disable the controls until the load settles, rather than tracking a dirty flag

Add `const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null)`
and derive `const settingsLoaded = loadedSessionId === sessionId`. Set
`loadedSessionId` to `sessionId` once the load settles: on success, on a non-OK
response, and on a network error. Bind `disabled={!settingsLoaded}` on "Edit prompt", and
`disabled={reviewing || !settingsLoaded}` on the model select.

- **Why:** The user can't edit until the values the page shows are the real
  ones, so there is never anything to merge. Playwright's `click` /
  `selectOption` and Browser's `Click` / `Select Options By` already wait for
  an element to become enabled. Existing tests therefore stop racing without
  extra waits, and a disabled control is an easy state to assert.
- **Alternative: a dirty flag.** Apply the loaded values only if the user hasn't
  changed them. Rejected: the user could then be editing a value that isn't the
  stored one (they started from the default, and the session had a custom
  prompt). That is a quieter version of the same confusion, and it adds state
  that is hard to test.
- **Alternative: show a loading placeholder in place of the controls.**
  Rejected: it changes the layout, and it breaks the `toBeVisible` assertions
  in `e2e/llm-review.spec.ts`, `robot/suites/llm_review.robot`, and the
  access-control suites.
- **On failure the controls still become enabled.** That keeps today's
  behaviour: the banner shows and the user can still edit and save from the
  defaults. Nothing is overwritten, because the load has already finished by
  then.

### D2: Ignore stale responses with a cleanup flag

Inside the effect, declare `let cancelled = false`, check it before every state
update, and return `() => { cancelled = true }`. Use a plain flag rather than an
`AbortController`, because the code only needs to drop late results, not save
bandwidth. If `sessionId` changes, `settingsLoaded` becomes `false` on its own,
because `loadedSessionId` still holds the old id, so the controls are disabled
again for the new session. A reset call at the start of the effect would do the
same, but it is a synchronous `setState` in an effect body, which the React
Hooks ESLint rule rejects.

### D3: Robot `Hold Route` gains an optional `method` argument

`holdRoute` in `robot/libraries/routes.cjs` currently intercepts every method.
For the regression test, only the settings `GET` should be held and mocked;
`PATCH` has to reach the server so the saved prompt really persists. Add
`method = null` (same position and semantics as `fulfillRoute`). When it is
set, other methods `route.continue()`. Existing three-argument callers keep
working unchanged.

In Playwright, the test does the same thing inline with `page.route` and a
method check (`route.fallback()` for anything other than GET).

### D4: Test shape

Register the route before navigation on `**/api/sessions/*`. That pattern
matches `/api/sessions/<id>` but not `/api/sessions`, and session creation goes
through the API request context, not `page.route`, so it isn't intercepted.

- **Pending-load test:** hold the GET, open the session, then assert that "Edit
  prompt" and the model select are disabled. Release the route, then assert
  both are enabled.
- **Slow-load save test:** release the held GET, edit and save a new prompt,
  then clear routes and reload. Reopening the modal must show the saved prompt.
  This proves the PATCH sent the user's text, not the default.
- **Load-failure test:** fulfill the GET with 500 (method GET only). Assert the
  banner `Couldn't load this session's AI settings.` is shown, "Edit prompt" is
  enabled, and the modal opens with the default prompt.

Robot test titles follow the existing `SC-8.x.y: <scenario title>` convention.
The new scenarios are SC-8.3.4, SC-8.4.6, and SC-8.4.7, and each gets a row in
`robot/PARITY.md`.

## Risks / Trade-offs

- **[Controls flash disabled on every page load]**: The window is one
  same-origin GET, typically 50–150 ms. The existing `:disabled` style on
  `.session-model-select` already covers this look. "Edit prompt" has no
  `:disabled` style today; add a matching one to `globals.css` so the state is
  visible.
- **[The settings GET never settles]**: The controls stay disabled. This can't
  happen while `fetch` rejects on network failure and the server answers. Add no
  timeout (YAGNI); revisit only if it is observed.
- **[Tests that read the model value before the load]**: SC-8.1.2's
  header-model test and both access-control "change the model" tests read
  `.session-model-select`'s value without an actionability wait. Add an
  explicit wait for the enabled state before each read, so the value read is
  the loaded one.
- **[Hold Route signature change]**: The new parameter is optional and trailing
  (before the injected `page`). No existing caller passes a fourth argument.
