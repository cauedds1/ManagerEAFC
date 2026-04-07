import { ClubColors } from "./clubColors";

export const SYSTEM_COLORS: ClubColors = {
  primary: "#8B5CF6",
  secondary: "#6366F1",
};

let currentColors: ClubColors = SYSTEM_COLORS;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(h, Math.min(s + 10, 100), Math.max(l - amount, 0));
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function applyTheme(colors: ClubColors): void {
  currentColors = colors;
  const root = document.documentElement;

  const [r1, g1, b1] = hexToRgb(colors.primary);
  const [h1, s1] = rgbToHsl(r1, g1, b1);
  const [r2, g2, b2] = hexToRgb(colors.secondary);

  const bgHex = hslToHex(h1, Math.min(s1, 30), 4);
  const bgLighterHex = hslToHex(h1, Math.min(s1, 25), 7);

  root.style.setProperty("--club-primary", colors.primary);
  root.style.setProperty("--club-secondary", colors.secondary);
  root.style.setProperty("--club-primary-rgb", `${r1},${g1},${b1}`);
  root.style.setProperty("--club-secondary-rgb", `${r2},${g2},${b2}`);
  root.style.setProperty("--app-bg", bgHex);
  root.style.setProperty("--app-bg-lighter", bgLighterHex);
  root.style.setProperty(
    "--surface",
    withAlpha(colors.primary, 0.06)
  );
  root.style.setProperty(
    "--surface-border",
    withAlpha(colors.primary, 0.1)
  );
  root.style.setProperty(
    "--surface-hover",
    withAlpha(colors.primary, 0.12)
  );
  root.style.setProperty("--glow", withAlpha(colors.primary, 0.15));
  root.style.setProperty(
    "--club-gradient",
    `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
  );
  root.style.setProperty(
    "--club-gradient-subtle",
    `linear-gradient(135deg, ${withAlpha(colors.primary, 0.15)}, ${withAlpha(colors.secondary, 0.08)})`
  );

  const [bgR, bgG, bgB] = hexToRgb(bgHex);
  const [bgH, bgS, bgL] = rgbToHsl(bgR, bgG, bgB);
  root.style.setProperty("--background", `${bgH} ${bgS}% ${bgL}%`);

  root.style.setProperty(
    "--blob-1",
    withAlpha(colors.primary, 0.08)
  );
  root.style.setProperty(
    "--blob-2",
    withAlpha(colors.secondary, 0.06)
  );
  root.style.setProperty(
    "--blob-3",
    withAlpha(colors.primary, 0.04)
  );
}

export function resetTheme(): void {
  applyTheme(SYSTEM_COLORS);
}

export function getCurrentColors(): ClubColors {
  return currentColors;
}

export function getContrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export { darken, withAlpha, hexToRgb, rgbToHsl };

function proxyUrl(original: string): string {
  try {
    const u = new URL(original);
    if (u.hostname === "media.api-sports.io" || u.hostname === "cdn.sofifa.net") {
      return `/api/proxy/image?url=${encodeURIComponent(original)}`;
    }
  } catch { /* ignore */ }
  return original;
}

function extractWithImg(src: string): Promise<ClubColors | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => resolve(null), 6000);

    img.onload = async () => {
      clearTimeout(timeout);
      try {
        const { default: ColorThief } = await import("color-thief-browser");
        const thief = new ColorThief();
        const palette = thief.getPalette(img, 3);
        if (palette && palette.length >= 2) {
          const toHex = (rgb: number[]) =>
            "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
          resolve({ primary: toHex(palette[0]), secondary: toHex(palette[1]) });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = src;
  });
}

export async function extractColorsFromImage(
  imageUrl: string
): Promise<ClubColors> {
  const proxied = proxyUrl(imageUrl);
  const result = await extractWithImg(proxied);
  if (result) return result;

  if (proxied !== imageUrl) {
    const direct = await extractWithImg(imageUrl);
    if (direct) return direct;
  }

  return SYSTEM_COLORS;
}
