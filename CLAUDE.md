# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**348** is a homage to Sanzo Wada (1883–1967). It's a phone-first, installable, offline website for browsing the 348 color combinations in *A Dictionary of Color Combinations*. Seigensha publishes the book today; it began as Wada's *Haishoku Sōkan* (1933–34).

- Live: https://jocampo.github.io/348/ (public repo `jocampo/348`, GitHub Pages from `main`)
- The local folder is still named `haishoku/`, the project's first working name.
- The goal is to be the faithful pocket reference to the book: every combination numbered as in the book, with HEX/RGB/CMYK values to copy, saved favorites, and exports for the tools people use. It is meant to work better on phones than existing sites (sanzo-wada.dmbk.io, haishokusoukan.com). The book's audience grows mostly through social media, and many of them are illustrators on iPad.

## Decisions to keep

- **Name and tagline:** "348" with "A homage to Sanzo Wada". It was renamed from "Haishoku" because haishokusoukan.com uses nearly the same name. That site remixes the same dataset into gradients and wallpapers rather than reproducing the book. Don't bring back "Haishoku" or 配色 branding.
- **Attribution:** this is an independent project. Never imply affiliation with Seigensha or the Wada estate, never use scans of the book or its cover, and never use Seigensha's name as branding. Keep the credits and disclaimer on the About page, and keep `data/LICENSE`, which the data's MIT license requires.
- **Data:** `data/colors.json` comes from mattdesl/dictionary-of-colour-combinations, which builds on dblodorn/sanzo-wada. The upstream converted the book's CMYK values to sRGB with ICC profiles (U.S. Web Coated SWOP v2 to sRGB). Our only edits were removing `lab` and fixing "Calamine BLue". Odd spellings such as "Pomegranite", "Sulpher", "Cerulian", "Antwarp" and "Vandar Poel's Blue" are the source's names, so leave them.
- **Color order:** the data doesn't record the order of colors within a combination, so the app shows them in color-index order.
- **Stack:** plain HTML, CSS and ES modules, with no build step, dependencies or CDN scripts. Google Fonts (Newsreader, IBM Plex Mono) are the only third-party requests. Keep every path relative, because the site runs under `/348/` today and may move to a domain root later.
- **Domain:** none yet. 348.com is taken (registered 1998, renewed through 2030, no site). An RDAP check on 2026-10-17 showed 348.design (the preferred option), 348.studio, 348.ink, 348colors.com and wada348.com unregistered; 348.app and the348.com are taken. The domain will be connected under Settings → Pages.

## Commands

There is no build, lint, test suite or package manager. The dev machine runs Windows without Node or Python, so tooling uses PowerShell.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1              # http://localhost:5173 (-Port to change)
powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-icons.ps1         # regenerate icons/*.png
```

- Use the server rather than `file://`, because the service worker needs http(s). In the Claude desktop app, a preview config named `348` runs it; it lives one folder up, in `../.claude/launch.json`.
- The icons show combination No. 241's four colors on the ink background. `icons/favicon.svg` is drawn by hand to match.
- **Deploy:** a push to `main` publishes the site through GitHub Pages in about a minute (branch build from the root, HTTPS enforced; `.nojekyll` skips Jekyll). Pushing changes the public site, so ask before pushing.
- The GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` and logged in as `jocampo`. It may not be on Git Bash's PATH.

## Architecture

`index.html` is the shell: the top bar, the tab `nav`, `<main>`, `<dialog id="sheet">` and the toast. The `nav` sits outside the header on purpose: on phones it's the fixed bottom bar, and it has to stay visible while detail views hide the header. `app.js` runs the app, and `export.js` holds the export and image code.

**Data.** `colors.json` is an array of colors with `{ name, combinations: [ids], swatch: chapter 0–5, cmyk, rgb, hex }`. `loadData()` builds the combinations at startup by inverting each color's `combinations` list:

| Numbers | Size |
| --- | --- |
| 1–120 | pairs |
| 121–240 | trios |
| 241–348 | quartets |

Each color also gets:
- `index`
- `slug`, used in routes and saved keys
- `ink`, either `ink-dark` or `ink-light`, picked by WCAG contrast. It's used as a CSS class that sets `--on`, the text color on a swatch.

The chapter labels in `CHAPTERS` are our own descriptive names.

**Views.** Each view function returns `{ tab, title, html, detail?, prev?, next?, palette?, after? }`, and `render()` puts the `html` into `<main>`. HTML is built with template strings, so pass any data text through `esc()`.

**Routing.** Routes are hash-based: `#/`, `#/c/:id`, `#/colors`, `#/color/:slug`, `#/saved`, `#/about`.
- `navStack` mirrors in-app history, so the Back button calls `history.back()` only when the person arrived from inside the app (a shared link falls back to the `href`).
- Prev/next paging uses `location.replace` (with `replacing = true`) so swiping doesn't pile up history entries.
- List routes restore their scroll position; detail routes open at the top.

**Transitions.**
- `render()` sets `current` before starting the View Transition, not inside its callback, so a fast second swipe sees the new page.
- `<html data-nav="next|prev|fade">` drives the CSS slide animations on `main` (`view-transition-name: page`).
- Rejections from `ready` and `finished` are swallowed on purpose, because interrupted transitions are expected.

**Events.**
- One delegated `click` handler dispatches on data attributes: `data-copy` (with `data-hex` and `data-label`), `data-save`, `data-sheet`, `data-export`, `data-close`, `data-filter`, `data-random`, `data-back`, `data-dir`. New controls should follow this pattern.
- Swipes use pointer events on `[data-swipe]`: touch only, ignoring the 24px at each screen edge, with `touch-action: pan-y` on the container.
- Arrow keys page through detail views.

**State.** localStorage key `348:v1` holds `{ saved: ['c:241', 'k:peacock-blue', …] (newest first), filter }`, and every access is wrapped in try/catch. Renaming the key wipes everyone's saved items.

**Share and export sheet.**
- Detail views return a `palette` (`{ title, sub, name, file, heading, aside, colors }`), which `openSheet()` renders into the `<dialog>`.
- `openSheet()` draws the story card and wallpaper PNGs as soon as the sheet opens. `navigator.share({ files })` needs a fresh user tap, so don't put slow work between the tap and the share call.
- Files go to the system share sheet only on coarse-pointer devices where `canShare` accepts them; everywhere else they download.

**`export.js`** provides:
- CSS custom properties and a Tailwind v4 `@theme` block.
- Procreate `.swatches`: a store-only zip containing `Swatches.json`, with hue, saturation and brightness from 0 to 1.
- Adobe `.ase`: big-endian, one group, RGB floats.
- `drawCard`: 1080×1920, keeping text out of the top and bottom 250px where story apps put their controls.
- `drawWallpaper`: sized to the device's physical pixels, capped near 16 MP for iOS canvas limits.

Canvas text must wait for `fontsReady()`; otherwise it silently falls back to a system font.

**Styles.**
- Color tokens live on `:root`, with dark-mode overrides under `prefers-color-scheme`.
- Phone-first, with breakpoints at 600px and 860px. At 860px and up, the tabs move into the top bar and combination bands sit side by side.
- Below 860px, detail routes set `body[data-detail="true"]`, which hides the top bar so the page feels like a pushed screen.

**Service worker (`sw.js`).**
- Precaches `APP_FILES`.
- Same-origin requests are network-first with a 3.5-second timeout, so updates appear on the next online visit. Google Fonts requests are cache-first.
- On activate, it deletes every cache except the current ones.
- Whenever you add or rename an app file, add it to `APP_FILES` and bump `VERSION`.
- It's registered with a relative path, so its scope is `/348/` on Pages.

## Testing

There are no automated tests. Check changes in the browser at phone size (375×812) and desktop size, in both light and dark mode.

- When the Claude desktop browser pane is hidden it paints no frames. View transitions then stall before updating the DOM, and screenshots may come back mid-transition or blank. Take a screenshot to force a frame, or set `document.startViewTransition = undefined` in the test page only.
- To simulate a swipe, dispatch `PointerEvent`s with `pointerType: 'touch'` on an element inside `[data-swipe]`.
- To test offline: load the page once, stop the server, then do a full reload.
- Reading the clipboard is blocked in the pane, so check the toast instead.
- The console reader can show errors left over from earlier page loads. Confirm a live error with an `unhandledrejection` listener.

## Status and ideas

- **Live:** browsing, detail pages, copy, save, search, swipe paging, install and offline, and the share/export sheet.
- **Not yet tried on real devices:**
  - installing to the home screen
  - touch swipes
  - copying on iOS
  - the share sheet in iOS Safari
  - importing `.swatches` into Procreate and `.ase` into Adobe apps
- **Discussed but not built:**
  - previews that show a combination in use, as one dominant color plus accents
  - picking a color from a photo to find the nearest Wada color and its combinations
  - more print-accurate conversion (for example, the Japan Color 2001 Coated profile instead of SWOP)
  - contrast checks
  - a "combination of the day". A home-screen widget would need a native app, and the plan is to stay a PWA unless a native app becomes necessary.
- **License:** the app code has none yet, so it's all rights reserved by default. The data is MIT.
