import { useRef, useState } from "react";
import { SquadPlayer, PositionPtBr, FormationGroup, FORMATION_GROUP } from "@/lib/squadCache";

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
  LAT: { fill: "#0ea5e9", stroke: "#38bdf8", text: "#001e2e" },
  VOL: { fill: "#10b981", stroke: "#34d399", text: "#003322" },
  MC:  { fill: "#14b8a6", stroke: "#2dd4bf", text: "#002920" },
  MEI: { fill: "#84cc16", stroke: "#a3e635", text: "#1a2600" },
  PE:  { fill: "#f97316", stroke: "#fb923c", text: "#2a0e00" },
  PD:  { fill: "#f59c0a", stroke: "#fbbf24", text: "#2a1a00" },
  SA:  { fill: "#f43f5e", stroke: "#fb7185", text: "#2d0010" },
  CA:  { fill: "#ef4444", stroke: "#f87171", text: "#ffe0e0" },
  ATA: { fill: "#b91c1c", stroke: "#ef4444", text: "#ffe4e4" },
};

export const FORMATION_POSITIONS: [number, number][] = [
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

export function pickBestEleven(players: { id: number; positionPtBr: PositionPtBr }[]): number[] {
  const slots: (PitchPlayerData | null)[] = Array(11).fill(null);
  const used = new Set<number>();

  const byGroup: Record<FormationGroup, PitchPlayerData[]> = {
    GOL: [], ZAG: [], VOL: [], ATA: [],
  };
  for (const p of players) {
    const fg = FORMATION_GROUP[p.positionPtBr] ?? "VOL";
    byGroup[fg].push(p as PitchPlayerData);
  }

  const gks = byGroup["GOL"].filter((p) => !used.has(p.id));
  if (gks[0]) { slots[0] = gks[0]; used.add(gks[0].id); }

  const defs = byGroup["ZAG"].filter((p) => !used.has(p.id));
  const lats = defs.filter((p) => p.positionPtBr === "LAT");
  const cbs  = defs.filter((p) => p.positionPtBr !== "LAT");
  const latPool = [...lats, ...cbs];
  const cbPool  = [...cbs, ...lats];
  const lat1 = latPool.find((p) => !used.has(p.id));
  if (lat1) { slots[1] = lat1; used.add(lat1.id); }
  const lat4 = latPool.find((p) => !used.has(p.id));
  if (lat4) { slots[4] = lat4; used.add(lat4.id); }
  for (const si of [2, 3]) {
    const cb = cbPool.find((p) => !used.has(p.id));
    if (cb) { slots[si] = cb; used.add(cb.id); }
  }

  const mids = byGroup["VOL"].filter((p) => !used.has(p.id));
  for (let i = 0; i < 3 && i < mids.length; i++) {
    slots[5 + i] = mids[i]; used.add(mids[i].id);
  }

  const atks = byGroup["ATA"].filter((p) => !used.has(p.id));
  for (let i = 0; i < 3 && i < atks.length; i++) {
    slots[8 + i] = atks[i]; used.add(atks[i].id);
  }

  const overflow = players.filter((p) => !used.has(p.id));
  let oi = 0;
  for (let i = 0; i < 11; i++) {
    if (!slots[i] && oi < overflow.length) {
      slots[i] = overflow[oi++] as PitchPlayerData;
    }
  }

  return slots.filter((s): s is PitchPlayerData => s !== null).map((s) => s.id);
}

export function pickBestElevenIds(players: { id: number; positionPtBr: PositionPtBr }[]): Set<number> {
  return new Set(pickBestEleven(players));
}

function PlayerCircle({
  x, y, player, onClick, highlighted, dragging, dropTarget,
}: {
  x: number;
  y: number;
  player: PitchPlayerData;
  onClick?: (player: PitchPlayerData) => void;
  highlighted?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
}) {
  const [photoState, setPhotoState] = useState<"idle" | "loaded" | "error">(
    player.photo ? "idle" : "error"
  );
  const colors = POS_COLOR[player.positionPtBr] ?? POS_COLOR.MC;
  const radius = 20;
  const clipId = `clip-p-${player.id}`;
  const showPhoto = Boolean(player.photo) && photoState !== "error";
  const label = player.number != null ? String(player.number) : getInitials(player.name);

  const displayName = (() => {
    const parts = player.name.trim().split(" ");
    return parts.length > 1 ? parts[parts.length - 1] : player.name;
  })();

  const opacity = dragging ? 0.35 : 1;

  return (
    <g
      onClick={onClick ? () => onClick(player) : undefined}
      style={{ cursor: onClick ? "pointer" : "default", opacity }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={x} cy={y} r={radius - 1} />
        </clipPath>
      </defs>

      {(highlighted || dropTarget) && (
        <circle
          cx={x} cy={y} r={radius + 8}
          fill="none"
          stroke={dropTarget ? "#ffffff" : colors.stroke}
          strokeWidth={dropTarget ? 2.5 : 2}
          opacity={0.7}
          strokeDasharray={dropTarget ? "6 3" : "4 3"}
        />
      )}

      {dropTarget && (
        <circle cx={x} cy={y} r={radius + 14} fill="rgba(255,255,255,0.06)" />
      )}

      <circle cx={x} cy={y} r={radius + 4} fill={colors.fill} opacity={highlighted || dropTarget ? 0.35 : 0.2} />
      <circle cx={x} cy={y} r={radius} fill={colors.fill} stroke={highlighted || dropTarget ? "white" : colors.stroke} strokeWidth={highlighted || dropTarget ? 2.5 : 1.5} />

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
          <circle cx={x} cy={y} r={radius} fill="none" stroke={highlighted || dropTarget ? "white" : colors.stroke} strokeWidth={highlighted || dropTarget ? 2.5 : 1.5} />
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
  starterIds?: number[];
  loading?: boolean;
  className?: string;
  onPlayerClick?: (player: SquadPlayer) => void;
  highlightedPlayerId?: number;
  onSwapSlots?: (slotA: number, slotB: number) => void;
}

export function FootballPitch({
  players,
  starterIds: externalStarters,
  loading,
  className,
  onPlayerClick,
  highlightedPlayerId,
  onSwapSlots,
}: FootballPitchProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dropDst, setDropDst] = useState<number | null>(null);

  const orderedIds = externalStarters ?? (players.length > 0 ? pickBestEleven(players) : []);

  const pitchData: (PitchPlayerData | null)[] = FORMATION_POSITIONS.map((_, i) => {
    const id = orderedIds[i];
    if (id == null) return null;
    const p = players.find((pl) => pl.id === id);
    if (!p) return null;
    return { id: p.id, name: p.name, positionPtBr: p.positionPtBr, number: p.number ?? undefined, photo: p.photo || undefined };
  });

  const W = 320;
  const H = 440;

  function svgCoords(e: React.PointerEvent): { x: number; y: number } | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function nearestSlot(x: number, y: number, exclude: number | null): number | null {
    let best = null;
    let bestDist = 45;
    for (let i = 0; i < FORMATION_POSITIONS.length; i++) {
      if (i === exclude || pitchData[i] == null) continue;
      const [px, py] = FORMATION_POSITIONS[i];
      const d = Math.hypot(x - px, y - py);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  const handlePointerDown = (slotIndex: number) => (e: React.PointerEvent) => {
    if (!onSwapSlots) return;
    e.stopPropagation();
    setDragSrc(slotIndex);
    setDropDst(slotIndex);
    (e.currentTarget.closest("svg") as SVGSVGElement | null)?.setPointerCapture(e.pointerId);
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (dragSrc === null || !onSwapSlots) return;
    const coords = svgCoords(e);
    if (!coords) return;
    const nearest = nearestSlot(coords.x, coords.y, dragSrc);
    setDropDst(nearest);
  };

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (dragSrc !== null && dropDst !== null && dragSrc !== dropDst && onSwapSlots) {
      onSwapSlots(dragSrc, dropDst);
    }
    setDragSrc(null);
    setDropDst(null);
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const handlePlayerClick = onPlayerClick
    ? (pitchPlayer: PitchPlayerData) => {
        if (dragSrc !== null) return;
        const original = players.find((p) => p.id === pitchPlayer.id);
        if (original) onPlayerClick(original);
      }
    : undefined;

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className ?? ""}`} style={{ background: "#0d2218", aspectRatio: `${W} / ${H}` }}>
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <PitchSkeleton />
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ display: "block", touchAction: onSwapSlots ? "none" : undefined }}
          xmlns="http://www.w3.org/2000/svg"
          onPointerMove={onSwapSlots ? handleSvgPointerMove : undefined}
          onPointerUp={onSwapSlots ? handleSvgPointerUp : undefined}
        >
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

          {onSwapSlots && dragSrc !== null && (
            <text x={W / 2} y={H / 2 + 85} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="Inter, sans-serif">
              Solte sobre outro jogador para trocar
            </text>
          )}

          {pitchData.map((player, i) => {
            if (!player) return null;
            const [x, y] = FORMATION_POSITIONS[i];
            return (
              <g
                key={`${player.id}-${i}`}
                onPointerDown={onSwapSlots ? handlePointerDown(i) : undefined}
                style={{ cursor: onSwapSlots ? "grab" : undefined }}
              >
                <PlayerCircle
                  x={x}
                  y={y}
                  player={player}
                  onClick={handlePlayerClick}
                  highlighted={highlightedPlayerId === player.id}
                  dragging={dragSrc === i}
                  dropTarget={dropDst === i && dragSrc !== null && dragSrc !== i}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
