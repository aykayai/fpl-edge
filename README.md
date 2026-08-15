# FPL Edge

Fantasy Premier League planner, projections and transfer assistant.

**Live:** https://aykayai.github.io/fpl-edge/

A single self-contained page. Player, fixture and match data are fetched at
runtime from the [FPL Core Insights](https://github.com/olbauday/FPL-Core-Insights)
dataset, so stats stay current without redeploying — only the app itself needs
republishing when it changes.

## Contents

| File | Purpose |
|---|---|
| `index.html` | The whole application |
| `manifest.json` | Web app manifest for Add to Home Screen |
| `icon-192.png`, `icon-512.png` | App icons |
| `apple-touch-icon.png` | iOS home-screen icon |
| `favicon-32.png` | Browser tab icon |

## Updating

Replace `index.html` and commit. GitHub Pages redeploys within a minute or two.
Squad, chips and shortlist live in browser storage and survive updates.
