import { useState, useCallback } from "react";
import type { SquadPlayer } from "@/lib/squadCache";
import type {
  MatchRecord,
  PlayerMatchStats,
  MatchLocation,
  GoalEntry,
} from "@/types/match";
import {
  LOCATION_LABELS,
  LOCATION_ICONS,
} from "@/types/match";
import {
  addMatch,
  generateMatchId,
  generateGoalId,
  applyMatchToPlayerStats,
} from "@/lib/matchStorage";

interface Props {
  careerId: string;
  season: string;
  clubName: string;
  allPlayers: SquadPlayer[];
  onMatchAdded: (match: MatchRecord) => void;
  onClose: () => void;
}

interface MatchDraft {
  opponent: string;
  date: string;
  location: MatchLocation;
  tournament: string;
  stage: string;
  myScore: number;
  opponentScore: number;
  tablePosition: string;
  starterIds: number[];
  subIds: number[];
  playerStats: Record<number, PlayerMatchStats>;
  motmPlayerId: number | null;
  myShots: number;
  opponentShots: number;
  possessionPct: number;
}

function mkDefault(startedOnBench = false): PlayerMatchStats {
  return {
    startedOnBench,
    rating: 7.0,
    goals: [],
    ownGoal: false,
    missedPenalty: false,
    injured: false,
    substituted: false,
    passes: undefined,
    passAccuracy: undefined,
    keyPasses: undefined,
    dribblesCompleted: undefined,
    ballRecoveries: undefined,
    ballLosses: undefined,
    saves: undefined,
    penaltiesSaved: undefined,
  };
}

function getRatingColor(rating: number): { color: string; bg: string; label: string } {
  if (rating < 5.0) return { color: "#ef4444", bg: "rgba(239,68,68,0.18)", label: "Ruim" };
  if (rating < 6.0) return { color: "#f97316", bg: "rgba(249,115,22,0.18)", label: "Abaixo" };
  if (rating < 7.0) return { color: "#eab308", bg: "rgba(234,179,8,0.18)", label: "Regular" };
  if (rating < 8.0) return { color: "#84cc16", bg: "rgba(132,204,22,0.18)", label: "Bom" };
  if (rating < 9.0) return { color: "#22c55e", bg: "rgba(34,197,94,0.18)", label: "Ótimo" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.18)", label: "Excelente" };
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function NumericInput({
  value,
  onChange,
  min = 0,
  max = 999,
  placeholder = "",
  className = "",
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") { onChange(undefined); return; }
        const n = Math.max(min, Math.min(max, Number(raw)));
        onChange(isNaN(n) ? undefined : n);
      }}
      className={`px-2.5 py-1.5 rounded-xl text-white text-sm font-semibold focus:outline-none glass tabular-nums ${className}`}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 w-full"
    >
      <div
        className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
        style={{ background: checked ? "var(--club-primary)" : "rgba(255,255,255,0.1)" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? "calc(100% - 1.125rem)" : "0.125rem" }}
        />
      </div>
      <span className="text-white/70 text-sm">{label}</span>
    </button>
  );
}

function RatingBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rc = getRatingColor(value);
  const pct = (value / 10) * 100;
  const stops = ["0", "2", "4", "6", "8", "10"];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Nota</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
          <span className="text-2xl font-black tabular-nums" style={{ color: rc.color }}>{value.toFixed(1)}</span>
        </div>
      </div>
      <div className="relative h-4 rounded-full overflow-visible" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
          style={{
            width: `${pct}%`,
            background: value < 5 ? "linear-gradient(to right,#b91c1c,#ef4444)"
              : value < 6 ? "linear-gradient(to right,#ef4444,#f97316)"
              : value < 7 ? "linear-gradient(to right,#f97316,#eab308)"
              : value < 8 ? "linear-gradient(to right,#eab308,#84cc16)"
              : "linear-gradient(to right,#84cc16,#22c55e)",
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(value * 10)}
          onChange={(e) => onChange(Number(e.target.value) / 10)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between">
        {stops.map((s) => (
          <span key={s} className="text-white/20 text-xs tabular-nums">{s}</span>
        ))}
      </div>
    </div>
  );
}

function GoalEditor({
  goal,
  playerIndex,
  allParticipants,
  currentPlayerId,
  onChange,
  onRemove,
}: {
  goal: GoalEntry;
  playerIndex: number;
  allParticipants: SquadPlayer[];
  currentPlayerId: number;
  onChange: (g: GoalEntry) => void;
  onRemove: () => void;
}) {
  const others = allParticipants.filter((p) => p.id !== currentPlayerId);
  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">⚽</span>
        <span className="text-white/50 text-xs">Gol {playerIndex + 1}</span>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onRemove}
            className="w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs w-14 flex-shrink-0">Minuto</label>
        <NumericInput
          value={goal.minute}
          onChange={(v) => onChange({ ...goal, minute: v ?? 0 })}
          min={1}
          max={120}
          placeholder="Min"
          className="w-16"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs w-14 flex-shrink-0">Assist.</label>
        <select
          value={goal.assistPlayerId ?? ""}
          onChange={(e) => onChange({ ...goal, assistPlayerId: e.target.value ? Number(e.target.value) : undefined })}
          className="flex-1 px-2.5 py-1.5 rounded-xl text-white text-sm focus:outline-none glass"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <option value="">Sem assistência</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
      <span className="text-white/60 text-sm flex-shrink-0 w-28">{label}</span>
      <div className="flex-1 flex items-center justify-end">{children}</div>
    </div>
  );
}

function PlayerStatsPanel({
  player,
  stats,
  allParticipants,
  allUnused,
  onUpdate,
  onClose,
  onAddSub,
  onRemoveSub,
}: {
  player: SquadPlayer;
  stats: PlayerMatchStats;
  allParticipants: SquadPlayer[];
  allUnused: SquadPlayer[];
  onUpdate: (patch: Partial<PlayerMatchStats>) => void;
  onClose: () => void;
  onAddSub: (subId: number) => void;
  onRemoveSub: (subId: number) => void;
}) {
  const isGK = player.positionPtBr === "GOL";

  const addGoal = () => {
    const newGoal: GoalEntry = { id: generateGoalId(), minute: 0, assistPlayerId: undefined };
    onUpdate({ goals: [...stats.goals, newGoal] });
  };

  const updateGoal = (idx: number, g: GoalEntry) => {
    const next = stats.goals.map((gp, i) => (i === idx ? g : gp));
    onUpdate({ goals: next });
  };

  const removeGoal = (idx: number) => {
    onUpdate({ goals: stats.goals.filter((_, i) => i !== idx) });
  };

  const handleSubToggle = (on: boolean) => {
    if (!on) {
      if (stats.substitutedInPlayerId != null) {
        onRemoveSub(stats.substitutedInPlayerId);
      }
      onUpdate({ substituted: false, substitutedAtMinute: undefined, substitutedInPlayerId: undefined });
    } else {
      onUpdate({ substituted: true });
    }
  };

  const handleSubPlayerSelect = (newSubId: number | undefined) => {
    if (stats.substitutedInPlayerId != null && stats.substitutedInPlayerId !== newSubId) {
      onRemoveSub(stats.substitutedInPlayerId);
    }
    if (newSubId != null) {
      onAddSub(newSubId);
      onUpdate({ substitutedInPlayerId: newSubId });
    } else {
      onUpdate({ substitutedInPlayerId: undefined });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ background: "rgba(var(--club-primary-rgb),0.1)" }}
          >
            {player.photo ? (
              <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/30" fill="currentColor">
                <circle cx="20" cy="14" r="7" />
                <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{player.name}</p>
            {stats.startedOnBench && (
              <span className="text-xs" style={{ color: "#2dd4bf" }}>Substituto</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <RatingBar value={stats.rating} onChange={(v) => onUpdate({ rating: v })} />

        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Gols</span>
            <button
              type="button"
              onClick={addGoal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
            >
              + Gol
            </button>
          </div>
          {stats.goals.length === 0 && (
            <p className="text-white/20 text-xs text-center py-2">Nenhum gol marcado</p>
          )}
          {stats.goals.map((g, i) => (
            <GoalEditor
              key={g.id}
              goal={g}
              playerIndex={i}
              allParticipants={allParticipants}
              currentPlayerId={player.id}
              onChange={(gp) => updateGoal(i, gp)}
              onRemove={() => removeGoal(i)}
            />
          ))}
        </div>

        <div>
          <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">Estatísticas</span>
          <div className="space-y-0">
            <StatRow label="Passes" icon="🎯">
              <div className="flex items-center gap-1">
                <NumericInput
                  value={stats.passes}
                  onChange={(v) => onUpdate({ passes: v })}
                  placeholder="Total"
                  className="w-14 text-right"
                />
                <NumericInput
                  value={stats.passAccuracy}
                  onChange={(v) => onUpdate({ passAccuracy: v ? Math.min(100, v) : undefined })}
                  max={100}
                  placeholder="%"
                  className="w-12 text-right"
                />
                <span className="text-white/30 text-xs">%</span>
                <NumericInput
                  value={stats.keyPasses}
                  onChange={(v) => onUpdate({ keyPasses: v })}
                  placeholder="Chave"
                  className="w-14 text-right"
                />
              </div>
            </StatRow>
            <StatRow label="Dribles" icon="🔄">
              <NumericInput
                value={stats.dribblesCompleted}
                onChange={(v) => onUpdate({ dribblesCompleted: v })}
                placeholder="Completos"
                className="w-20 text-right"
              />
            </StatRow>
            <StatRow label="Recuperações" icon="🛡️">
              <div className="flex items-center gap-1">
                <NumericInput
                  value={stats.ballRecoveries}
                  onChange={(v) => onUpdate({ ballRecoveries: v })}
                  placeholder="Rec."
                  className="w-14 text-right"
                />
                <span className="text-white/20 text-xs">|</span>
                <NumericInput
                  value={stats.ballLosses}
                  onChange={(v) => onUpdate({ ballLosses: v })}
                  placeholder="Perdas"
                  className="w-14 text-right"
                />
              </div>
            </StatRow>
            {isGK && (
              <>
                <StatRow label="Defesas" icon="🧤">
                  <NumericInput
                    value={stats.saves}
                    onChange={(v) => onUpdate({ saves: v })}
                    placeholder="Total"
                    className="w-16 text-right"
                  />
                </StatRow>
                <StatRow label="Pên. Def." icon="🥅">
                  <NumericInput
                    value={stats.penaltiesSaved}
                    onChange={(v) => onUpdate({ penaltiesSaved: v })}
                    placeholder="—"
                    className="w-16 text-right"
                  />
                </StatRow>
              </>
            )}
          </div>
        </div>

        <div>
          <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">Eventos</span>
          <div className="space-y-3">
            <div className="glass rounded-xl p-3 space-y-2">
              <Toggle
                checked={stats.ownGoal}
                onChange={(v) => onUpdate({ ownGoal: v, ownGoalMinute: v ? stats.ownGoalMinute : undefined })}
                label="Gol contra"
              />
              {stats.ownGoal && (
                <div className="flex items-center gap-2 pl-11">
                  <span className="text-white/40 text-xs">Minuto:</span>
                  <NumericInput
                    value={stats.ownGoalMinute}
                    onChange={(v) => onUpdate({ ownGoalMinute: v })}
                    min={1}
                    max={120}
                    placeholder="Min"
                    className="w-16"
                  />
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-3 space-y-2">
              <Toggle
                checked={stats.missedPenalty}
                onChange={(v) => onUpdate({ missedPenalty: v, missedPenaltyMinute: v ? stats.missedPenaltyMinute : undefined })}
                label="Pênalti perdido"
              />
              {stats.missedPenalty && (
                <div className="flex items-center gap-2 pl-11">
                  <span className="text-white/40 text-xs">Minuto:</span>
                  <NumericInput
                    value={stats.missedPenaltyMinute}
                    onChange={(v) => onUpdate({ missedPenaltyMinute: v })}
                    min={1}
                    max={120}
                    placeholder="Min"
                    className="w-16"
                  />
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-3 space-y-2">
              <Toggle
                checked={stats.injured}
                onChange={(v) => onUpdate({ injured: v, injuryMinute: v ? stats.injuryMinute : undefined })}
                label="Lesionado"
              />
              {stats.injured && (
                <div className="flex items-center gap-2 pl-11">
                  <span className="text-white/40 text-xs">Minuto:</span>
                  <NumericInput
                    value={stats.injuryMinute}
                    onChange={(v) => onUpdate({ injuryMinute: v })}
                    min={1}
                    max={120}
                    placeholder="Min"
                    className="w-16"
                  />
                </div>
              )}
            </div>

            {!stats.startedOnBench && (
              <div className="glass rounded-xl p-3 space-y-2">
                <Toggle
                  checked={stats.substituted}
                  onChange={handleSubToggle}
                  label="Substituído"
                />
                {stats.substituted && (
                  <div className="space-y-2 pl-11">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs">Minuto:</span>
                      <NumericInput
                        value={stats.substitutedAtMinute}
                        onChange={(v) => onUpdate({ substitutedAtMinute: v })}
                        min={1}
                        max={120}
                        placeholder="Min"
                        className="w-16"
                      />
                    </div>
                    <div>
                      <span className="text-white/40 text-xs block mb-1">Quem entrou:</span>
                      <select
                        value={stats.substitutedInPlayerId ?? ""}
                        onChange={(e) => handleSubPlayerSelect(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-2.5 py-1.5 rounded-xl text-white text-sm focus:outline-none glass"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <option value="">Selecionar jogador</option>
                        {allUnused.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.positionPtBr})</option>
                        ))}
                        {stats.substitutedInPlayerId != null && !allUnused.find((p) => p.id === stats.substitutedInPlayerId) && (
                          <option value={stats.substitutedInPlayerId}>
                            {allParticipants.find((p) => p.id === stats.substitutedInPlayerId)?.name ?? `#${stats.substitutedInPlayerId}`}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step1({
  draft,
  clubName,
  onChange,
}: {
  draft: MatchDraft;
  clubName: string;
  onChange: (patch: Partial<MatchDraft>) => void;
}) {
  const tournamentChips = ["Campeonato Nacional", "Copa Nacional", "Champions League", "Europa League", "Liga Europa", "Liga dos Campeões"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Adversário *</label>
          <input
            type="text"
            value={draft.opponent}
            onChange={(e) => onChange({ opponent: e.target.value })}
            placeholder="Ex: Real Madrid"
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Data da Partida</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
            style={{ border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Local</label>
        <div className="flex gap-2">
          {(["casa", "fora", "neutro"] as MatchLocation[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onChange({ location: loc })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{
                background: draft.location === loc ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                color: draft.location === loc ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                border: draft.location === loc ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span>{LOCATION_ICONS[loc]}</span>
              <span>{LOCATION_LABELS[loc]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Torneio</label>
          <input
            type="text"
            value={draft.tournament}
            onChange={(e) => onChange({ tournament: e.target.value })}
            placeholder="Ex: Premier League"
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tournamentChips.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ tournament: t })}
                className="px-2 py-0.5 rounded-full text-xs transition-colors"
                style={{
                  background: draft.tournament === t ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                  color: draft.tournament === t ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Estágio / Rodada</label>
          <input
            type="text"
            value={draft.stage}
            onChange={(e) => onChange({ stage: e.target.value })}
            placeholder="Ex: Rodada 15"
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Placar Final</label>
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-white/30 text-xs text-center truncate">{clubName}</p>
            <input
              type="number"
              min={0}
              max={99}
              value={draft.myScore}
              onChange={(e) => onChange({ myScore: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 py-3 rounded-xl text-white text-3xl font-black text-center focus:outline-none glass tabular-nums"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
          <span className="text-white/20 text-2xl font-black flex-shrink-0">×</span>
          <div className="flex-1 space-y-1">
            <p className="text-white/30 text-xs text-center truncate">{draft.opponent || "Adversário"}</p>
            <input
              type="number"
              min={0}
              max={99}
              value={draft.opponentScore}
              onChange={(e) => onChange({ opponentScore: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 py-3 rounded-xl text-white text-3xl font-black text-center focus:outline-none glass tabular-nums"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Posição na Tabela (naquele momento)</label>
        <input
          type="number"
          min={1}
          max={40}
          value={draft.tablePosition}
          onChange={(e) => onChange({ tablePosition: e.target.value })}
          placeholder="Ex: 3"
          className="w-24 px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass tabular-nums"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  status,
  stats,
  isOpen,
  onClick,
  onRemove,
}: {
  player: SquadPlayer;
  status: "starter" | "sub" | "unused";
  stats?: PlayerMatchStats;
  isOpen: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const rc = stats ? getRatingColor(stats.rating) : null;
  const goalCount = stats?.goals.length ?? 0;

  return (
    <div
      className="relative flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all duration-150 select-none"
      style={{
        background: isOpen
          ? "rgba(var(--club-primary-rgb),0.15)"
          : status === "starter" ? "rgba(var(--club-primary-rgb),0.08)"
          : status === "sub" ? "rgba(45,212,191,0.08)"
          : "rgba(255,255,255,0.03)",
        border: isOpen
          ? "1px solid rgba(var(--club-primary-rgb),0.5)"
          : status === "starter" ? "1px solid rgba(var(--club-primary-rgb),0.2)"
          : status === "sub" ? "1px solid rgba(45,212,191,0.2)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
      onClick={onClick}
    >
      <div
        className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {player.photo ? (
          <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor">
            <circle cx="20" cy="14" r="7" />
            <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold truncate leading-tight"
          style={{ color: status === "unused" ? "rgba(255,255,255,0.35)" : "white" }}
        >
          {player.name}
        </p>
        <span
          className="text-xs font-bold"
          style={{ color: status === "unused" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)" }}
        >
          {player.positionPtBr}
        </span>
      </div>
      {stats && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {goalCount > 0 && (
            <span className="text-xs">⚽{goalCount > 1 ? `×${goalCount}` : ""}</span>
          )}
          {stats.ownGoal && <span className="text-xs">🔴</span>}
          {stats.injured && <span className="text-xs">🤕</span>}
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: rc!.color }}
          >
            {stats.rating.toFixed(1)}
          </span>
        </div>
      )}
      {status !== "unused" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Step2({
  draft,
  allPlayers,
  onChange,
}: {
  draft: MatchDraft;
  allPlayers: SquadPlayer[];
  onChange: (patch: Partial<MatchDraft>) => void;
}) {
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  const starterSet = new Set(draft.starterIds);
  const subSet = new Set(draft.subIds);
  const allParticipantIds = [...draft.starterIds, ...draft.subIds];
  const allParticipants = allPlayers.filter((p) => allParticipantIds.includes(p.id));
  const unused = allPlayers.filter((p) => !starterSet.has(p.id) && !subSet.has(p.id));

  const openPlayer = openPlayerId != null ? allPlayers.find((p) => p.id === openPlayerId) : null;
  const openStats = openPlayerId != null ? draft.playerStats[openPlayerId] : null;

  const handlePlayerClick = (player: SquadPlayer) => {
    if (starterSet.has(player.id) || subSet.has(player.id)) {
      setOpenPlayerId(openPlayerId === player.id ? null : player.id);
    } else {
      const newStats = { ...draft.playerStats, [player.id]: mkDefault(false) };
      onChange({ starterIds: [...draft.starterIds, player.id], playerStats: newStats });
    }
  };

  const handleRemovePlayer = (player: SquadPlayer) => {
    const ps = draft.playerStats[player.id];
    let newStarterIds = draft.starterIds.filter((id) => id !== player.id);
    let newSubIds = draft.subIds.filter((id) => id !== player.id);
    const newStats = { ...draft.playerStats };

    if (starterSet.has(player.id) && ps?.substitutedInPlayerId != null) {
      const subId = ps.substitutedInPlayerId;
      newSubIds = newSubIds.filter((id) => id !== subId);
      delete newStats[subId];
    }
    if (subSet.has(player.id)) {
      for (const sid of draft.starterIds) {
        if (newStats[sid]?.substitutedInPlayerId === player.id) {
          newStats[sid] = { ...newStats[sid], substituted: false, substitutedAtMinute: undefined, substitutedInPlayerId: undefined };
          break;
        }
      }
    }
    delete newStats[player.id];

    if (openPlayerId === player.id) setOpenPlayerId(null);
    let newMotm = draft.motmPlayerId;
    if (newMotm === player.id) newMotm = null;

    onChange({ starterIds: newStarterIds, subIds: newSubIds, playerStats: newStats, motmPlayerId: newMotm });
  };

  const updatePlayerStats = useCallback((playerId: number, patch: Partial<PlayerMatchStats>) => {
    const current = draft.playerStats[playerId] ?? mkDefault();
    onChange({ playerStats: { ...draft.playerStats, [playerId]: { ...current, ...patch } } });
  }, [draft.playerStats, onChange]);

  const handleAddSub = (subId: number) => {
    if (subSet.has(subId)) return;
    const newStats = { ...draft.playerStats, [subId]: mkDefault(true) };
    onChange({ subIds: [...draft.subIds, subId], playerStats: newStats });
  };

  const handleRemoveSub = (subId: number) => {
    const newSubIds = draft.subIds.filter((id) => id !== subId);
    const newStats = { ...draft.playerStats };
    delete newStats[subId];
    if (openPlayerId === subId) setOpenPlayerId(null);
    onChange({ subIds: newSubIds, playerStats: newStats });
  };

  const starters = allPlayers.filter((p) => starterSet.has(p.id));
  const subs = allPlayers.filter((p) => subSet.has(p.id));

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className={`flex flex-col min-h-0 overflow-y-auto space-y-4 transition-all duration-200 ${openPlayer ? "w-1/2 lg:w-3/5" : "w-full"}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Em Campo ({starters.length})
            </span>
            <span className="text-white/20 text-xs">Clique para adicionar / selecionar</span>
          </div>
          {starters.length === 0 && (
            <p className="text-white/20 text-xs text-center py-3 rounded-xl glass">Nenhum jogador adicionado</p>
          )}
          <div className="space-y-1.5">
            {starters.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                status="starter"
                stats={draft.playerStats[p.id]}
                isOpen={openPlayerId === p.id}
                onClick={() => handlePlayerClick(p)}
                onRemove={() => handleRemovePlayer(p)}
              />
            ))}
          </div>
        </div>

        {subs.length > 0 && (
          <div>
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">
              Reservas Que Entraram ({subs.length})
            </span>
            <div className="space-y-1.5">
              {subs.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  status="sub"
                  stats={draft.playerStats[p.id]}
                  isOpen={openPlayerId === p.id}
                  onClick={() => handlePlayerClick(p)}
                  onRemove={() => handleRemovePlayer(p)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="text-white/30 text-xs font-medium uppercase tracking-wider block mb-2">
            Banco / Não Jogou ({unused.length})
          </span>
          <div className="space-y-1.5">
            {unused.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                status="unused"
                isOpen={false}
                onClick={() => handlePlayerClick(p)}
                onRemove={() => {}}
              />
            ))}
          </div>
        </div>

        {allParticipants.length > 0 && (
          <div className="pt-2">
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">
              Jogador do Jogo (MOTM)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {allParticipants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ motmPlayerId: draft.motmPlayerId === p.id ? null : p.id })}
                  className="flex items-center gap-2 p-2 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: draft.motmPlayerId === p.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                    border: draft.motmPlayerId === p.id ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span className="text-xs">{draft.motmPlayerId === p.id ? "⭐" : "○"}</span>
                  <span className="text-white/70 text-xs truncate font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {openPlayer && openStats && (
        <div
          className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <PlayerStatsPanel
            player={openPlayer}
            stats={openStats}
            allParticipants={allParticipants}
            allUnused={unused}
            onUpdate={(patch) => updatePlayerStats(openPlayer.id, patch)}
            onClose={() => setOpenPlayerId(null)}
            onAddSub={handleAddSub}
            onRemoveSub={handleRemoveSub}
          />
        </div>
      )}
    </div>
  );
}

function Step3({
  draft,
  clubName,
  allPlayers,
  onChange,
}: {
  draft: MatchDraft;
  clubName: string;
  allPlayers: SquadPlayer[];
  onChange: (patch: Partial<MatchDraft>) => void;
}) {
  const resultLabel = draft.myScore > draft.opponentScore ? "Vitória ✅" : draft.myScore < draft.opponentScore ? "Derrota ❌" : "Empate 🤝";
  const totalGoals = [...draft.starterIds, ...draft.subIds].reduce(
    (sum, id) => sum + (draft.playerStats[id]?.goals.length ?? 0),
    0
  );
  const motm = draft.motmPlayerId != null ? allPlayers.find((p) => p.id === draft.motmPlayerId) : null;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Finalizações — {clubName}
            </label>
            <NumericInput
              value={draft.myShots}
              onChange={(v) => onChange({ myShots: v ?? 0 })}
              placeholder="0"
              className="w-full text-center text-xl font-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Finalizações — {draft.opponent || "Adversário"}
            </label>
            <NumericInput
              value={draft.opponentShots}
              onChange={(v) => onChange({ opponentShots: v ?? 0 })}
              placeholder="0"
              className="w-full text-center text-xl font-black"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">Posse de Bola</label>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span style={{ color: "var(--club-primary)" }}>{draft.possessionPct}%</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">{100 - draft.possessionPct}%</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={draft.possessionPct}
            onChange={(e) => onChange({ possessionPct: Number(e.target.value) })}
            className="w-full h-2 rounded-full cursor-pointer"
            style={{ accentColor: "var(--club-primary)" }}
          />
          <div className="flex justify-between text-white/25 text-xs">
            <span>{clubName}</span>
            <span>{draft.opponent || "Adversário"}</span>
          </div>
        </div>
      </div>

      <div
        className="glass rounded-2xl p-4 space-y-3"
        style={{ border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Resumo da Partida</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-black text-lg leading-tight">
              {clubName} {draft.myScore} × {draft.opponentScore} {draft.opponent || "Adversário"}
            </p>
            <p className="text-white/40 text-sm">{resultLabel}</p>
          </div>
          {draft.location && (
            <span className="text-2xl">{LOCATION_ICONS[draft.location]}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {draft.tournament && (
            <span className="px-2 py-0.5 rounded-full glass text-white/60">{draft.tournament}</span>
          )}
          {draft.stage && (
            <span className="px-2 py-0.5 rounded-full glass text-white/60">{draft.stage}</span>
          )}
          {draft.date && (
            <span className="px-2 py-0.5 rounded-full glass text-white/60">
              {new Date(draft.date + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="text-center glass rounded-xl p-2">
            <p className="text-white font-black text-lg">{draft.starterIds.length + draft.subIds.length}</p>
            <p className="text-white/40 text-xs">Jogadores</p>
          </div>
          <div className="text-center glass rounded-xl p-2">
            <p className="text-white font-black text-lg">{totalGoals}</p>
            <p className="text-white/40 text-xs">Gols registrados</p>
          </div>
          <div className="text-center glass rounded-xl p-2">
            <p className="text-white font-black text-lg">{draft.possessionPct}%</p>
            <p className="text-white/40 text-xs">Posse</p>
          </div>
        </div>

        {motm && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-yellow-400 text-sm">⭐</span>
            <span className="text-white/60 text-sm">MOTM: <span className="text-white font-semibold">{motm.name}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

const STEPS = ["Resumo", "Escalação", "Estatísticas"];

export function RegistrarPartidaModal({
  careerId,
  season,
  clubName,
  allPlayers,
  onMatchAdded,
  onClose,
}: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MatchDraft>({
    opponent: "",
    date: todayIso(),
    location: "casa",
    tournament: "",
    stage: "",
    myScore: 0,
    opponentScore: 0,
    tablePosition: "",
    starterIds: [],
    subIds: [],
    playerStats: {},
    motmPlayerId: null,
    myShots: 0,
    opponentShots: 0,
    possessionPct: 50,
  });

  const onChange = useCallback((patch: Partial<MatchDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const canAdvance = () => {
    if (step === 0) return draft.opponent.trim().length > 0;
    if (step === 1) return draft.starterIds.length > 0;
    return true;
  };

  const handleConfirm = () => {
    setSaving(true);
    const match: MatchRecord = {
      id: generateMatchId(),
      careerId,
      season,
      date: draft.date,
      tournament: draft.tournament,
      stage: draft.stage,
      location: draft.location,
      opponent: draft.opponent.trim(),
      myScore: draft.myScore,
      opponentScore: draft.opponentScore,
      starterIds: draft.starterIds,
      subIds: draft.subIds,
      playerStats: draft.playerStats,
      matchStats: {
        myShots: draft.myShots,
        opponentShots: draft.opponentShots,
        possessionPct: draft.possessionPct,
      },
      motmPlayerId: draft.motmPlayerId ?? undefined,
      tablePositionBefore: draft.tablePosition ? Number(draft.tablePosition) : undefined,
      createdAt: Date.now(),
    };
    applyMatchToPlayerStats(careerId, draft.starterIds, draft.subIds, draft.playerStats);
    addMatch(careerId, match);
    onMatchAdded(match);
    setSaving(false);
    onClose();
  };

  const isStep2 = step === 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative flex flex-col rounded-3xl overflow-hidden w-full transition-all duration-300 ${
          isStep2 ? "max-w-5xl" : "max-w-2xl"
        }`}
        style={{
          background: "var(--app-bg)",
          border: "1px solid var(--surface-border)",
          maxHeight: "92vh",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div>
            <h2 className="text-white font-black text-lg">Registrar Partida</h2>
            <p className="text-white/40 text-xs mt-0.5">{STEPS[step]}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-1.5"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                    style={{
                      background: i <= step ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                      color: i <= step ? "var(--club-primary)" : "rgba(255,255,255,0.25)",
                      border: i === step ? "1px solid rgba(var(--club-primary-rgb),0.5)" : "1px solid transparent",
                    }}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="w-6 h-0.5 rounded-full transition-colors duration-200"
                      style={{ background: i < step ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`flex-1 overflow-y-auto px-6 py-5 ${isStep2 ? "overflow-hidden flex flex-col" : ""}`}
          style={{ minHeight: 0 }}
        >
          {step === 0 && <Step1 draft={draft} clubName={clubName} onChange={onChange} />}
          {step === 1 && (
            <div className="flex-1 overflow-hidden h-full" style={{ minHeight: "400px" }}>
              <Step2 draft={draft} allPlayers={allPlayers} onChange={onChange} />
            </div>
          )}
          {step === 2 && <Step3 draft={draft} clubName={clubName} allPlayers={allPlayers} onChange={onChange} />}
        </div>

        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          <button
            type="button"
            onClick={() => step > 0 ? setStep((s) => s - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/08 transition-colors text-sm font-semibold glass glass-hover"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {step === 0 ? "Cancelar" : "Anterior"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: canAdvance() ? "var(--club-primary)" : "rgba(255,255,255,0.08)",
                color: canAdvance() ? "white" : "rgba(255,255,255,0.25)",
                opacity: canAdvance() ? 1 : 0.7,
              }}
            >
              Próximo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(to right, var(--club-primary), var(--club-secondary))", color: "white" }}
            >
              {saving ? "Salvando..." : "Confirmar Partida"}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
