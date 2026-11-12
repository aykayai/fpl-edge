# The Scout: icon set prompt for Figma

Paste everything between the lines into Figma's AI design tool. When it is done, export as described under "Delivery" and drop the files in `fpl-signals/design/scout-icon/`.

---

Design an icon set for "The Scout", the AI assistant inside FPL Signals, a dark, minimal Fantasy Premier League planner. The Scout studies players and fixtures and gives clear, evidence-backed transfer advice. Its persona is a sharp-eyed football scout: watchful, calm, trustworthy, a little friendly. It is a sibling of two existing assistant icons (Fintel's and Jeevs's), each a rounded-square face with two dot eyes, a small smile and one distinguishing accent. Keep that family resemblance: same proportions, same flat style, same stroke weights. The Scout's distinguishing accent is scouting: for example, one eye seen through a small round lens or monocular, or a pair of binocular lenses for eyes. Pick the version that reads best at 20px. Do not use a football, a whistle or a referee card. The accent must not dominate the face.

Style rules:
- Flat vector only: no gradients, shadows, glows, textures or 3D.
- Rounded joins and caps. On the 24px grid, use a 2px stroke for line work.
- Colours, exact hex only:
  - accent orange #E8743B (FPL Signals' brand orange);
  - page base #0A0A0A;
  - card surface #171717;
  - raised ring #404040;
  - light #EDEDED.
- Glyphs drawn on an orange disc use #0A0A0A. Glyphs drawn on a dark disc use #E8743B.
- Every mark must stay legible at 20px, so test it at 20px before finishing. No detail thinner than 1.5px at 24px.
- Square artboards. The 56px launchers are circles that fill the artboard edge to edge, with a 2px inner ring where noted.

Produce exactly these 8 frames, each on its own artboard at 1x:

1. `01-launcher-primary-56`: 56×56. An orange #E8743B disc with The Scout's face in #0A0A0A, centred, filling about 60% of the disc. The main floating button.
2. `02-launcher-dark-56`: 56×56. A #171717 disc with a 2px #404040 inner ring and the face in #E8743B. It must still stand out on a #171717 card.
3. `03-avatar-28`: 28×28. The chat avatar beside answers: an orange disc and a #0A0A0A face, simplified for 28px.
4. `04-avatar-20`: 20×20. The same avatar further simplified. Drop any detail that blurs at 20px; the lens accent must survive.
5. `05-glyph-24-currentColor`: 24×24, transparent background. A single-colour line glyph of the face in the Lucide icon style: 2px stroke, round caps and joins, no fills except the dot eyes. Use the colour `currentColor` so the app can tint it.
6. `06-state-idle-56`: 56×56. Identical to frame 1.
7. `07-state-hover-56`: 56×56. Frame 1 with the face looking up and to the right (eyes shifted 2px), and the disc one step lighter, #F08A55.
8. `08-state-thinking-56`: 56×56. Frame 1 with the lens accent turned into three small dots (…) or the eyes half closed in concentration, so it reads as "working on it".

Show all 8 side by side on #0A0A0A and again on #171717, so contrast can be checked.

---

## Delivery

1. Export each of the 8 frames as **SVG** (Export → SVG; tick **Outline text**; leave **Include "id" attribute** unticked).
2. Use these exact file names: `01-launcher-primary-56.svg`, `02-launcher-dark-56.svg`, `03-avatar-28.svg`, `04-avatar-20.svg`, `05-glyph-24-currentColor.svg`, `06-state-idle-56.svg`, `07-state-hover-56.svg`, `08-state-thinking-56.svg`.
3. In `05-glyph-24-currentColor.svg`, open it in a text editor and check every `stroke=` and `fill=` that is not `none` says `currentColor`. If Figma wrote a hex value, replace it with `currentColor`.
4. Put the 8 files in `C:\Users\My Acer\Desktop\aykay AI\fpl-signals\design\scout-icon\`, or zip them and tell me where the zip is.
5. Optional: a PNG of the side-by-side contrast sheet, saved in the same folder as `contact-sheet.png`.
