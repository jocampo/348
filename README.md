# 348

A homage to Sanzo Wada: a phone-first website for browsing the 348 color combinations in Sanzo Wada's *A Dictionary of Color Combinations*. You can copy any color as HEX, RGB or CMYK and save favorites. It installs to the home screen and works offline.

Plain HTML, CSS and JavaScript with no build step. Any static host works (GitHub Pages, Netlify, Cloudflare Pages).

## Run locally

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:5173. Use a server rather than opening `index.html` directly, because service workers only run over http(s).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell, tab bar, font and PWA tags |
| `styles.css` | All styles; phone-first with breakpoints at 600px and 860px |
| `app.js` | Data loading, hash router, views, copy/save/share, swipe |
| `data/colors.json` | 159 colors, each listing the combinations it belongs to |
| `sw.js` | Offline cache. Bump `VERSION` when you add or rename app files |
| `manifest.webmanifest`, `icons/` | Install metadata and icons |
| `tools/make-icons.ps1` | Regenerates the PNG icons |
| `tools/serve.ps1` | Local dev server |

## Routes

`#/` combinations · `#/c/241` one combination · `#/colors` · `#/color/peacock-blue` · `#/saved` · `#/about`

## Data and credits

Color data comes from [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) (MIT), which builds on [dblodorn/sanzo-wada](https://github.com/dblodorn/sanzo-wada). The book's CMYK values were converted to sRGB with ICC profiles (U.S. Web Coated SWOP v2 to sRGB). Its license is in [data/LICENSE](data/LICENSE). Two changes were made to the original file: the unused `lab` field was removed, and "Calamine BLue" was corrected to "Calamine Blue".

The data doesn't record the order of colors within a combination, so each combination lists its colors in the book's color-index order.

Independent fan project; not affiliated with Seigensha or the Wada estate.
