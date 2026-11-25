# FPL Signals brand: Convergence (25 Nov 2026)

Andy chose direction A, "Convergence": three blades meeting at one point, in the UI green #2DDC87.

- `brand/`: logo-mark (colour, mono, small-size), lockups for dark and light backgrounds, favicon (svg, 16, 32), iPhone 180, app icons 192 and 512, Android maskable 512, share image 1200x630.
- `preview/brand-board.png`: the contact sheet.
- The Scout's 8 icons live in `../scout-icon/` and are embedded with `node scripts/scout-icons.mjs`.
- The site uses the root copies of favicon.svg, favicon-16/32.png, apple-touch-icon.png, icon-192/512.png, icon-512-maskable.png and og-image.png; the header mark is the LOGO constant in app-core.js.

To regenerate: in this folder run `npm i @resvg/resvg-js opentype.js geist`, then `node build.mjs` (writes to ./out).
