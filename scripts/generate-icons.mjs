import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32 } from './lib/crc32.mjs';

const OUT_DIR = fileURLToPath(new URL('../public/icons', import.meta.url));

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function roundRectSdf(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ax, ay) - r;
}

const coverage = (sdf) => clamp01(0.5 - sdf);

const COLORS = {
  from: [79, 70, 229],
  to: [147, 51, 234],
  white: [255, 255, 255],
};

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const s = size;
  const outer = { hw: s * 0.5, hh: s * 0.5, r: s * 0.24, cx: s / 2, cy: s / 2 };
  const body = { cx: s * 0.5, cy: s * 0.585, hw: s * 0.315, hh: s * 0.2 };
  const handleOuter = { cx: s * 0.5, cy: s * 0.35, hw: s * 0.145, hh: s * 0.085 };
  const handleInner = { cx: s * 0.5, cy: s * 0.372, hw: s * 0.083, hh: s * 0.06 };
  const slot = { cx: s * 0.5, cy: s * 0.505, hw: s * 0.315, hh: s * 0.024 };
  const latch = { cx: s * 0.5, cy: s * 0.585, hw: s * 0.045, hh: s * 0.05 };

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const i = (y * s + x) * 4;

      const bgSdf = roundRectSdf(px, py, outer.cx, outer.cy, outer.hw, outer.hh, outer.r);
      const bgA = coverage(bgSdf);
      const t = clamp01((px / s) * 0.45 + (py / s) * 0.55);
      let color = mix(COLORS.from, COLORS.to, t);
      let alpha = bgA;

      const apply = (sdf, c, a) => {
        const cov = coverage(sdf) * a;
        color = mix(color, c, cov);
        alpha = alpha + (1 - alpha) * cov;
      };

      if (alpha > 0) {
        apply(roundRectSdf(px, py, handleOuter.cx, handleOuter.cy, handleOuter.hw, handleOuter.hh, s * 0.045), COLORS.white, bgA);
        const inner = roundRectSdf(px, py, handleInner.cx, handleInner.cy, handleInner.hw, handleInner.hh, s * 0.03);
        if (inner < 0) {
          const hide = coverage(inner) * bgA;
          color = mix(color, mix(COLORS.from, COLORS.to, t), hide);
        }
        apply(roundRectSdf(px, py, body.cx, body.cy, body.hw, body.hh, s * 0.1), COLORS.white, bgA);
        apply(roundRectSdf(px, py, slot.cx, slot.cy, slot.hw, slot.hh, s * 0.02), mix(COLORS.from, COLORS.to, t), bgA);
        apply(roundRectSdf(px, py, latch.cx, latch.cy, latch.hw, latch.hh, s * 0.02), mix(COLORS.from, COLORS.to, t), bgA);
      }

      rgba[i] = Math.round(color[0]);
      rgba[i + 1] = Math.round(color[1]);
      rgba[i + 2] = Math.round(color[2]);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const rgba = renderIcon(size);
  const png = encodePng(size, size, rgba);
  writeFileSync(fileURLToPath(new URL(`../public/icons/icon${size}.png`, import.meta.url)), png);
  console.log(`[icons] icon${size}.png (${png.length} bytes)`);
}
