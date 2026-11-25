/* FPL Signals brand pack: Convergence in UI green #2DDC87 (Andy, 25 Nov 2026).
   node build.mjs  ->  out/brand, out/scout, out/preview (+ review sheets) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";

const D = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(D, "out");
for (const d of ["brand", "scout", "preview", "review"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const loadFont = p => { const b = fs.readFileSync(p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const FONT_SEMI = loadFont(path.join(D, "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"));
const FONT_REG = loadFont(path.join(D, "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf"));

const C = { ink: "#0A0A0A", card: "#171717", raised: "#262626", line: "#404040", text: "#EDEDED", mute: "#A3A3A3", green: "#2DDC87", orange: "#E8743B", orangeHi: "#F08A55" };

/* ---------- the mark ----------
   Large: three blades meeting at one point, in a 200 x 170 box (traced from
   the chosen Figma board, edges made parallel, one shared tip at (198, 86)).
   Small: the same idea re-drawn on a 24 grid with thicker blades and real
   gaps, so three blades still read at 16 px. */
const BIG = [
  "56,6 100,6 198,84 148,79",        // upper blade
  "30,61 198,86 12,103",             // middle blade (a long wedge)
  "0,164 58,164 192,92 114,99",      // lower blade
];
const SMALL = [
  "6.2,3.3 10.9,3.3 21.9,11.1 16.9,11.1",
  "3.4,10.1 21.6,12.4 1.9,14.7",
  "1.0,20.7 7.0,20.7 21.6,13.8 13.3,14.5",
];
const blades = (pts, fill) => pts.map(p => `<polygon points="${p}" fill="${fill}"/>`).join("");
/* the large mark centred in a square box of side `s` at (x, y), using `w` of its width */
const bigAt = (x, y, s, fill, w = 0.82) => { const k = (s * w) / 200, ox = x + (s - 200 * k) / 2, oy = y + (s - 170 * k) / 2;
  return `<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(5)})">${blades(BIG, fill)}</g>`; };
const smallAt = (x, y, s, fill) => { const k = s / 24; return `<g transform="translate(${x} ${y}) scale(${k.toFixed(5)})">${blades(SMALL, fill)}</g>`; };
const svg = (w, h, body, vb) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb || `0 0 ${w} ${h}`}">${body}</svg>\n`;

/* ---------- text as outlines ---------- */
function textPath(str, font, size, x, y, fill) {
  const p = font.getPath(str, x, y, size); p.fill = fill;
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), bb, el: `<path d="${p.toPathData(2)}" fill="${fill}"/>` };
}
const textWidth = (str, font, size) => { const p = font.getPath(str, 0, 0, size).getBoundingBox(); return p.x2 - p.x1; };

/* ---------- lockup: mark + "FPL Signals", height 40 ---------- */
function lockup(markFill, textFill) {
  const H = 40, markW = 46, markH = markW * 170 / 200, gap = 11, size = 25;
  const tw = textWidth("FPL Signals", FONT_SEMI, size);
  const capH = FONT_SEMI.charToGlyph("F").getBoundingBox().y2 * size / FONT_SEMI.unitsPerEm;
  const base = H / 2 + capH / 2;
  const k = markW / 200, my = (H - markH) / 2;
  const t = textPath("FPL Signals", FONT_SEMI, size, markW + gap, base, textFill);
  const W = Math.ceil(markW + gap + tw + 2);
  return svg(W, H, `<g transform="translate(0 ${my.toFixed(2)}) scale(${k.toFixed(5)})">${blades(BIG, markFill)}</g>${t.el}`);
}

/* ---------- The Scout ----------
   Same family as before (rounded-square face, dot eye, lens eye), now built
   from Convergence: the smile is a short blade and a small blade sits over
   the lens like a raised brow. Drawn on a 24 grid, centred in the disc. */
function scoutFace(ink, o = {}) {
  const dx = o.look ? 0.9 : 0, dy = o.look ? -0.9 : 0;
  const eyeL = o.thinking
    ? `<path d="M6.9 ${10.6 + dy} q1.5 1.1 3 0" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>`
    : `<circle cx="${8.4 + dx}" cy="${10.7 + dy}" r="1.45" fill="${ink}"/>`;
  const lens = o.thinking
    ? `<g fill="${ink}"><circle cx="13.2" cy="10.5" r="1.05"/><circle cx="15.5" cy="10.5" r="1.05"/><circle cx="17.8" cy="10.5" r="1.05"/></g>`
    : `<circle cx="${15 + dx}" cy="${10.4 + dy}" r="2.85" fill="none" stroke="${ink}" stroke-width="1.8"/><circle cx="${15 + dx}" cy="${10.4 + dy}" r="1.1" fill="${ink}"/>`;
  const brow = o.thinking ? "" : `<polygon points="${12.4 + dx},${5.9 + dy} ${15.2 + dx},${5.9 + dy} ${19.6 + dx},${7.6 + dy} ${16.6 + dx},${7.6 + dy}" fill="${ink}"/>`;
  const smile = `<polygon points="7.6,15.3 17.4,15.8 8.4,17.6" fill="${ink}"/>`;
  return `<rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5" fill="none" stroke="${ink}" stroke-width="2"/>${eyeL}${lens}${brow}${smile}`;
}
function scoutDisc(size, disc, ink, o = {}) {
  const ring = o.ring ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="${C.line}" stroke-width="2"/>` : "";
  const f = size * (o.face || 0.6) / 24, off = (size - 24 * f) / 2;
  return svg(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${disc}"/>${ring}<g transform="translate(${off.toFixed(2)} ${off.toFixed(2)}) scale(${f.toFixed(5)})">${scoutFace(ink, o)}</g>`);
}
/* small avatars drop the brow and thicken the strokes */
function scoutSmall(size) {
  const f = size * 0.66 / 24, off = (size - 24 * f) / 2, ink = C.ink;
  const face = `<rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5" fill="none" stroke="${ink}" stroke-width="${size <= 20 ? 2.6 : 2.2}"/>
    <circle cx="8.3" cy="10.6" r="${size <= 20 ? 1.9 : 1.6}" fill="${ink}"/>
    <circle cx="15" cy="10.4" r="${size <= 20 ? 3.1 : 2.9}" fill="none" stroke="${ink}" stroke-width="${size <= 20 ? 2.3 : 2}"/>${size <= 20 ? "" : `<circle cx="15" cy="10.4" r="1.1" fill="${ink}"/>`}
    <polygon points="7.4,15.2 17.6,15.8 8.4,18.2" fill="${ink}"/>`;
  return svg(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${C.orange}"/><g transform="translate(${off.toFixed(2)} ${off.toFixed(2)}) scale(${f.toFixed(5)})">${face}</g>`);
}
const scoutGlyph = () => svg(24, 24, `<rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="8.4" cy="10.7" r="1.45" fill="currentColor"/><circle cx="15" cy="10.4" r="2.8" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M8.2 15.6 L16.8 15.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`);

/* ---------- write files ---------- */
const W = (rel, s) => fs.writeFileSync(path.join(OUT, rel), s);
const png = (svgStr, w, file) => { const r = new Resvg(svgStr, { fitTo: { mode: "width", value: w }, background: "rgba(0,0,0,0)" }); fs.writeFileSync(path.join(OUT, file), r.render().asPng()); };

W("brand/logo-mark.svg", svg(40, 40, bigAt(0, 0, 40, C.green, 0.96)));
W("brand/logo-mark-mono.svg", svg(40, 40, bigAt(0, 0, 40, "currentColor", 0.96)));
W("brand/logo-mark-small.svg", svg(24, 24, blades(SMALL, C.green)));
W("brand/logo-lockup.svg", lockup(C.green, C.text));
W("brand/logo-lockup-light.svg", lockup(C.ink, C.ink));
const fav = svg(32, 32, `<rect width="32" height="32" rx="7" fill="${C.ink}"/>${smallAt(2, 2, 28, C.green)}`);
W("brand/favicon.svg", fav);
png(fav, 16, "brand/favicon-16.png"); png(fav, 32, "brand/favicon-32.png");
const tile = (s, r, w) => svg(s, s, `<rect width="${s}" height="${s}" rx="${r}" fill="${C.ink}"/>${bigAt(0, 0, s, C.green, w)}`);
png(svg(180, 180, `<rect width="180" height="180" fill="${C.ink}"/>${bigAt(0, 0, 180, C.green, 0.6)}`), 180, "brand/apple-touch-icon.png");
png(tile(192, 42, 0.62), 192, "brand/icon-192.png");
png(tile(512, 113, 0.62), 512, "brand/icon-512.png");
png(svg(512, 512, `<rect width="512" height="512" fill="${C.ink}"/>${bigAt(0, 0, 512, C.green, 0.52)}`), 512, "brand/icon-512-maskable.png");
/* share image */
{ const lk = lockup(C.green, C.text), m = /width="(\d+)" height="40" viewBox="0 0 \d+ 40">([\s\S]*)<\/svg>/.exec(lk);
  const lw = +m[1], k = 2.6, ox = (1200 - lw * k) / 2, oy = 245;
  const tag = "Signals for every Fantasy Premier League decision", tw = textWidth(tag, FONT_REG, 30);
  const t = textPath(tag, FONT_REG, 30, (1200 - tw) / 2, 420, C.mute);
  png(svg(1200, 630, `<rect width="1200" height="630" fill="${C.ink}"/><g transform="translate(${ox.toFixed(1)} ${oy}) scale(${k})">${m[2]}</g>${t.el}`), 1200, "brand/og-image.png"); }
/* The Scout */
W("scout/01-launcher-primary-56.svg", scoutDisc(56, C.orange, C.ink));
W("scout/02-launcher-dark-56.svg", scoutDisc(56, C.card, C.orange, { ring: true }));
W("scout/03-avatar-28.svg", scoutSmall(28));
W("scout/04-avatar-20.svg", scoutSmall(20));
W("scout/05-glyph-24-currentColor.svg", scoutGlyph());
W("scout/06-state-idle-56.svg", scoutDisc(56, C.orange, C.ink));
W("scout/07-state-hover-56.svg", scoutDisc(56, C.orangeHi, C.ink, { look: true }));
W("scout/08-state-thinking-56.svg", scoutDisc(56, C.orange, C.ink, { thinking: true }));

/* ---------- review sheet: every asset at real size, then magnified small sizes ---------- */
const rd = rel => fs.readFileSync(path.join(OUT, rel), "utf8").replace(/<svg[^>]*>|<\/svg>\s*/g, "");
const sizeOf = rel => { const m = /width="([\d.]+)" height="([\d.]+)"/.exec(fs.readFileSync(path.join(OUT, rel), "utf8")); return [+m[1], +m[2]]; };
const place = (rel, x, y, scale = 1, color) => { const [w, h] = sizeOf(rel); const vb = /viewBox="([^"]+)"/.exec(fs.readFileSync(path.join(OUT, rel), "utf8"))[1].split(" ").map(Number);
  return `<g transform="translate(${x} ${y}) scale(${scale * w / vb[2]})" ${color ? `color="${color}"` : ""}><g transform="translate(${-vb[0]} ${-vb[1]})">${rd(rel)}</g></g>`; };
let body = `<rect width="1600" height="1180" fill="${C.ink}"/>`;
const label = (s, x, y, fill = "#6E6E6E", sz = 13) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Geist" font-size="${sz}">${s.replace(/&/g,"&amp;")}</text>`;
body += label("FPL Signals · Convergence · UI green #2DDC87", 40, 50, C.text, 22);
body += `<rect x="40" y="80" width="760" height="300" rx="18" fill="${C.ink}" stroke="${C.raised}"/>` + place("brand/logo-mark.svg", 330, 120, 5.5);
body += `<rect x="820" y="80" width="740" height="140" rx="18" fill="${C.ink}" stroke="${C.raised}"/>` + place("brand/logo-lockup.svg", 860, 110, 2);
body += `<rect x="820" y="240" width="740" height="140" rx="18" fill="#EDEDED"/>` + place("brand/logo-lockup-light.svg", 860, 270, 2);
/* size strip: large mark and small mark at real sizes */
let x = 60; body += label("Mark at real size: large drawing", 40, 420);
for (const s of [64, 40, 32, 24, 20, 16]) { body += `<g transform="translate(${x} ${440 + (64 - s)})">${place("brand/logo-mark.svg", 0, 0, s / 40)}</g>` + label(s + " px", x, 530); x += s + 34; }
x = 860; body += label("Small-size mark (favicons)", 820, 420);
for (const s of [48, 32, 24, 20, 16]) { body += `<g transform="translate(${x} ${440 + (48 - s)})">${place("brand/logo-mark-small.svg", 0, 0, s / 24)}</g>` + label(s + " px", x, 530); x += s + 34; }
/* app icons */
body += label("Favicon (32 / 16), app icon, maskable, iPhone", 40, 580);
body += place("brand/favicon.svg", 40, 600) + place("brand/favicon.svg", 90, 608, 0.5);
fs.writeFileSync(path.join(OUT, "review/_tile.svg"), tile(512, 113, 0.62));
body += place("review/_tile.svg", 130, 600, 140 / 512);
body += `<rect x="290" y="600" width="140" height="140" fill="${C.ink}" stroke="${C.raised}"/>${bigAt(290, 600, 140, C.green, 0.52)}<circle cx="360" cy="670" r="56" fill="none" stroke="#5A5A5A" stroke-dasharray="4 4"/>`;
body += `<rect x="450" y="600" width="140" height="140" rx="30" fill="${C.ink}" stroke="${C.raised}"/>${bigAt(450, 600, 140, C.green, 0.6)}`;
/* The Scout */
body += label("The Scout: launcher, dark, hover, thinking, avatars 28 / 20, glyph", 820, 580);
x = 820; for (const f of ["01-launcher-primary-56", "02-launcher-dark-56", "07-state-hover-56", "08-state-thinking-56"]) { body += place(`scout/${f}.svg`, x, 600); x += 76; }
body += place("scout/03-avatar-28.svg", x, 614) + place("scout/04-avatar-20.svg", x + 40, 618) + place("scout/05-glyph-24-currentColor.svg", x + 74, 616, 1, C.text);
/* in context: a header, a chat line */
body += `<rect x="40" y="780" width="1520" height="64" rx="14" fill="${C.card}"/>` + place("brand/logo-lockup.svg", 60, 792, 1);
body += label("Planner     Signals     Player Data     Teams", 330, 818, C.mute, 15);
body += place("scout/04-avatar-20.svg", 60, 868) + label("The Scout: Groß projects 31.8 over GW11–15, 4.2 ahead of McGinn.", 90, 883, C.text, 15);
body += place("scout/01-launcher-primary-56.svg", 1480, 860);
/* magnified small sizes so the pixels can be judged */
body += label("Real pixels, magnified x8: favicon 16, large mark at 16, small mark at 16, Scout 20 and 28", 40, 960);
{ const R = (file, px) => new Resvg(fs.readFileSync(path.join(OUT, file), "utf8"), { fitTo: { mode: "width", value: px } }).render().asPng().toString("base64");
  let mx = 40; for (const [f, px] of [["brand/favicon.svg",16],["brand/logo-mark.svg",16],["brand/logo-mark-small.svg",16],["scout/04-avatar-20.svg",20],["scout/03-avatar-28.svg",28]]) {
    body += `<image x="${mx}" y="980" width="${px*8}" height="${px*8}" style="image-rendering:pixelated" href="data:image/png;base64,${R(f,px)}"/>`; mx += px*8 + 40; } }
fs.writeFileSync(path.join(OUT, "review/sheet.svg"), svg(1600, 1240, body.replace('height="1180"','height="1240"')));
{ const r = new Resvg(svg(1600, 1240, body.replace('height="1180"','height="1240"')), { fitTo: { mode: "width", value: 1600 }, font: { fontFiles: [path.join(D, "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf")], loadSystemFonts: false, defaultFontFamily: "Geist" } });
  fs.writeFileSync(path.join(OUT, "preview/brand-board.png"), r.render().asPng()); }
/* magnified 16/20 px rasters */
const magnify = (svgFile, px, file) => { const s = fs.readFileSync(path.join(OUT, svgFile), "utf8"); const r = new Resvg(s, { fitTo: { mode: "width", value: px } }); fs.writeFileSync(path.join(OUT, "review", file), r.render().asPng()); };
magnify("brand/favicon.svg", 16, "fav16.png"); magnify("brand/logo-mark.svg", 16, "mark16.png"); magnify("brand/logo-mark-small.svg", 16, "small16.png"); magnify("scout/04-avatar-20.svg", 20, "scout20.png");
console.log("built", fs.readdirSync(path.join(OUT, "brand")).length, "brand files,", fs.readdirSync(path.join(OUT, "scout")).length, "scout files");
