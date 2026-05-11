# CSS CRAN Garden

A drop-in CSS overlay that modernizes [cran.r-project.org](https://cran.r-project.org/)
without touching its HTML, plus a side-by-side viewer for comparing the
original to the styled version.

**Live demo:** https://rd.thecoatlessprofessor.com/cran-paint-job/

A tribute to the original [CSS Zen Garden](https://csszengarden.com/) (Dave
Shea, 2003): same HTML, restyled entirely through CSS.

## Contents

- `cran-modern.css`: the stylesheet, drop-in for any CRAN mirror.
- `index.html`, `viewer.js`: the side-by-side viewer.
- `fixtures/`: cached CRAN page snapshots used by the viewer.

## Viewer

Serve locally (the iframe injection needs an HTTP origin, not `file://`):

    python3 -m http.server 8000

Then open <http://localhost:8000/>. Features:

- **Compare:** toggle side-by-side vs. paint-job only. Drag the centre
  divider to resize; double-click the divider or click the **↔** button to
  recenter.
- **Mobile:** clamp both iframes to a 390 px phone-size viewport with a
  device-like frame.
- **Theme:** cycle auto, light, and dark for both viewer chrome and iframes.
- **Edit CSS:** live editor for `cran-modern.css` with CSS syntax
  highlighting, line numbers, `Tab` insertion, and ⌘S / Ctrl+S to flush
  immediately. Changes appear in the right iframe within a few hundred
  milliseconds.

## How to adopt on a CRAN mirror

1. Copy `cran-modern.css` to the mirror's web root.
2. Add one line to the existing `<head>` in the page templates:

   ```html
   <link rel="stylesheet" href="/cran-modern.css">
   ```

3. That is all. No HTML changes are required because the stylesheet targets
   the attributes and structure the existing R generators already emit.

## Compatibility

| Browser | Status |
|---|---|
| Chrome / Edge ≥ 121 | Full support |
| Firefox ≥ 121 | Full support |
| Safari ≥ 17.4 | Full support |
| Older browsers | Graceful degradation to CRAN's existing styling |

Uses CSS `:has()`, custom properties, and nested-`:not()` patterns. Older
browsers fall back to CRAN's default look because the unrecognized rules are
simply skipped.

## Design language

Per-page `H1` heroes carry a mono accent eyebrow that identifies the
section:

- `CRAN` for the homepage
- `MIRRORS · GLOBAL NETWORK` for mirrors
- `DIRECTORY · A–Z` for packages by name
- `DIRECTORY · PACKAGES` for packages index
- `DIRECTORY · TASK VIEWS` for task views index
- `DOCUMENTATION · MANUALS` for manuals
- `DOCUMENTATION · FAQ` for FAQs
- `DOWNLOADS · SOURCE` for R sources
- `DOWNLOADS · ADD-ONS` for other software
- `ABOUT · CRAN TEAM` for the CRAN team page

Detection is structural via `:has()` signatures, not HTML changes.

## Limitations

CSS alone cannot do everything. The homepage uses a deprecated `<frameset>`,
which the stylesheet can theme inside each frame but not at the seams between
them; those inter-frame borders remain at the browser's default light gray
in dark mode because CSS on the parent document cannot reach into the
frameset chrome itself. The packages-by-name page ships roughly 23 000 rows
in a single response, so while CSS can visually hide rows it cannot paginate
or reduce the bytes shipped, and proper pagination needs JavaScript. Layout
tables on the homepage would benefit from real ARIA landmarks and roles for
screen readers, but adding those is a markup change rather than a styling
change. Anything behavioral, such as a search box, copy-to-clipboard buttons,
or dependency graphs, is JS-driven and out of scope here.

## License

MIT.
