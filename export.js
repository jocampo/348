// Exports and share images for a palette: one combination, or a single color.
// A palette is { name, file, heading, aside, colors }, where each color has name, slug, hex, rgb and ink.

// ---------- Code snippets ----------

export function cssVariables(p) {
  return `/* ${p.name} · Sanzo Wada, A Dictionary of Color Combinations */
:root {
${p.colors.map((c) => `  --${c.slug}: ${c.hex};`).join('\n')}
}`;
}

// Tailwind v4 reads colors from an @theme block in your CSS.
export function tailwindTheme(p) {
  return `/* ${p.name} · Sanzo Wada, A Dictionary of Color Combinations */
@theme {
${p.colors.map((c) => `  --color-${c.slug}: ${c.hex};`).join('\n')}
}`;
}

// ---------- Procreate (.swatches) ----------

function hsb([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = (g - b) / d;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h / 6 + 1) % 1;
  }
  return { hue: h, saturation: max ? d / max : 0, brightness: max };
}

// A .swatches file is a zip holding Swatches.json. Procreate wants hue, saturation and brightness from 0 to 1.
export function procreateSwatches(p) {
  const json = JSON.stringify([
    { name: p.name, swatches: p.colors.map((c) => ({ ...hsb(c.rgb), alpha: 1, colorSpace: 0 })) },
  ]);
  return zip([{ name: 'Swatches.json', data: new TextEncoder().encode(json) }]);
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A store-only zip (no compression), which is plenty for a few small files.
export function zip(files, date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const entries = files.map((f) => ({ name: new TextEncoder().encode(f.name), data: f.data, crc: crc32(f.data) }));
  const size = entries.reduce((n, e) => n + 30 + 46 + 2 * e.name.length + e.data.length, 22);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let o = 0;

  // Fields shared by the local header and the central directory: version, flags, method, time, date, crc, sizes, name length.
  const common = (at, e) => {
    v.setUint16(at, 10, true); // version needed: 1.0, enough for stored files
    v.setUint16(at + 2, 0, true);
    v.setUint16(at + 4, 0, true); // method 0: stored
    v.setUint16(at + 6, time, true);
    v.setUint16(at + 8, day, true);
    v.setUint32(at + 10, e.crc, true);
    v.setUint32(at + 14, e.data.length, true);
    v.setUint32(at + 18, e.data.length, true);
    v.setUint16(at + 22, e.name.length, true);
  };

  for (const e of entries) {
    e.offset = o;
    v.setUint32(o, 0x04034b50, true);
    common(o + 4, e);
    out.set(e.name, o + 30);
    out.set(e.data, o + 30 + e.name.length);
    o += 30 + e.name.length + e.data.length;
  }

  const dirStart = o;
  for (const e of entries) {
    v.setUint32(o, 0x02014b50, true);
    v.setUint16(o + 4, 20, true); // made by: MS-DOS, zip 2.0
    common(o + 6, e);
    v.setUint32(o + 42, e.offset, true);
    out.set(e.name, o + 46);
    o += 46 + e.name.length;
  }

  v.setUint32(o, 0x06054b50, true);
  v.setUint16(o + 8, entries.length, true);
  v.setUint16(o + 10, entries.length, true);
  v.setUint32(o + 12, o - dirStart, true);
  v.setUint32(o + 16, dirStart, true);
  return out;
}

// ---------- Adobe Swatch Exchange (.ase) ----------

// Big-endian blocks: a group named after the palette, holding one RGB color per swatch.
export function adobeSwatches(p) {
  const strSize = (s) => 2 + 2 * (s.length + 1);
  const colorSize = (c) => strSize(c.name) + 4 + 3 * 4 + 2;
  const size = 12 + (6 + strSize(p.name)) + p.colors.reduce((n, c) => n + 6 + colorSize(c), 0) + 6;
  const v = new DataView(new ArrayBuffer(size));
  let o = 0;
  const u16 = (n) => (v.setUint16(o, n), (o += 2));
  const u32 = (n) => (v.setUint32(o, n), (o += 4));
  const f32 = (n) => (v.setFloat32(o, n), (o += 4));
  const ascii = (s) => [...s].forEach((ch) => v.setUint8(o++, ch.charCodeAt(0)));
  // Length in UTF-16 units including the terminating zero, then the UTF-16BE text.
  const str = (s) => {
    u16(s.length + 1);
    for (let i = 0; i < s.length; i++) u16(s.charCodeAt(i));
    u16(0);
  };

  ascii('ASEF');
  u16(1);
  u16(0);
  u32(p.colors.length + 2);

  u16(0xc001); // group start
  u32(strSize(p.name));
  str(p.name);
  for (const c of p.colors) {
    u16(0x0001); // color entry
    u32(colorSize(c));
    str(c.name);
    ascii('RGB ');
    for (const x of c.rgb) f32(x / 255);
    u16(2); // normal (not global, not spot)
  }
  u16(0xc002); // group end
  u32(0);
  return new Uint8Array(v.buffer);
}

// ---------- Images ----------

export const CARD = { width: 1080, height: 1920 };

const PAPER = '#f4f0e8';
const INK = '#1c1a17';
const INK_2 = '#5f5a51';
const EDGE = 'rgba(28, 26, 23, 0.1)';
const ON = { 'ink-dark': 'rgba(17, 15, 12, 0.88)', 'ink-light': 'rgba(255, 255, 255, 0.95)' };
const SERIF = '"Newsreader", Georgia, serif';
const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';

// Canvas text silently falls back to another font if the web font isn't loaded yet, so load each face first.
async function fontsReady() {
  if (!document.fonts) return;
  const faces = [`400 96px ${SERIF}`, `500 40px ${SERIF}`, `italic 400 40px ${SERIF}`, `400 32px ${MONO}`];
  await Promise.allSettled(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Set the font, shrinking it if the text would run wider than maxWidth.
function fitFont(ctx, text, style, size, family, maxWidth) {
  ctx.font = `${style} ${size}px ${family}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) ctx.font = `${style} ${Math.floor((size * maxWidth) / width)}px ${family}`;
}

// A 1080 × 1920 story card. Text stays clear of the top and bottom 250px, where story apps put their controls.
export async function drawCard(p) {
  await fontsReady();
  const { width: W, height: H } = CARD;
  const M = 96;
  const canvas = canvasOf(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const headY = 328;
  ctx.fillStyle = INK;
  ctx.font = `400 96px ${SERIF}`;
  ctx.fillText(p.heading, M, headY);
  const room = W - 2 * M - ctx.measureText(p.heading).width - 48;
  ctx.fillStyle = INK_2;
  ctx.textAlign = 'right';
  fitFont(ctx, p.aside, 'italic 400', 40, SERIF, room);
  ctx.fillText(p.aside, W - M, headY);
  ctx.textAlign = 'left';

  const top = 384;
  const bottom = 1536;
  const pad = 40;
  const n = p.colors.length;
  const nameSize = n <= 2 ? 60 : 52;
  p.colors.forEach((c, i) => {
    const y0 = Math.round(top + ((bottom - top) * i) / n);
    const y1 = Math.round(top + ((bottom - top) * (i + 1)) / n);
    ctx.fillStyle = c.hex;
    ctx.fillRect(M, y0, W - 2 * M, y1 - y0);
    ctx.fillStyle = ON[c.ink];
    fitFont(ctx, c.name, '400', nameSize, SERIF, W - 2 * M - 2 * pad);
    ctx.fillText(c.name, M + pad, y0 + pad + nameSize * 0.8);
    ctx.font = `400 32px ${MONO}`;
    ctx.fillText(c.hex.toUpperCase(), M + pad, y1 - pad - 4);
  });
  // A faint edge keeps pale colors from melting into the paper.
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.strokeRect(M + 1, top + 1, W - 2 * M - 2, bottom - top - 2);

  const footY = 1640;
  ctx.fillStyle = INK;
  ctx.font = `500 40px ${SERIF}`;
  ctx.fillText('348', M, footY);
  const x = M + ctx.measureText('348').width;
  ctx.fillStyle = INK_2;
  ctx.font = `italic 400 34px ${SERIF}`;
  ctx.fillText(' · A homage to Sanzo Wada', x, footY);
  return canvas;
}

// The device screen in physical pixels, kept under the ~16.7 megapixel canvas limit of mobile Safari.
export function wallpaperSize() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(screen.width * dpr);
  const height = Math.round(screen.height * dpr);
  const scale = Math.min(1, Math.sqrt(16e6 / (width * height)));
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
}

// Plain bands: stacked on a portrait screen, side by side on a landscape one.
export function drawWallpaper(p, { width, height }) {
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  const across = width > height;
  const span = across ? width : height;
  const n = p.colors.length;
  p.colors.forEach((c, i) => {
    const a = Math.round((span * i) / n);
    const b = Math.round((span * (i + 1)) / n);
    ctx.fillStyle = c.hex;
    if (across) ctx.fillRect(a, 0, b - a, height);
    else ctx.fillRect(0, a, width, b - a);
  });
  return canvas;
}

export function toPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), 'image/png');
  });
}
