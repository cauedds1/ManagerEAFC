import { useState, useMemo } from "react";
import type { Season } from "@/types/career";
import type { MatchRecord } from "@/types/match";
import {
  getCompetitionResults,
  addCompetitionResult,
  updateCompetitionResult,
  deleteCompetitionResult,
  generateResultId,
  generateRoundId,
  generateMatchId,
  generateStandingId,
  type CompetitionResult,
  type BracketRound,
  type BracketMatch,
  type StandingsEntry,
} from "@/lib/competitionResultStorage";

interface Props {
  careerId: string;
  seasonId: string;
  seasons: Season[];
  clubName: string;
  allSeasonMatches: MatchRecord[];
}

function FilterDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors focus:outline-none"
        style={{ background: checked ? "var(--club-primary, #6366f1)" : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
      {label && <span className="text-sm text-white/60">{label}</span>}
    </label>
  );
}

function BracketBuilder({
  rounds,
  onChange,
  clubName,
}: {
  rounds: BracketRound[];
  onChange: (rounds: BracketRound[]) => void;
  clubName: string;
}) {
  function addRound() {
    onChange([
      ...rounds,
      { id: generateRoundId(), name: `Rodada ${rounds.length + 1}`, matches: [] },
    ]);
  }

  function removeRound(roundId: string) {
    onChange(rounds.filter((r) => r.id !== roundId));
  }

  function updateRoundName(roundId: string, name: string) {
    onChange(rounds.map((r) => (r.id === roundId ? { ...r, name } : r)));
  }

  function addMatch(roundId: string) {
    onChange(
      rounds.map((r) =>
        r.id === roundId
          ? {
              ...r,
              matches: [
                ...r.matches,
                {
                  id: generateMatchId(),
                  homeTeam: "",
                  homeScore: null,
                  awayTeam: "",
                  awayScore: null,
                },
              ],
            }
          : r
      )
    );
  }

  function removeMatch(roundId: string, matchId: string) {
    onChange(
      rounds.map((r) =>
        r.id === roundId ? { ...r, matches: r.matches.filter((m) => m.id !== matchId) } : r
      )
    );
  }

  function updateMatch(roundId: string, match: BracketMatch) {
    onChange(
      rounds.map((r) =>
        r.id === roundId
          ? { ...r, matches: r.matches.map((m) => (m.id === match.id ? match : m)) }
          : r
      )
    );
  }

  const isMyTeam = (name: string) =>
    name.trim().toLowerCase() === clubName.trim().toLowerCase();

  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div
          key={round.id}
          className="rounded-2xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <input
              value={round.name}
              onChange={(e) => updateRoundName(round.id, e.target.value)}
              placeholder="Nome da rodada"
              className="flex-1 bg-transparent text-sm font-bold text-white/80 outline-none border-b border-white/10 pb-0.5"
            />
            <button
              type="button"
              onClick={() => removeRound(round.id)}
              className="text-white/25 hover:text-red-400 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {round.matches.map((match) => (
              <div key={match.id} className="flex items-center gap-2">
                <input
                  value={match.homeTeam}
                  onChange={(e) => updateMatch(round.id, { ...match, homeTeam: e.target.value })}
                  placeholder="Casa"
                  className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs outline-none"
                  style={{ color: isMyTeam(match.homeTeam) ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}
                />
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={match.homeScore ?? ""}
                  onChange={(e) => updateMatch(round.id, { ...match, homeScore: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="–"
                  className="w-10 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs text-center outline-none text-white/80"
                />
                <span className="text-white/20 text-xs font-bold">×</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={match.awayScore ?? ""}
                  onChange={(e) => updateMatch(round.id, { ...match, awayScore: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="–"
                  className="w-10 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs text-center outline-none text-white/80"
                />
                <input
                  value={match.awayTeam}
                  onChange={(e) => updateMatch(round.id, { ...match, awayTeam: e.target.value })}
                  placeholder="Fora"
                  className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs outline-none"
                  style={{ color: isMyTeam(match.awayTeam) ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}
                />
                <button
                  type="button"
                  onClick={() => removeMatch(round.id, match.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addMatch(round.id)}
            className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            + Jogo
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRound}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(255,255,255,0.12)" }}
      >
        + Adicionar rodada
      </button>
    </div>
  );
}

function StandingsBuilder({
  entries,
  onChange,
  clubName,
}: {
  entries: StandingsEntry[];
  onChange: (entries: StandingsEntry[]) => void;
  clubName: string;
}) {
  function addEntry() {
    onChange([...entries, { id: generateStandingId(), team: "", points: 0 }]);
  }

  function removeEntry(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  function updateEntry(entry: StandingsEntry) {
    onChange(entries.map((e) => (e.id === entry.id ? entry : e)));
  }

  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const isMyTeam = (name: string) =>
    name.trim().toLowerCase() === clubName.trim().toLowerCase();

  return (
    <div className="space-y-3">
      {sorted.map((entry, idx) => (
        <div key={entry.id} className="flex items-center gap-2">
          <span
            className="w-5 text-center text-xs font-black tabular-nums"
            style={{ color: idx === 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}
          >
            {idx + 1}°
          </span>
          <input
            value={entry.team}
            onChange={(e) => updateEntry({ ...entry, team: e.target.value })}
            placeholder="Nome do time"
            className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs outline-none"
            style={{ color: isMyTeam(entry.team) ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}
          />
          <input
            type="number"
            min={0}
            max={999}
            value={entry.points}
            onChange={(e) => updateEntry({ ...entry, points: Number(e.target.value) || 0 })}
            className="w-14 bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-xs text-right outline-none text-white/80"
          />
          <span className="text-white/20 text-xs">pts</span>
          <button
            type="button"
            onClick={() => removeEntry(entry.id)}
            className="text-white/20 hover:text-red-400 transition-colors text-xs"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addEntry}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(255,255,255,0.12)" }}
      >
        + Adicionar time
      </button>
    </div>
  );
}

interface ModalProps {
  careerId: string;
  editing: CompetitionResult | null;
  seasons: Season[];
  seasonId: string;
  selectedSeasonId: string;
  clubName: string;
  matchTournaments: string[];
  onClose: () => void;
  onSaved: () => void;
}

function ResultModal({
  careerId,
  editing,
  seasons,
  seasonId,
  selectedSeasonId,
  clubName,
  matchTournaments,
  onClose,
  onSaved,
}: ModalProps) {
  const season = seasons.find((s) => s.id === selectedSeasonId) ?? seasons.find((s) => s.id === seasonId);
  const [compName, setCompName] = useState(editing?.competitionName ?? "");
  const [customName, setCustomName] = useState(!matchTournaments.includes(editing?.competitionName ?? "") && !!editing?.competitionName);
  const [type, setType] = useState<"mata-mata" | "pontos-corridos">(editing?.type ?? "mata-mata");
  const [isChampion, setIsChampion] = useState(editing?.isChampion ?? false);
  const [bracket, setBracket] = useState<BracketRound[]>(editing?.bracket ?? []);
  const [standings, setStandings] = useState<StandingsEntry[]>(editing?.standings ?? []);

  const tournamentOptions = matchTournaments.length > 0
    ? [...matchTournaments, "Outra (digitar)"]
    : [];

  function handleSave() {
    if (!compName.trim()) return;
    const result: CompetitionResult = {
      id: editing?.id ?? generateResultId(),
      careerId,
      seasonId: selectedSeasonId,
      seasonLabel: season?.label ?? selectedSeasonId,
      competitionName: compName.trim(),
      type,
      isChampion,
      bracket: type === "mata-mata" ? bracket : undefined,
      standings: type === "pontos-corridos" ? standings : undefined,
      createdAt: editing?.createdAt ?? Date.now(),
    };
    if (editing) {
      updateCompetitionResult(careerId, result);
    } else {
      addCompetitionResult(careerId, result);
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "rgba(15,15,25,0.98)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <h2 className="font-bold text-white/90 text-base">
            {editing ? "Editar competição" : "Resultado da competição"}
          </h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* Nome da competição */}
          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
              Competição
            </label>
            {tournamentOptions.length > 0 && !customName ? (
              <select
                value={compName}
                onChange={(e) => {
                  if (e.target.value === "Outra (digitar)") {
                    setCustomName(true);
                    setCompName("");
                  } else {
                    setCompName(e.target.value);
                  }
                }}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <option value="" style={{ background: "#1a1a2e" }}>Selecionar...</option>
                {tournamentOptions.map((t) => (
                  <option key={t} value={t} style={{ background: "#1a1a2e" }}>{t}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="Ex: Liga dos Campeões"
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
                {tournamentOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setCustomName(false); setCompName(""); }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
                  >
                    ← Lista
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
              Formato
            </label>
            <div className="flex gap-2">
              {(["mata-mata", "pontos-corridos"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: type === t ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                    color: type === t ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                    border: type === t ? "1px solid rgba(var(--club-primary-rgb),0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {t === "mata-mata" ? "🏆 Mata-mata" : "📋 Pontos Corridos"}
                </button>
              ))}
            </div>
          </div>

          {/* Campeão */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Meu time foi campeão 🏅</span>
            <Toggle checked={isChampion} onChange={setIsChampion} />
          </div>

          {/* Builder */}
          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-2">
              {type === "mata-mata" ? "Chaveamento" : "Tabela de classificação"}
            </label>
            {type === "mata-mata" ? (
              <BracketBuilder rounds={bracket} onChange={setBracket} clubName={clubName} />
            ) : (
              <StandingsBuilder entries={standings} onChange={setStandings} clubName={clubName} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!compName.trim()}
            className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all"
            style={{
              background: compName.trim() ? "var(--club-primary)" : "rgba(255,255,255,0.08)",
              color: compName.trim() ? "#fff" : "rgba(255,255,255,0.3)",
            }}
          >
            {editing ? "Salvar alterações" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BracketDetail({ result, clubName }: { result: CompetitionResult; clubName: string }) {
  const isMyTeam = (name: string) =>
    name.trim().toLowerCase() === clubName.trim().toLowerCase();

  if (!result.bracket || result.bracket.length === 0) {
    return <p className="text-white/30 text-sm text-center py-4">Nenhum jogo registrado.</p>;
  }

  return (
    <div className="space-y-4 mt-3">
      {result.bracket.map((round) => (
        <div key={round.id}>
          <p className="text-white/40 text-[11px] font-bold uppercase tracking-wide mb-2">{round.name}</p>
          <div className="space-y-2">
            {round.matches.map((match) => {
              const myHome = isMyTeam(match.homeTeam);
              const myAway = isMyTeam(match.awayTeam);
              const homeWon = match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
              const awayWon = match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;
              return (
                <div
                  key={match.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span
                    className="flex-1 text-xs font-semibold text-right"
                    style={{
                      color: myHome ? "var(--club-primary)" : homeWon ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {match.homeTeam || "—"}
                  </span>
                  <div className="flex items-center gap-1.5 px-2">
                    <span className="text-sm font-black tabular-nums" style={{ color: homeWon ? "#34d399" : "rgba(255,255,255,0.5)" }}>
                      {match.homeScore ?? "–"}
                    </span>
                    <span className="text-white/20 text-xs">×</span>
                    <span className="text-sm font-black tabular-nums" style={{ color: awayWon ? "#34d399" : "rgba(255,255,255,0.5)" }}>
                      {match.awayScore ?? "–"}
                    </span>
                  </div>
                  <span
                    className="flex-1 text-xs font-semibold"
                    style={{
                      color: myAway ? "var(--club-primary)" : awayWon ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {match.awayTeam || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StandingsDetail({ result, clubName }: { result: CompetitionResult; clubName: string }) {
  const isMyTeam = (name: string) =>
    name.trim().toLowerCase() === clubName.trim().toLowerCase();

  if (!result.standings || result.standings.length === 0) {
    return <p className="text-white/30 text-sm text-center py-4">Nenhum time registrado.</p>;
  }

  const sorted = [...result.standings].sort((a, b) => b.points - a.points);

  return (
    <div className="mt-3 space-y-1">
      {sorted.map((entry, idx) => {
        const mine = isMyTeam(entry.team);
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: mine ? "rgba(var(--club-primary-rgb),0.1)" : "rgba(255,255,255,0.03)",
              border: mine ? "1px solid rgba(var(--club-primary-rgb),0.2)" : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span
              className="w-5 text-center text-xs font-black tabular-nums"
              style={{ color: idx === 0 ? "#fbbf24" : "rgba(255,255,255,0.25)" }}
            >
              {idx + 1}°
            </span>
            <span
              className="flex-1 text-sm font-semibold"
              style={{ color: mine ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}
            >
              {entry.team}
            </span>
            <span className="text-sm font-black tabular-nums" style={{ color: mine ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}>
              {entry.points}
            </span>
            <span className="text-white/20 text-xs">pts</span>
          </div>
        );
      })}
    </div>
  );
}

function DetailView({
  result,
  clubName,
  onBack,
  onEdit,
  onDelete,
}: {
  result: CompetitionResult;
  clubName: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-white/30 hover:text-white/70 transition-colors text-sm">
          ← Voltar
        </button>
      </div>

      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background: result.isChampion ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
          border: result.isChampion ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {result.isChampion && <span className="text-xl">🏆</span>}
              <h2 className="text-base font-black text-white/90">{result.competitionName}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-white/35 text-xs">{result.seasonLabel}</span>
              <span className="text-white/15 text-xs">·</span>
              <span className="text-white/35 text-xs capitalize">
                {result.type === "mata-mata" ? "🏆 Mata-mata" : "📋 Pontos Corridos"}
              </span>
              {result.isChampion && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                >
                  Campeão
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              Editar
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}
              >
                Apagar
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(248,113,113,0.2)", color: "#f87171" }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1.5 rounded-xl text-white/30"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {result.type === "mata-mata" ? (
          <BracketDetail result={result} clubName={clubName} />
        ) : (
          <StandingsDetail result={result} clubName={clubName} />
        )}
      </div>
    </div>
  );
}

export function CompetitionResultsView({
  careerId,
  seasonId,
  seasons,
  clubName,
  allSeasonMatches,
}: Props) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(seasonId);
  const [results, setResults] = useState<CompetitionResult[]>(() => getCompetitionResults(careerId));
  const [showModal, setShowModal] = useState(false);
  const [editingResult, setEditingResult] = useState<CompetitionResult | null>(null);
  const [detailResult, setDetailResult] = useState<CompetitionResult | null>(null);

  const seasonOptions = useMemo(() => {
    return [...seasons]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({ value: s.id, label: s.label + (s.id === seasonId ? " (atual)" : "") }));
  }, [seasons, seasonId]);

  const matchTournaments = useMemo(() => {
    const seasonMatches = allSeasonMatches.filter((m) => m.careerId === careerId);
    const set = new Set<string>();
    for (const m of seasonMatches) {
      if (m.tournament) set.add(m.tournament);
    }
    return Array.from(set).sort();
  }, [allSeasonMatches, careerId]);

  const filteredResults = useMemo(
    () => results.filter((r) => r.seasonId === selectedSeasonId),
    [results, selectedSeasonId]
  );

  function refresh() {
    setResults(getCompetitionResults(careerId));
    setShowModal(false);
    setEditingResult(null);
  }

  function handleDelete(resultId: string) {
    deleteCompetitionResult(careerId, resultId);
    setResults(getCompetitionResults(careerId));
    setDetailResult(null);
  }

  function handleEdit(result: CompetitionResult) {
    setEditingResult(result);
    setDetailResult(null);
    setShowModal(true);
  }

  function handleOpenDetail(result: CompetitionResult) {
    setDetailResult(result);
  }

  const currentDetailResult = detailResult ? results.find((r) => r.id === detailResult.id) ?? null : null;

  return (
    <div className="px-4 sm:px-6 pb-10">
      {currentDetailResult ? (
        <DetailView
          result={currentDetailResult}
          clubName={clubName}
          onBack={() => setDetailResult(null)}
          onEdit={() => handleEdit(currentDetailResult)}
          onDelete={() => handleDelete(currentDetailResult.id)}
        />
      ) : (
        <div className="space-y-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {seasons.length > 1 && (
                <FilterDropdown
                  value={selectedSeasonId}
                  onChange={setSelectedSeasonId}
                  options={seasonOptions}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setEditingResult(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold transition-all"
              style={{ background: "var(--club-primary)", color: "#fff" }}
            >
              <span>+</span>
              <span>Adicionar resultado</span>
            </button>
          </div>

          {/* Grid de resultados */}
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <span className="text-5xl">🏆</span>
              <p className="text-white/40 text-sm">
                Nenhum resultado registrado para esta temporada
              </p>
              <button
                type="button"
                onClick={() => { setEditingResult(null); setShowModal(true); }}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
              >
                Registrar primeiro resultado
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleOpenDetail(result)}
                  className="text-left rounded-2xl p-4 transition-all hover:scale-[1.01]"
                  style={{
                    background: result.isChampion ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
                    border: result.isChampion ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {result.isChampion && <span className="text-lg">🏆</span>}
                      <span className="font-bold text-white/90 text-sm">{result.competitionName}</span>
                    </div>
                    {result.isChampion && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                      >
                        Campeão
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/30 text-xs capitalize">
                      {result.type === "mata-mata" ? "Mata-mata" : "Pontos Corridos"}
                    </span>
                    {result.type === "mata-mata" && result.bracket && result.bracket.length > 0 && (
                      <>
                        <span className="text-white/15 text-xs">·</span>
                        <span className="text-white/25 text-xs">
                          {result.bracket.length} rodada{result.bracket.length !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                    {result.type === "pontos-corridos" && result.standings && result.standings.length > 0 && (
                      <>
                        <span className="text-white/15 text-xs">·</span>
                        <span className="text-white/25 text-xs">
                          {result.standings.length} times
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ResultModal
          careerId={careerId}
          editing={editingResult}
          seasons={seasons}
          seasonId={seasonId}
          selectedSeasonId={selectedSeasonId}
          clubName={clubName}
          matchTournaments={matchTournaments}
          onClose={() => { setShowModal(false); setEditingResult(null); }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
