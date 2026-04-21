import { useState, useMemo } from "react";
import type { Season } from "@/types/career";
import { getMatches } from "@/lib/matchStorage";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";
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
import { useLang } from "@/hooks/useLang";
import { CLUBE } from "@/lib/i18n";

interface Props {
  careerId: string;
  seasonId: string;
  seasons: Season[];
  clubName: string;
  clubLogoUrl?: string | null;
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

const BRACKET_SIZES = [128, 64, 32, 16, 8, 4] as const;
type BracketSize = (typeof BRACKET_SIZES)[number] | "custom";

type T = (typeof CLUBE)["pt"];

function getRoundName(matchCount: number, totalTeams: number, t: T): string {
  void totalTeams;
  if (matchCount === 1) return t.roundFinal;
  if (matchCount === 2) return t.roundSemi;
  if (matchCount === 4) return t.roundQuarter;
  if (matchCount === 8) return t.roundR16;
  return t.roundOf.replace("{n}", String(matchCount * 2));
}

function generateBracketRounds(totalTeams: number, t: T): BracketRound[] {
  const rounds: BracketRound[] = [];
  let teams = totalTeams;
  while (teams > 1) {
    const matchCount = teams / 2;
    rounds.push({
      id: generateRoundId(),
      name: getRoundName(matchCount, totalTeams, t),
      matches: Array.from({ length: matchCount }, () => ({
        id: generateMatchId(),
        homeTeam: "",
        homeScore: null,
        awayTeam: "",
        awayScore: null,
      })),
    });
    teams = matchCount;
  }
  return rounds;
}

function BracketSizeSelector({ onSelect }: { onSelect: (size: BracketSize) => void }) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const sizeInfo: Record<number, string[]> = {
    128: [t.roundOf.replace("{n}", "128"), t.roundOf.replace("{n}", "64"), t.roundOf.replace("{n}", "32"), t.roundR16, t.roundQuarter, t.roundSemi, t.roundFinal],
    64:  [t.roundOf.replace("{n}", "64"), t.roundOf.replace("{n}", "32"), t.roundR16, t.roundQuarter, t.roundSemi, t.roundFinal],
    32:  [t.roundOf.replace("{n}", "32"), t.roundR16, t.roundQuarter, t.roundSemi, t.roundFinal],
    16:  [t.roundR16, t.roundQuarter, t.roundSemi, t.roundFinal],
    8:   [t.roundQuarter, t.roundSemi, t.roundFinal],
    4:   [t.roundSemi, t.roundFinal],
  };

  return (
    <div className="space-y-3">
      <p className="text-white/40 text-xs">{t.bracketSizeHint}</p>
      <div className="grid grid-cols-2 gap-2">
        {BRACKET_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onSelect(size)}
            className="flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span className="text-white/80 text-sm font-bold">{size} {t.teamsLabel}</span>
            <span className="text-white/30 text-[10px] leading-tight">
              {sizeInfo[size].join(" · ")}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className="flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] col-span-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.12)",
          }}
        >
          <span className="text-white/50 text-sm font-semibold">{t.customBracket}</span>
          <span className="text-white/25 text-[10px]">{t.addManually}</span>
        </button>
      </div>
    </div>
  );
}

function BracketBuilder({
  rounds,
  onChange,
  clubName,
  onChangeSize,
}: {
  rounds: BracketRound[];
  onChange: (rounds: BracketRound[]) => void;
  clubName: string;
  onChangeSize?: () => void;
}) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  function addRound() {
    onChange([
      ...rounds,
      { id: generateRoundId(), name: t.roundN.replace("{n}", String(rounds.length + 1)), matches: [] },
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
              placeholder={t.roundNamePlaceholder}
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
                  placeholder={t.homeTeamPlaceholder}
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
                  placeholder={t.awayTeamPlaceholder}
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
            {t.addGame}
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRound}
          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(255,255,255,0.12)" }}
        >
          {t.addRound}
        </button>
        {onChangeSize && (
          <button
            type="button"
            onClick={onChangeSize}
            className="py-2 px-3 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {t.changeSize}
          </button>
        )}
      </div>
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
  const [lang] = useLang();
  const t = CLUBE[lang];

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
            placeholder={t.teamNamePlaceholder}
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
        {t.addTeam}
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
  const [lang] = useLang();
  const t = CLUBE[lang];

  const season = seasons.find((s) => s.id === selectedSeasonId) ?? seasons.find((s) => s.id === seasonId);
  const [compName, setCompName] = useState(editing?.competitionName ?? "");
  const [customName, setCustomName] = useState(!matchTournaments.includes(editing?.competitionName ?? "") && !!editing?.competitionName);
  const [type, setType] = useState<"mata-mata" | "pontos-corridos">(editing?.type ?? "mata-mata");
  const [isChampion, setIsChampion] = useState(editing?.isChampion ?? false);
  const [bracket, setBracket] = useState<BracketRound[]>(editing?.bracket ?? []);
  const [standings, setStandings] = useState<StandingsEntry[]>(editing?.standings ?? []);
  const [bracketSize, setBracketSize] = useState<BracketSize | null>(
    editing?.bracket && editing.bracket.length > 0 ? "custom" : null
  );

  const otherLabel = t.otherType;

  function handleSelectSize(size: BracketSize) {
    setBracketSize(size);
    if (size !== "custom") {
      setBracket(generateBracketRounds(size, t));
    } else {
      setBracket([]);
    }
  }

  function handleChangeSize() {
    setBracketSize(null);
    setBracket([]);
  }

  const tournamentOptions = matchTournaments.length > 0
    ? [...matchTournaments, otherLabel]
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
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <h2 className="font-bold text-white/90 text-base">
            {editing ? t.editComp : t.compResult}
          </h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
              {t.competitionLabel}
            </label>
            {tournamentOptions.length > 0 && !customName ? (
              <select
                value={compName}
                onChange={(e) => {
                  if (e.target.value === otherLabel) {
                    setCustomName(true);
                    setCompName("");
                  } else {
                    setCompName(e.target.value);
                  }
                }}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <option value="" style={{ background: "#1a1a2e" }}>{t.selectPlaceholder}</option>
                {tournamentOptions.map((to) => (
                  <option key={to} value={to} style={{ background: "#1a1a2e" }}>{to}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder={t.compNamePlaceholder}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
                {tournamentOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setCustomName(false); setCompName(""); }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
                  >
                    ← {t.backToList}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
              {t.formatLabel}
            </label>
            <div className="flex gap-2">
              {(["mata-mata", "pontos-corridos"] as const).map((typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setType(typeKey)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: type === typeKey ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                    color: type === typeKey ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                    border: type === typeKey ? "1px solid rgba(var(--club-primary-rgb),0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {typeKey === "mata-mata" ? t.knockout : t.league}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">{t.myTeamChampion}</span>
            <Toggle checked={isChampion} onChange={setIsChampion} />
          </div>

          <div>
            <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide block mb-2">
              {type === "mata-mata" ? t.bracketLabel : t.standingsLabel}
            </label>
            {type === "mata-mata" ? (
              bracketSize === null ? (
                <BracketSizeSelector onSelect={handleSelectSize} />
              ) : (
                <BracketBuilder
                  rounds={bracket}
                  onChange={setBracket}
                  clubName={clubName}
                  onChangeSize={handleChangeSize}
                />
              )
            ) : (
              <StandingsBuilder entries={standings} onChange={setStandings} clubName={clubName} />
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            {t.cancel}
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
            {editing ? t.saveChanges : t.register}
          </button>
        </div>
      </div>
    </div>
  );
}

function resolveOpponentLogo(name: string, stored?: string | null): string | undefined {
  if (stored) return stored;
  const q = name.toLowerCase().trim();
  const cached = getCachedClubList();
  if (cached && cached.length > 0) {
    const exact = cached.find((c) => c.name.toLowerCase() === q);
    if (exact?.logo) return exact.logo;
    const partial = cached.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
    if (partial?.logo) return partial.logo;
  }
  const statics = searchStaticClubs(name);
  return statics[0]?.logo ?? undefined;
}

const BR_SLOT_H = 56;
const BR_GAP_0 = 6;
const BR_COL_W = 152;
const BR_CONN_W = 26;
const BR_HDR_H = 26;
const BR_LINE = "rgba(255,255,255,0.18)";

function bracketTotalH(n0: number): number {
  return n0 * BR_SLOT_H + Math.max(0, n0 - 1) * BR_GAP_0;
}

function matchCenterY(roundIdx: number, matchIdx: number): number {
  const factor = Math.pow(2, roundIdx);
  const marginV = ((factor - 1) / 2) * (BR_SLOT_H + BR_GAP_0);
  return marginV + matchIdx * factor * (BR_SLOT_H + BR_GAP_0) + BR_SLOT_H / 2;
}

function matchTopY(roundIdx: number, matchIdx: number): number {
  return matchCenterY(roundIdx, matchIdx) - BR_SLOT_H / 2;
}

function TinyLogo({ logoUrl, name, isMe, size = 20 }: { logoUrl?: string | null; name: string; isMe?: boolean; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "?").join("") || "?";
  if (!logoUrl || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: isMe ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.08)",
        border: isMe ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 900,
        color: isMe ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
        letterSpacing: "-0.5px",
      }}>{initials}</div>
    );
  }
  return (
    <img src={logoUrl} alt={name} width={size} height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      onError={() => setFailed(true)} />
  );
}

function BracketTeamRow({ name, logoUrl, score, isMe, won, lost }: {
  name: string; logoUrl?: string | null; score: number | null;
  isMe?: boolean; won?: boolean; lost?: boolean;
}) {
  const rowH = (BR_SLOT_H - 1) / 2;
  const displayName = name || "—";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "0 7px", height: rowH, opacity: lost ? 0.3 : 1,
      transition: "opacity 0.15s",
    }}>
      <TinyLogo logoUrl={logoUrl} name={displayName} isMe={isMe} size={20} />
      <span style={{
        flex: 1, fontSize: 10.5, lineHeight: 1.3,
        fontWeight: isMe ? 700 : won ? 600 : 400,
        color: isMe ? "var(--club-primary)" : won ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{displayName}</span>
      {score !== null && (
        <span style={{
          fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums",
          color: won ? "#34d399" : lost ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.55)",
          minWidth: 14, textAlign: "right", flexShrink: 0,
        }}>{score}</span>
      )}
    </div>
  );
}

function BracketSlot({ match, clubName, clubLogoUrl, isChampFinal }: {
  match: BracketMatch; clubName: string; clubLogoUrl?: string | null; isChampFinal?: boolean;
}) {
  const homeWon = match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;
  const hasScores = match.homeScore !== null && match.awayScore !== null;
  const hasWinner = hasScores && (homeWon || awayWon);
  const isMyHome = !!match.homeTeam && match.homeTeam.trim().toLowerCase() === clubName.trim().toLowerCase();
  const isMyAway = !!match.awayTeam && match.awayTeam.trim().toLowerCase() === clubName.trim().toLowerCase();
  const homeLogo = isMyHome ? clubLogoUrl : resolveOpponentLogo(match.homeTeam);
  const awayLogo = isMyAway ? clubLogoUrl : resolveOpponentLogo(match.awayTeam);

  const borderColor = isChampFinal
    ? "rgba(251,191,36,0.35)"
    : hasWinner
    ? "rgba(52,211,153,0.28)"
    : "rgba(255,255,255,0.1)";

  return (
    <div style={{
      width: "100%", height: BR_SLOT_H, borderRadius: 9, overflow: "hidden",
      background: isChampFinal ? "rgba(251,191,36,0.09)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${borderColor}`,
      boxShadow: isChampFinal ? "0 0 12px rgba(251,191,36,0.12)" : undefined,
    }}>
      <BracketTeamRow
        name={match.homeTeam} logoUrl={homeLogo} score={match.homeScore}
        isMe={isMyHome} won={hasScores && homeWon} lost={hasScores && awayWon}
      />
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
      <BracketTeamRow
        name={match.awayTeam} logoUrl={awayLogo} score={match.awayScore}
        isMe={isMyAway} won={hasScores && awayWon} lost={hasScores && homeWon}
      />
    </div>
  );
}

function BracketVisual({ result, clubName, clubLogoUrl }: {
  result: CompetitionResult; clubName: string; clubLogoUrl?: string | null;
}) {
  const [lang] = useLang();
  const t = CLUBE[lang];
  const rounds = result.bracket;

  if (!rounds || rounds.length === 0 || rounds.every((r) => r.matches.length === 0)) {
    return <p className="text-white/30 text-sm text-center py-4">{t.noGamesRegistered}</p>;
  }

  const n0 = rounds[0].matches.length;
  const totalH = bracketTotalH(n0);
  const isChampion = result.isChampion;
  const lastRoundIdx = rounds.length - 1;

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 8, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-start", minWidth: "max-content" }}>
        {rounds.map((round, rIdx) => {
          const isLastRound = rIdx === lastRoundIdx;
          return (
            <div key={round.id} style={{ display: "flex", flexShrink: 0 }}>
              <div style={{ width: BR_COL_W, flexShrink: 0 }}>
                <div style={{
                  height: BR_HDR_H, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.3)", paddingBottom: 4,
                }}>
                  {round.name}
                </div>

                <div style={{ position: "relative", height: totalH, width: "100%" }}>
                  {round.matches.map((match, mIdx) => {
                    const topY = matchTopY(rIdx, mIdx);
                    const isChampFinal = isChampion && isLastRound && mIdx === 0;
                    return (
                      <div key={match.id} style={{ position: "absolute", top: topY, left: 0, right: 0 }}>
                        <BracketSlot
                          match={match}
                          clubName={clubName}
                          clubLogoUrl={clubLogoUrl}
                          isChampFinal={isChampFinal}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isLastRound && (
                <div style={{ width: BR_CONN_W, flexShrink: 0 }}>
                  <div style={{ height: BR_HDR_H }} />
                  <svg width={BR_CONN_W} height={totalH} style={{ display: "block", overflow: "visible" }}>
                    {round.matches.map((_, mIdx) => {
                      if (mIdx % 2 !== 0) return null;
                      if (mIdx + 1 >= round.matches.length) return null;
                      const nextMatchIdx = Math.floor(mIdx / 2);
                      const y1 = matchCenterY(rIdx, mIdx);
                      const y2 = matchCenterY(rIdx, mIdx + 1);
                      const y3 = matchCenterY(rIdx + 1, nextMatchIdx);
                      const mx = BR_CONN_W / 2;
                      return (
                        <g key={mIdx}>
                          <line x1={0} y1={y1} x2={mx} y2={y1} stroke={BR_LINE} strokeWidth={1} />
                          <line x1={mx} y1={y1} x2={mx} y2={y2} stroke={BR_LINE} strokeWidth={1} />
                          <line x1={0} y1={y2} x2={mx} y2={y2} stroke={BR_LINE} strokeWidth={1} />
                          <line x1={mx} y1={y3} x2={BR_CONN_W} y2={y3} stroke={BR_LINE} strokeWidth={1} />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingsDetail({ result, clubName }: { result: CompetitionResult; clubName: string }) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const isMyTeam = (name: string) =>
    name.trim().toLowerCase() === clubName.trim().toLowerCase();

  if (!result.standings || result.standings.length === 0) {
    return <p className="text-white/30 text-sm text-center py-4">{t.noTeamsRegistered}</p>;
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
  clubLogoUrl,
  onBack,
  onEdit,
  onDelete,
}: {
  result: CompetitionResult;
  clubName: string;
  clubLogoUrl?: string | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [lang] = useLang();
  const t = CLUBE[lang];
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-white/30 hover:text-white/70 transition-colors text-sm">
          ← {t.backBtn}
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
                {result.type === "mata-mata" ? t.knockout : t.league}
              </span>
              {result.isChampion && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                >
                  {t.champion}
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
              {t.edit}
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}
              >
                {t.delete}
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(248,113,113,0.2)", color: "#f87171" }}
                >
                  {t.confirm}
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
          <BracketVisual result={result} clubName={clubName} clubLogoUrl={clubLogoUrl} />
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
  clubLogoUrl,
}: Props) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const [selectedSeasonId, setSelectedSeasonId] = useState(seasonId);
  const [results, setResults] = useState<CompetitionResult[]>(() => getCompetitionResults(careerId));
  const [showModal, setShowModal] = useState(false);
  const [editingResult, setEditingResult] = useState<CompetitionResult | null>(null);
  const [detailResult, setDetailResult] = useState<CompetitionResult | null>(null);

  const seasonOptions = useMemo(() => {
    return [...seasons]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({ value: s.id, label: s.label + (s.id === seasonId ? ` ${t.currentSeason}` : "") }));
  }, [seasons, seasonId, t]);

  const matchTournaments = useMemo(() => {
    const seasonMatches = getMatches(selectedSeasonId);
    const set = new Set<string>();
    for (const m of seasonMatches) {
      if (m.tournament) set.add(m.tournament);
    }
    return Array.from(set).sort();
  }, [selectedSeasonId]);

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
          clubLogoUrl={clubLogoUrl}
          onBack={() => setDetailResult(null)}
          onEdit={() => handleEdit(currentDetailResult)}
          onDelete={() => handleDelete(currentDetailResult.id)}
        />
      ) : (
        <div className="space-y-4 py-4">
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
              <span>{t.addResult}</span>
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <span className="text-5xl">🏆</span>
              <p className="text-white/40 text-sm">{t.noResults}</p>
              <button
                type="button"
                onClick={() => { setEditingResult(null); setShowModal(true); }}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
              >
                {t.registerFirstResult}
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
                        {t.champion}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/30 text-xs capitalize">
                      {result.type === "mata-mata" ? t.knockout : t.league}
                    </span>
                    {result.type === "mata-mata" && result.bracket && result.bracket.length > 0 && (
                      <>
                        <span className="text-white/15 text-xs">·</span>
                        <span className="text-white/25 text-xs">
                          {result.bracket.length} {result.bracket.length !== 1 ? t.roundPlural : t.roundSingular}
                        </span>
                      </>
                    )}
                    {result.type === "pontos-corridos" && result.standings && result.standings.length > 0 && (
                      <>
                        <span className="text-white/15 text-xs">·</span>
                        <span className="text-white/25 text-xs">
                          {result.standings.length} {result.standings.length !== 1 ? t.teamsPlural : t.teamsSingular}
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
