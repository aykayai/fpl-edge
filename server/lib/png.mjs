/* FPL Signals server - a half-size copy of a PNG (audit follow-up, 22 Nov
   2026). Player photos are 220x280 and about 110 KB, but most faces are drawn
   24-50px wide; a 110x140 copy is about a quarter of the bytes. No packages:
   decode (8-bit RGB/RGBA, not interlaced), average each 2x2 block, encode
   with Node's zlib. Anything else returns null and the full image is served. */
import { inflateSync, deflateSync, crc32 } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) return null;
  const out = []; let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString("latin1", i + 4, i + 8);
    out.push({ type, data: buf.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
    if (type === "IEND") break;
  }
  return out;
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

export function pngHalf(buf, minW = 0) {
  const cs = chunks(buf); if (!cs) return null;
  const ih = cs.find(c => c.type === "IHDR"); if (!ih) return null;
  const w = ih.data.readUInt32BE(0), h = ih.data.readUInt32BE(4), depth = ih.data[8], ctype = ih.data[9], inter = ih.data[12];
  if (depth !== 8 || inter !== 0 || (ctype !== 6 && ctype !== 2) || w < minW) return null;
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(cs.filter(c => c.type === "IDAT").map(c => c.data)));
  if (raw.length < (stride + 1) * h) return null;
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      const v = row[x];
      px[o + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : f === 4 ? v + paeth(a, b, c) : v) & 255;
    }
  }
  const W = w >> 1, H = h >> 1, out = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    out[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, bl = 0, al = 0;
      for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        const i = (2 * y + dy) * stride + (2 * x + dx) * bpp, alpha = bpp === 4 ? px[i + 3] : 255;
        /* weight colour by alpha so transparent edges don't darken the face */
        r += px[i] * alpha; g += px[i + 1] * alpha; bl += px[i + 2] * alpha; al += alpha;
      }
      const o = y * (W * 4 + 1) + 1 + x * 4;
      out[o] = al ? Math.round(r / al) : 0; out[o + 1] = al ? Math.round(g / al) : 0; out[o + 2] = al ? Math.round(bl / al) : 0; out[o + 3] = Math.round(al / 4);
    }
  }
  const chunk = (type, data) => { const t = Buffer.from(type, "latin1"), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); };
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(W, 0); hdr.writeUInt32BE(H, 4); hdr[8] = 8; hdr[9] = 6; hdr[10] = 0; hdr[11] = 0; hdr[12] = 0;
  return Buffer.concat([SIG, chunk("IHDR", hdr), chunk("IDAT", deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
