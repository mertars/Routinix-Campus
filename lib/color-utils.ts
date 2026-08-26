export type AccentRamp = {
  50: string;
  100: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgbTriplet(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) / 360;
  const sat = Math.min(Math.max(s, 0), 100) / 100;
  const light = Math.min(Math.max(l, 0), 100) / 100;

  if (sat === 0) {
    const gray = Math.round(light * 255);
    return `${gray} ${gray} ${gray}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const r = hue2rgb(p, q, hue + 1 / 3);
  const g = hue2rgb(p, q, hue);
  const b = hue2rgb(p, q, hue - 1 / 3);

  return `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
}

const clampL = (value: number) => Math.min(Math.max(value, 4), 97);

// Seçilen rengi "600" katmanına oturtup, o rengin etrafında (Tailwind'in
// kendi paletlerindeki gibi) açık/koyu bir ton skalası üretir. Böylece her
// özel renk (turuncu dışındaki her renk dahil) rozetler, arka planlar ve
// koyu tonlar için de tutarlı bir görünüm kazanır.
export function generateAccentRamp(baseHex: string): AccentRamp {
  const { h, s, l } = hexToHsl(baseHex);
  return {
    50: hslToRgbTriplet(h, s * 0.45, clampL(l + 52)),
    100: hslToRgbTriplet(h, s * 0.6, clampL(l + 47)),
    300: hslToRgbTriplet(h, s, clampL(l + 34)),
    400: hslToRgbTriplet(h, s, clampL(l + 22)),
    500: hslToRgbTriplet(h, s, clampL(l + 11)),
    600: hslToRgbTriplet(h, s, l),
    700: hslToRgbTriplet(h, Math.min(s + 4, 100), clampL(l - 9)),
    800: hslToRgbTriplet(h, Math.min(s + 8, 100), clampL(l - 15)),
  };
}

// Routinix Turuncu — marka kimliğinin tek gerçek kaynağı (login/rol seçimi
// ekranlarındaki neon turuncuyla birebir aynı hex). Buradan üretilen ramp,
// ':root'taki başlangıç değerleriyle (bkz. app/globals.css) senkron tutulmalı
// — aksi halde JS hydrate olana kadar yanlış renkte bir "flash" görünür.
export const DEFAULT_ACCENT_HEX = "#FF6B00";

export const ACCENT_PRESETS: { label: string; hex: string }[] = [
  { label: "Routinix Turuncu", hex: "#FF6B00" },
  { label: "Neon Mavi", hex: "#2563EB" },
  { label: "Zümrüt Yeşili", hex: "#10B981" },
  { label: "Mor", hex: "#7C3AED" },
  { label: "Pembe", hex: "#DB2777" },
];
