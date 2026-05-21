# NSW Design System Implementation

## Context
The app currently uses a dark developer-tool aesthetic (amber/violet on near-black). The goal is a full visual replacement to NSW Government service style — light mode, NSW DS colours and typography — without Waratah masthead. The detailed design decisions live in `plans/2026-05-20-10:45-nsw-design-system.md`.

## e2e Selector Safety
All e2e tests target `.gherkin-*` and `[data-gherkin-*]` selectors inside `GherkinEditor`. Shell UI (home, session header, forms) has zero e2e selectors — those elements can be freely restyled. **Do not rename any `.gherkin-*` class or modify `[data-gherkin-type]` sibling selector logic.**

## Critical Files
- `package.json` — add `nsw-design-system` and `@fontsource/public-sans`
- `src/app/layout.tsx` — swap fonts, import NSW DS CSS, add NSW JS init script
- `src/app/globals.css` — replace `:root` tokens + shell styles; update keyword `::before` colours; update editor canvas light-mode rules; keep all `.gherkin-*` structure verbatim
- `src/app/HomeClient.tsx` — add NSW DS classes to form input, create button, sessions list
- `src/app/sessions/[id]/SessionView.tsx` — add NSW DS classes to copy-link button

## Step-by-Step

### 1. Install packages
```bash
npm install nsw-design-system @fontsource/public-sans
```

### 2. `src/app/layout.tsx`
- Remove `Syne` and `IBM_Plex_Sans` next/font imports and their variable assignments on `<html>`
- Add at top: `import "@fontsource/public-sans"` and `import "nsw-design-system/dist/css/main.css"`
- Add `<link>` for IBM Plex Mono (Google Fonts — editor canvas only) in `<head>`
- Add `<Script src="..." strategy="afterInteractive">` for `window.NSW.initSite()` — import `Script` from `next/script`
- Body element: remove `className` font variable references

### 3. `src/app/globals.css`
**`:root` — full token replacement:**
```css
:root {
  --bg: #ffffff;
  --surface: #f2f2f2;
  --border: #cdd3d6;
  --text: #22272b;
  --text-muted: #495054;
  --focus-colour: #0086b3;
  --radius: 4px;
  --font-body: 'Public Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```
Remove: `--surface-2`, `--border-2`, `--text-dim`, `--amber*`, `--green`, `--orange`, `--violet`, `--blue`, `--slate`, `--radius-sm`, `--font-display`

**Remove shell button/input rules** (NSW DS stylesheet replaces these): `.create-btn`, `.create-input`, `.copy-link-btn` (keep `.copy-link-btn.copied` override for green success state)

**Keep verbatim:** all `.gherkin-*`, `[data-gherkin-type]`, `.collaboration-cursor__*`, `.gherkin-import-*` rules

**Update keyword `::before` colours only:**
- feature/rule/background → `#002664`
- scenario/scenario-outline → `#0b3f47`
- given → `#004000`
- when → `#941b00`
- then → `#441170`
- and/but → `#495054`

**Editor canvas light-mode:** `.gherkin-editor-wrapper` white bg + `--border` border; `.gherkin-editor` white bg, `--text` caret + colour; `.gherkin-toolbar` white/off-white bg; `.gherkin-toolbar-btn` `--text-muted` colour, hover → `#002664` colour + `#f2f2f2` bg; `.block-picker` white bg; table header-row use `#002664` accent

**Shell colour tokens** → replace `var(--amber)` / dark-palette refs with NSW token equivalents throughout home/session shell rules

### 4. `src/app/HomeClient.tsx`
- Input: add `nsw-form__input` class; wrap in `<div className="nsw-form__group">`
- Button: add `nsw-button nsw-button--dark` classes (keep existing `create-btn` or remove — confirm)
- Sessions list `<ul>`: add `nsw-link-list`; each `<li>`: add `nsw-link-list__item`; keep `.session-name` / `.session-date` spans for flex layout

### 5. `src/app/sessions/[id]/SessionView.tsx`
- Copy link button: add `nsw-button nsw-button--outline` classes; keep `.copied` state class with a CSS override for green success colour

## What is NOT touched
- `src/lib/gherkin.ts` — Do Not Touch
- `src/components/GherkinEditor.tsx` — functional code unchanged
- All Tiptap / Y.js config, Prisma/API/auth code, e2e tests

## Verification
1. `npm install` — no errors
2. `npm run dev` + `npm run dev:ws` — app loads at localhost:3000
3. Visual: light background, NSW DS blue buttons, Public Sans font in shell
4. Visual: editor canvas is white with monospace type; keyword colours match mapping table
5. `npm run test` — all Vitest tests pass
6. `npx playwright test` — all e2e tests pass
