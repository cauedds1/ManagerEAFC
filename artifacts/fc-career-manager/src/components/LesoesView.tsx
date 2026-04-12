import { useMemo, useState, useCallback, useEffect } from "react";
import { getMatches } from "@/lib/matchStorage";
import type { SquadPlayer } from "@/lib/squadCache";
import {
  getInjuries,
  upsertInjury,
  releaseInjury,
  updateInjuryName,
  injuryIdForOccurrence,
  daysBetween,
  type InjuryRecord,
} from "@/lib/injuryStorage";

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
        <img src={src} alt={name} className="w-9 h-9 object-cover" onError={() => setErr(true)} />
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function useInjuries(seasonId: string) {
  const [injuries, setInjuries] = useState<InjuryRecord[]>(() => getInjuries(seasonId));
  const reload = useCallback(() => setInjuries(getInjuries(seasonId)), [seasonId]);
  return { injuries, reload };
}

function syncInjuriesFromMatches(seasonId: string): void {
  const matches = getMatches(seasonId);
  const existingIds = new Set(getInjuries(seasonId).map((r) => r.id));
  const toAdd: InjuryRecord[] = [];

  for (const m of matches) {
    for (const [idStr, ps] of Object.entries(m.playerStats)) {
      if (!ps.injured) continue;
      const playerId = Number(idStr);
      const id = injuryIdForOccurrence(m.id, playerId);
      if (!existingIds.has(id)) {
        existingIds.add(id);
        toAdd.push({
          id,
          playerId,
          injuryName: "",
          matchDate: m.date,
          matchId: m.id,
          opponent: m.opponent,
          minute: ps.injuryMinute,
          createdAt: m.createdAt,
        });
      }
    }
  }

  for (const record of toAdd) {
    upsertInjury(seasonId, record);
  }
}

function ReleaseModal({
  injury,
  playerName,
  onConfirm,
  onClose,
}: {
  injury: InjuryRecord;
  playerName: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "rgba(18,20,28,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-white font-bold text-base">Liberar jogador</p>
          <p className="text-white/45 text-xs mt-1">
            {playerName} voltará a estar disponível para escalação.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white/60 text-xs font-semibold">Data de liberação</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-white text-sm focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          {injury.matchDate && date && (
            <p className="text-white/35 text-xs mt-0.5">
              Afastado por {daysBetween(injury.matchDate, date)} dias
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white/70 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(date)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "rgba(34,197,94,0.18)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            Liberar
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveInjuryCard({
  injury,
  player,
  seasonId,
  onUpdate,
}: {
  injury: InjuryRecord;
  player: SquadPlayer | undefined;
  seasonId: string;
  onUpdate: () => void;
}) {
  const [nameInput, setNameInput] = useState(injury.injuryName);
  const [releasing, setReleasing] = useState(false);

  const name = player?.name ?? `Jogador ${injury.playerId}`;
  const photo = player?.photo ?? "";
  const pos = player?.positionPtBr;

  const handleNameBlur = () => {
    if (nameInput !== injury.injuryName) {
      updateInjuryName(seasonId, injury.id, nameInput);
      onUpdate();
    }
  };

  const handleRelease = (date: string) => {
    releaseInjury(seasonId, injury.id, date);
    setReleasing(false);
    onUpdate();
  };

  return (
    <>
      {releasing && (
        <ReleaseModal
          injury={injury}
          playerName={name}
          onConfirm={handleRelease}
          onClose={() => setReleasing(false)}
        />
      )}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <PlayerPhoto src={photo} name={name} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-white truncate">{name}</div>
            {pos && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
              >
                {pos}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-lg">🤕</span>
            <span className="text-xs font-semibold" style={{ color: "#f87171" }}>Lesionado</span>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>{fmtDate(injury.matchDate)}</span>
            <span>•</span>
            <span>vs {injury.opponent}</span>
            {injury.minute != null && (
              <>
                <span>•</span>
                <span>{injury.minute}'</span>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs">Nome da lesão (opcional)</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Ex: Torção no tornozelo"
              className="w-full px-3 py-2 rounded-lg text-white text-xs focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          <button
            onClick={() => setReleasing(true)}
            className="w-full py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-98"
            style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            Liberar jogador
          </button>
        </div>
      </div>
    </>
  );
}

function HistoryCard({
  injury,
  player,
}: {
  injury: InjuryRecord;
  player: SquadPlayer | undefined;
}) {
  const name = player?.name ?? `Jogador ${injury.playerId}`;
  const photo = player?.photo ?? "";
  const pos = player?.positionPtBr;
  const days = injury.releasedAt ? daysBetween(injury.matchDate, injury.releasedAt) : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <PlayerPhoto src={photo} name={name} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white truncate">{name}</div>
          {pos && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
            >
              {pos}
            </span>
          )}
        </div>
        {days !== null && (
          <div className="flex-shrink-0 text-right">
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
              {days} {days === 1 ? "dia" : "dias"}
            </span>
            <p className="text-white/25 text-xs">afastado</p>
          </div>
        )}
      </div>

      <div
        className="px-4 pb-3 flex flex-col gap-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {injury.injuryName && (
          <p className="text-white/60 text-xs font-semibold pt-2">🩹 {injury.injuryName}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-white/30 pt-1">
          <span>Lesão: {fmtDate(injury.matchDate)} vs {injury.opponent}</span>
          {injury.minute != null && <span>• {injury.minute}'</span>}
        </div>
        {injury.releasedAt && (
          <div className="text-xs text-white/30">
            Liberado: {fmtDate(injury.releasedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

export function LesoesView({ careerId: _careerId, seasonId, allPlayers }: Props) {
  const [tab, setTab] = useState<"ativos" | "historico">("ativos");
  const { injuries, reload } = useInjuries(seasonId);

  useEffect(() => {
    syncInjuriesFromMatches(seasonId);
    reload();
  }, [seasonId, reload]);

  const playerMap = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  );

  const active = useMemo(
    () => injuries.filter((r) => !r.releasedAt).sort((a, b) => b.createdAt - a.createdAt),
    [injuries],
  );

  const history = useMemo(
    () => injuries.filter((r) => !!r.releasedAt).sort((a, b) => b.createdAt - a.createdAt),
    [injuries],
  );

  return (
    <div className="w-full flex flex-col">
      <div className="flex gap-1 px-4 pt-3 pb-1">
        {(["ativos", "historico"] as const).map((t) => {
          const label = t === "ativos" ? `Lesionados${active.length > 0 ? ` (${active.length})` : ""}` : "Histórico";
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: isActive ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.04)",
                color: isActive ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                border: isActive ? "1px solid rgba(var(--club-primary-rgb),0.35)" : "1px solid transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "ativos" && (
        <div className="px-4 pb-6 pt-2 flex flex-col gap-3">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <span className="text-5xl">🏥</span>
              <p className="text-white/40 text-sm">Nenhum jogador lesionado</p>
              <p className="text-white/25 text-xs">As lesões aparecem automaticamente ao registrar uma partida</p>
            </div>
          ) : (
            active.map((inj) => (
              <ActiveInjuryCard
                key={inj.id}
                injury={inj}
                player={playerMap.get(inj.playerId)}
                seasonId={seasonId}
                onUpdate={reload}
              />
            ))
          )}
        </div>
      )}

      {tab === "historico" && (
        <div className="px-4 pb-6 pt-2 flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <span className="text-5xl">📋</span>
              <p className="text-white/40 text-sm">Nenhum histórico de lesão</p>
              <p className="text-white/25 text-xs">Jogadores liberados aparecem aqui com o tempo que ficaram afastados</p>
            </div>
          ) : (
            history.map((inj) => (
              <HistoryCard
                key={inj.id}
                injury={inj}
                player={playerMap.get(inj.playerId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
