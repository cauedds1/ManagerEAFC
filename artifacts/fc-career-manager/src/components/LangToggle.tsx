import { useState } from "react";
import type { Lang } from "@/lib/i18n";

interface LangToggleProps {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export function LangToggle({ lang, setLang }: LangToggleProps) {
  const [hovered, setHovered] = useState<Lang | null>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {(["pt", "en"] as Lang[]).map(l => {
        const isActive = lang === l;
        const isHovered = hovered === l;
        const opacity = isActive ? 0.75 : isHovered ? 0.55 : 0.22;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            onMouseEnter={() => setHovered(l)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: "3px 6px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.2s",
              background: "transparent",
              color: "#d0ccff",
              opacity,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
