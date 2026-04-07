import { useState } from "react";
import { SquadPlayer, PositionPtBr } from "@/lib/squadCache";

interface PitchPlayerData {
  id: number;
  name: string;
  positionPtBr: PositionPtBr;
  number?: number;
  photo?: string;
}

const POS_COLOR: Record<PositionPtBr, { fill: string; stroke: string; text: string }> = {
  GOL: { fill: "#f59e0b", stroke: "#fbbf24", text: "#1c1000" },
  ZAG: { fill: "#3b82f6", stroke: "#60a5fa", text: "#e0eeff" },
  VOL: { fill: "#10b981", stroke: "#34d399", text: "#003322" },
  ATA: { fill: "#ef4444", stroke: "#f87171", text: "#ffe0e0" },
};

const FORMATION_POSITIONS: [number, number][] = [
  [160, 400],
  [40, 315], [115, 315], [205, 315], [280, 315],
  [65, 225], [160, 225], [255, 225],
  [65, 130], [160, 130], [255, 130],
];

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function assignToFormation(players: PitchPlayerData[]): (PitchPlayerData | null)[] {
  const slots: (PitchPlayerData | null)[] = Array(11).fill(null);
  const gols = players.filter((p) => p.positionPtBr === "GOL");
  const zags = players.filter((p) => p.positionPtBr === "ZAG");
  const vols = players.filter((p) => p.positionPtBr === "VOL");
  const atas = players.filter((p) => p.positionPtBr === "ATA");
  const assigned = new Set<number>();
  const assign = (slot: number, player: PitchPlayerData) => {
    slots[slot] = player;
    assigned.add(player.id);
  };
  if (gols[0]) assign(0, gols[0]);
  for (let i = 0; i < 4; i++) if (zags[i]) assign(1 + i, zags[i]);
  for (let i = 0; i < 3; i++) if (vols[i]) assign(5 + i, vols[i]);
  for (let i = 0; i < 3; i++) if (atas[i]) assign(8 + i, atas[i]);
  const overflow = players.filter((p) => !assigned.has(p.id));
  let oi = 0;
  for (let i = 0; i < 11; i++) {
    if (!slots[i] && oi < overflow.length) slots[i] = overflow[oi++];
  }
  return slots;
}

function PlayerCircle({ x, y, player }: { x: number; y: number; player: PitchPlayerData }) {
  const [photoState, setPhotoState] = useState<"idle" | "loaded" | "error">(
    player.photo ? "idle" : "error"
  );
  const colors = POS_COLOR[player.positionPtBr];
  const radius = 20;
  const clipId = `clip-p-${player.id}`;
  const showPhoto = Boolean(player.photo) && photoState !== "error";
  const label = player.number != null ? String(player.number) : getInitials(player.name);

  const displayName = (() => {
    const parts = player.name.trim().split(" ");
    return parts.length > 1 ? parts[parts.length - 1] : player.name;
  })();

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={x} cy={y} r={radius - 1} />
        </clipPath>
      </defs>

      <circle cx={x} cy={y} r={radius + 4} fill={colors.fill} opacity={0.2} />
      <circle cx={x} cy={y} r={radius} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />

      {showPhoto ? (
        <>
          <image
            href={player.photo}
            x={x - radius}
            y={y - radius}
            width={radius * 2}
            height={radius * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            style={{ opacity: photoState === "loaded" ? 1 : 0, transition: "opacity 0.25s ease" }}
            onLoad={() => setPhotoState("loaded")}
            onError={() => setPhotoState("error")}
          />
          <circle cx={x} cy={y} r={radius} fill="none" stroke={colors.stroke} strokeWidth={1.5} />
          {photoState === "loaded" && (
            <>
              <rect x={x - 11} y={y + radius - 9} width={22} height={11} rx={4} fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8} opacity={0.95} />
              <text x={x} y={y + radius - 2} textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize={7} fontWeight="900" fontFamily="Inter, sans-serif">
                {player.positionPtBr}
              </text>
            </>
          )}
          {photoState === "idle" && (
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize={label.length > 2 ? 9 : 11} fontWeight="800" fontFamily="Inter, sans-serif">
              {label}
            </text>
          )}
        </>
      ) : (
        <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize={label.length > 2 ? 9 : 11} fontWeight="800" fontFamily="Inter, sans-serif">
          {label}
        </text>
      )}

      <text x={x} y={y + radius + 11} textAnchor="middle" dominantBaseline="middle" fill="white" opacity={0.85} fontSize={8} fontWeight="500" fontFamily="Inter, sans-serif">
        {displayName.length > 11 ? displayName.slice(0, 10) + "." : displayName}
      </text>
    </g>
  );
}

function PitchSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      {Array.from({ length: 4 }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: row === 0 || row === 3 ? 1 : row === 2 ? 3 : 4 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface FootballPitchProps {
  players: SquadPlayer[];
  loading?: boolean;
  className?: string;
}

export function FootballPitch({ players, loading, className }: FootballPitchProps) {
  const starters = players.slice(0, 11);
  const pitchData: PitchPlayerData[] = starters.map((p) => ({
    id: p.id,
    name: p.name,
    positionPtBr: p.positionPtBr,
    number: p.number ?? undefined,
    photo: p.photo || undefined,
  }));
  const slots = assignToFormation(pitchData);

  const W = 320;
  const H = 440;

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className ?? ""}`} style={{ background: "#0d2218" }}>
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 400 }}>
          <PitchSkeleton />
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 500 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#143520" />
              <stop offset="50%" stopColor="#1a4228" />
              <stop offset="100%" stopColor="#143520" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#pitchGrad)" />

          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={0} y={i * 55} width={W} height={27.5} fill="rgba(255,255,255,0.015)" />
          ))}

          <g fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.2} strokeLinecap="round">
            <rect x={12} y={12} width={W - 24} height={H - 24} />
            <line x1={12} y1={H / 2} x2={W - 12} y2={H / 2} />
            <circle cx={W / 2} cy={H / 2} r={42} />
            <circle cx={W / 2} cy={H / 2} r={2} fill="rgba(255,255,255,0.4)" stroke="none" />
            <rect x={82} y={12} width={W - 164} height={72} />
            <rect x={120} y={12} width={W - 240} height={34} />
            <rect x={133} y={2} width={W - 266} height={14} strokeWidth={2} />
            <rect x={82} y={H - 84} width={W - 164} height={72} />
            <rect x={120} y={H - 46} width={W - 240} height={34} />
            <rect x={133} y={H - 16} width={W - 266} height={14} strokeWidth={2} />
            <path d="M 12 22 A 10 10 0 0 1 22 12" />
            <path d="M 298 22 A 10 10 0 0 0 308 12" />
            <path d="M 12 418 A 10 10 0 0 0 22 428" />
            <path d="M 298 418 A 10 10 0 0 1 308 428" />
          </g>

          {slots.map((player, i) => {
            if (!player) return null;
            const [x, y] = FORMATION_POSITIONS[i];
            return <PlayerCircle key={`${player.id}-${i}`} x={x} y={y} player={player} />;
          })}
        </svg>
      )}
    </div>
  );
}
