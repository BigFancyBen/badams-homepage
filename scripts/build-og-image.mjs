/**
 * Builds public/og-homepage.jpg, the card a chat app shows when somebody
 * pastes a link to the site. Three slanted panels cut from screenshots already
 * in /public, over a band with the name on it.
 *
 *   node scripts/build-og-image.mjs
 *
 * Re-run it when the featured projects change. The file is committed, so the
 * build never depends on this script.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => path.join(ROOT, "public", p);
const FONT_DIR = path.join(ROOT, "node_modules", "geist", "dist", "fonts", "geist-mono");

const W = 1200;
const H = 630;
/** Height of the picture strip; the name band takes the rest. */
const STRIP = 474;
/** How far each panel's edge leans over its height, and the gap between panels. */
const LEAN = 84;
const GAP = 8;
const ACCENT = "#81a1c1";
const INK = "#0a0a0a";

/**
 * Each panel: the shot, how much to enlarge it past "just covers the strip",
 * which point of it sits at the panel's centre (0..1), the panel's top edge as
 * [left, right], and its label.
 */
const PANELS = [
  {
    src: "mfrs/06-hats.webp",
    zoom: 1.12,
    focus: [0.6, 0.5],
    top: [0, 724],
    label: "Middle Fork Rafting Simulator",
  },
  {
    src: "prognosticator/warehouse/05-blue-laser-wall.webp",
    zoom: 1,
    focus: [0.45, 0.5],
    top: [724 + GAP, 976],
    label: "Prognosticator",
  },
  {
    src: "prognosticator/sm64/01-jolly-roger-bay.webp",
    zoom: 1.25,
    focus: [0.5, 0.62],
    top: [976 + GAP, W + LEAN],
    label: "SM64 light show",
  },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The panel's outline: a parallelogram leaning left toward the bottom. */
function outline([left, right]) {
  const bl = left === 0 ? 0 : left - LEAN;
  const br = right - LEAN;
  return { points: `${left},0 ${right},0 ${br},${STRIP} ${bl},${STRIP}`, x0: bl, x1: Math.min(right, W) };
}

async function panel({ src, zoom, focus, top }) {
  const { points, x0, x1 } = outline(top);
  const width = x1 - x0;

  const meta = await sharp(pub(src)).metadata();
  const scale = Math.max(width / meta.width, STRIP / meta.height) * zoom;
  const sw = Math.round(meta.width * scale);
  const sh = Math.round(meta.height * scale);
  const left = clamp(Math.round(sw * focus[0] - width / 2), 0, sw - width);
  const topPx = clamp(Math.round(sh * focus[1] - STRIP / 2), 0, sh - STRIP);

  const crop = await sharp(pub(src))
    .resize(sw, sh)
    .extract({ left, top: topPx, width, height: STRIP })
    .modulate({ saturation: 1.12 })
    .toBuffer();

  // Place the crop on a full-width transparent strip, then keep only the outline.
  const placed = await sharp({
    create: { width: W, height: STRIP, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: crop, left: x0, top: 0 }])
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${STRIP}"><polygon points="${points}" fill="#fff"/></svg>`,
  );
  return sharp(placed).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function text(markup, weight, size) {
  const { data, info } = await sharp({
    text: {
      text: markup,
      font: `Geist Mono ${weight} ${size}`,
      fontfile: path.join(FONT_DIR, `GeistMono-${weight}.ttf`),
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

const layers = [];

for (const p of PANELS) {
  layers.push({ input: await panel(p), left: 0, top: 0 });
}

// Shade the foot of the strip so the labels read over any picture.
layers.push({
  input: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${STRIP}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.72" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.78"/>
      </linearGradient></defs>
      <rect width="${W}" height="${STRIP}" fill="url(#g)"/>
    </svg>`,
  ),
  left: 0,
  top: 0,
});

for (const p of PANELS) {
  const label = await text(`<span foreground="#ffffff">${p.label}</span>`, "Medium", 17);
  const { x0 } = outline(p.top);
  layers.push({ input: label.input, left: x0 + 24, top: STRIP - 22 - label.height });
}

// The name band.
layers.push({
  input: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H - STRIP}">
      <rect width="${W}" height="${H - STRIP}" fill="${INK}"/>
      <rect width="${W}" height="3" fill="${ACCENT}"/>
    </svg>`,
  ),
  left: 0,
  top: STRIP,
});

const name = await text(`<span foreground="#ffffff">Ben Adams</span>`, "Bold", 58);
const tagline = await text(
  `<span foreground="#a3a3a3">Games, light shows and tools I built for fun</span>`,
  "Regular",
  23,
);
const url = await text(`<span foreground="${ACCENT}">benadams.dev</span>`, "Medium", 26);

layers.push({ input: name.input, left: 48, top: STRIP + 30 });
layers.push({ input: tagline.input, left: 50, top: STRIP + 104 });
layers.push({ input: url.input, left: W - 48 - url.width, top: STRIP + 62 });

await sharp({ create: { width: W, height: H, channels: 3, background: INK } })
  .composite(layers)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(pub("og-homepage.jpg"));

console.log("wrote public/og-homepage.jpg");
