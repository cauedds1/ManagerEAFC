import { useState } from "react";
import { ClubEntry } from "@/types/club";

interface ClubCardProps {
  entry: ClubEntry;
  onClick: () => void;
  index: number;
}

export function ClubCard({ entry, onClick, index }: ClubCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const initials = entry.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-3 p-4 rounded-2xl cursor-pointer text-left w-full focus:outline-none focus:ring-2 focus:ring-[var(--club-primary)] focus:ring-offset-2 focus:ring-offset-black"
      style={{
        animationDelay: `${Math.min(index * 25, 500)}ms`,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "transform 200ms ease, border-color 200ms ease, background 200ms ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(-3px) scale(1.03)";
        el.style.borderColor = "var(--club-primary)70";
        el.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(0) scale(1)";
        el.style.borderColor = "rgba(255,255,255,0.08)";
        el.style.background = "rgba(255,255,255,0.04)";
      }}
    >
      <div
        className="relative flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {entry.logo && !imgError ? (
          <>
            <img
              src={entry.logo}
              alt={entry.name}
              className={`w-12 h-12 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-4 h-4 rounded-full border border-t-transparent animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "transparent" }}
                />
              </div>
            )}
          </>
        ) : (
          <span className="text-base font-black select-none" style={{ color: "rgba(255,255,255,0.25)" }}>
            {initials}
          </span>
        )}
      </div>

      <div className="text-center min-w-0 w-full">
        <p className="text-white font-semibold text-xs leading-snug line-clamp-2">{entry.name}</p>
      </div>
    </button>
  );
}
