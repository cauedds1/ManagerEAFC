import { useMemo, useState } from "react";
import { getMatches } from "@/lib/matchStorage";
import type { SquadPlayer } from "@/lib/squadCache";

interface InjuryOccurrence {
  matchDate: string;
  opponent: string;
  minute: number | undefined;
}

interface PlayerInjuryRecord {
  player: SquadPlayer | undefined;
  playerId: number;
  injuries: InjuryOccurrence[];
}

interface Props {
  careerId: string;
  seasonId: string;
  allPlayers: SquadPlayer[];
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(!src);
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {!err ? (
        <img
          src={src}
          alt={name}
          className="w-9 h-9 object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="w-6 h-6 text-white/15" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" />
        </svg>
      )}
    </div>
  );
}

function fmtDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function LesoesView({ careerId, seasonId, allPlayers }: Props) {
  const playerMap = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  );

  const injuryRecords: PlayerInjuryRecord[] = useMemo(() => {
    const matches = getMatches(seasonId);
    const byPlayer = new Map<number, InjuryOccurrence[]>();

    for (const m of matches) {
      for (const [idStr, ps] of Object.entries(m.playerStats)) {
        if (!ps.injured) continue;
        const id = Number(idStr);
        if (!byPlayer.has(id)) byPlayer.set(id, []);
        byPlayer.get(id)!.push({
          matchDate: m.date,
          opponent: m.opponent,
          minute: ps.injuryMinute,
        });
      }
    }

    return Array.from(byPlayer.entries())
      .map(([playerId, injuries]) => ({
        playerId,
        player: playerMap.get(playerId),
        injuries: injuries.sort((a, b) => b.matchDate.localeCompare(a.matchDate)),
      }))
      .sort((a, b) => b.injuries.length - a.injuries.length);
  }, [seasonId, playerMap]);

  if (injuryRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">🏥</span>
        <p className="text-white/40 text-sm">Nenhuma lesão registrada</p>
        <p className="text-white/25 text-xs">As lesões aparecem automaticamente quando você registrar uma partida</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-6 pt-2 flex flex-col gap-3">
      {injuryRecords.map(({ playerId, player, injuries }) => {
        const name = player?.name ?? `Jogador ${playerId}`;
        const photo = player?.photo ?? "";
        const pos = player?.positionPtBr;

        return (
          <div
            key={playerId}
            className="rounded-xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <PlayerPhoto src={photo} name={name} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate">{name}</div>
                {pos && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      color: "#f87171",
                    }}
                  >
                    {pos}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-lg">🤕</span>
                <span className="text-sm font-bold" style={{ color: "#f87171" }}>
                  {injuries.length}
                </span>
                <span className="text-xs text-white/40">
                  {injuries.length === 1 ? "lesão" : "lesões"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {injuries.map((inj, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-white/25 text-xs w-20 flex-shrink-0">
                    {fmtDate(inj.matchDate)}
                  </span>
                  <span className="text-white/70 text-xs flex-1">vs {inj.opponent}</span>
                  {inj.minute != null && (
                    <span className="text-xs text-white/30 flex-shrink-0">
                      {inj.minute}&apos;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
