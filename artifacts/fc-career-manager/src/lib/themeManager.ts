import { ClubColors, DEFAULT_FALLBACK_COLORS } from "./clubColors";

let currentColors: ClubColors | null = null;

export function applyTheme(colors: ClubColors): void {
  currentColors = colors;
  const root = document.documentElement;
  root.style.setProperty("--club-primary", colors.primary);
  root.style.setProperty("--club-secondary", colors.secondary);
  root.style.setProperty(
    "--club-gradient",
    `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
  );
  root.style.setProperty(
    "--club-gradient-subtle",
    `linear-gradient(135deg, ${colors.primary}22, ${colors.secondary}22)`
  );
}

export function resetTheme(): void {
  applyTheme(DEFAULT_FALLBACK_COLORS);
}

export function getCurrentColors(): ClubColors {
  return currentColors ?? DEFAULT_FALLBACK_COLORS;
}

export async function extractColorsFromImage(imageUrl: string): Promise<ClubColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(DEFAULT_FALLBACK_COLORS);
    }, 5000);

    img.onload = async () => {
      clearTimeout(timeout);
      try {
        const { default: ColorThief } = await import("color-thief-browser");
        const thief = new ColorThief();
        const palette = thief.getPalette(img, 3);
        if (palette && palette.length >= 2) {
          const toHex = (rgb: number[]) =>
            "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
          resolve({
            primary: toHex(palette[0]),
            secondary: toHex(palette[1]),
          });
        } else {
          resolve(DEFAULT_FALLBACK_COLORS);
        }
      } catch {
        resolve(DEFAULT_FALLBACK_COLORS);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(DEFAULT_FALLBACK_COLORS);
    };

    img.src = imageUrl;
  });
}
