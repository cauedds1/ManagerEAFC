import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { migratePositionOverride, type PositionPtBr, type SquadPlayer } from "@/lib/squadCache";
import type { TransferRecord } from "@/types/transfer";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  type TeamRole,
} from "@/types/playerStats";
import {
  generatePlayerId,
  generateTransferId,
} from "@/lib/transferStorage";
import { setPlayerStats, defaultStats, setPlayerOverride, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";
import { useLang } from "@/hooks/useLang";
import { TRANSFERENCIAS, LOAN_DURATION_LABELS, LOAN_DURATION_DISPLAY } from "@/lib/i18n";

const ALL_POSITIONS: PositionPtBr[] = ["GOL","DEF","MID","ATA"];

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

const ALL_ROLES: TeamRole[] = ["esporadico","rodizio","promessa","importante","crucial"];

const LOAN_DURATIONS = ["6 meses", "1 temporada", "2 temporadas", "3 temporadas"];

function getRoleLabel(role: TeamRole, t: Record<string, string>): string {
  const map: Record<TeamRole, string> = {
    esporadico: t.roleEsporadico,
    rodizio:    t.roleRodizio,
    promessa:   t.rolePromessa,
    importante: t.roleImportante,
    crucial:    t.roleCrucial,
  };
  return map[role] ?? role;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function formatFee(fee: number, freeLabel: string): string {
  if (fee === 0) return freeLabel;
  return `€${fee.toLocaleString("pt-BR")}`;
}

function parseFeeInput(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return 0;
  const mMatch = trimmed.match(/^([\d.,]+)\s*[Mm]$/);
  if (mMatch) {
    const base = parseFloat(mMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(base) ? 0 : Math.round(base * 1_000_000);
  }
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

function formatFeeInput(raw: string): string {
  const parsed = parseFeeInput(raw);
  if (parsed === 0 && raw !== "0") return raw;
  return parsed.toLocaleString("pt-BR");
}


function ClubBadge({ src, name, size = 24 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        className="rounded-lg flex items-center justify-center font-black text-white/40 flex-shrink-0"
        style={{ width: size, height: size, background: "rgba(255,255,255,0.06)", fontSize: size / 3 }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={name} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} onError={() => setErr(true)} />;
}

interface PlayerSuggestion {
  id: number;
  name: string;
  photo: string;
  age: number;
  nationality: string;
  position: PositionPtBr;
}

function PlayerFace({ src, name, size = 40 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(!src);
  const initials = name.trim().split(" ").map((p) => p[0]).slice(0,2).join("").toUpperCase();
  return (
    <div
      className="rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
    >
      {!err && src ? (
        <img src={src} alt={name} style={{ width: size, height: size, objectFit: "cover" }} onError={() => setErr(true)} />
      ) : (
        <span className="text-white/50 font-black" style={{ fontSize: size * 0.28 }}>{initials}</span>
      )}
    </div>
  );
}

function mapApiPosToPtBr(pos: string): PositionPtBr {
  const p = (pos ?? "").toLowerCase();
  if (p.includes("goalkeeper")) return "GOL";
  if (p.includes("defender")) return "DEF";
  if (p.includes("midfielder")) return "MID";
  if (p.includes("attacker") || p.includes("forward")) return "ATA";
  return "MID";
}

function PlayerAutocomplete({
  value,
  photo,
  allPlayers,
  onChange,
  onSelect,
  localOnly,
  hideLocalResults,
}: {
  value: string;
  photo: string;
  allPlayers: SquadPlayer[];
  onChange: (name: string) => void;
  onSelect: (p: PlayerSuggestion) => void;
  localOnly?: boolean;
  hideLocalResults?: boolean;
}) {
  const [lang] = useLang();
  const t = TRANSFERENCIAS[lang];

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiResults, setApiResults] = useState<PlayerSuggestion[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localResults = useMemo<PlayerSuggestion[]>(() => {
    if (hideLocalResults) return [];
    const q = value.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, localOnly ? 8 : 5)
      .map((p) => ({ id: p.id, name: p.name, photo: p.photo, age: p.age, nationality: "", position: p.positionPtBr }));
  }, [value, allPlayers, localOnly, hideLocalResults]);

  const fetchApi = useCallback(async (q: string) => {
    if (localOnly) return;
    if (q.trim().length < 2) { setApiResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      const res = await fetch(`/api/players/search?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json() as { players: Array<{ id: number; name: string; photo: string; age: number; position: string }> };
        const localNames = new Set(allPlayers.map((p) => p.name.toLowerCase()));
        const players: PlayerSuggestion[] = (data.players ?? [])
          .filter((p) => !localNames.has(p.name.toLowerCase()))
          .map((p) => ({
            id: p.id,
            name: p.name,
            photo: p.photo,
            age: p.age,
            nationality: "",
            position: (p.position as PositionPtBr) || "MID",
          }));
        setApiResults(players.slice(0, 8));
      }
    } catch { }
    setLoading(false);
  }, [allPlayers, localOnly]);

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(true);
    setApiResults([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!localOnly) timerRef.current = setTimeout(() => fetchApi(v), 350);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const allResults = [...localResults, ...apiResults];
  const showEmpty = open && allResults.length === 0 && !loading && value.trim().length >= 2;

  return (
    <div className="relative">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <PlayerFace src={photo} name={value || "?"} size={28} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={localOnly ? t.searchMySquadPlaceholder : t.searchPlayerPlaceholder}
        className="w-full pl-12 pr-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
        autoFocus
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
        </div>
      )}
      {open && allResults.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(12,12,18,0.98)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)" }}
        >
          {localResults.length > 0 && apiResults.length > 0 && (
            <p className="px-4 pt-2.5 pb-1 text-white/20 text-xs uppercase tracking-wider">{t.mySquadLabel}</p>
          )}
          {localResults.map((pl) => (
            <button
              key={`local-${pl.id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(pl); setOpen(false); setApiResults([]); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <PlayerFace src={pl.photo} name={pl.name} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{pl.name}</p>
                <p className="text-white/35 text-xs">{pl.position}{pl.age ? ` · ${pl.age} ${t.yearsOld}` : ""}</p>
              </div>
            </button>
          ))}
          {apiResults.length > 0 && (
            <p className="px-4 pt-2.5 pb-1 text-white/20 text-xs uppercase tracking-wider">{t.otherPlayersLabel}</p>
          )}
          {apiResults.map((pl) => (
            <button
              key={`api-${pl.id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(pl); setOpen(false); setApiResults([]); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <PlayerFace src={pl.photo} name={pl.name} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{pl.name}</p>
                <p className="text-white/35 text-xs">{pl.nationality ? `${pl.nationality} · ` : ""}{pl.position}{pl.age ? ` · ${pl.age} ${t.yearsOld}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {showEmpty && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl px-4 py-3"
          style={{ background: "rgba(12,12,18,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-white/30 text-xs">{t.noPlayerFound}</p>
        </div>
      )}
    </div>
  );
}

function findClubLogo(name: string): string | null {
  if (!name.trim()) return null;
  const q = name.toLowerCase().trim();
  const cached = getCachedClubList();
  if (cached && cached.length > 0) {
    const match = cached.find((c) => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q));
    if (match?.logo) return match.logo;
  }
  const staticMatches = searchStaticClubs(name);
  return staticMatches[0]?.logo ?? null;
}

function ClubAutocomplete({
  value,
  onChange,
  onSelectLogo,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectLogo: (logo: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || !open) return [];
    const cached = getCachedClubList();
    if (cached && cached.length > 0) {
      const q = value.toLowerCase().trim();
      return cached.filter((c) => c.name.toLowerCase().includes(q) || c.league.toLowerCase().includes(q)).slice(0, 8);
    }
    return searchStaticClubs(value);
  }, [value, open]);

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      if (value.trim()) {
        const logo = findClubLogo(value);
        if (logo) onSelectLogo(logo);
      }
    }, 180);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(12,12,18,0.98)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          {suggestions.map((club) => (
            <button
              key={club.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(club.name); onSelectLogo(club.logo || null); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <ClubBadge src={club.logo} name={club.name} size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{club.name}</p>
                <p className="text-white/35 text-xs truncate">{club.league}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoanActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: "amber" | "blue";
  onClick: () => void;
}) {
  const styles =
    color === "amber"
      ? { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" }
      : { bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)", text: "#60a5fa" };

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 active:scale-95 flex-shrink-0"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.text }}
    >
      {label}
    </button>
  );
}

function TransferCard({
  transfer,
  clubName,
  clubLogoUrl,
  onLoanAction,
}: {
  transfer: TransferRecord;
  clubName: string;
  clubLogoUrl?: string | null;
  onLoanAction?: (id: string, changes: Partial<TransferRecord>) => void;
}) {
  const [lang] = useLang();
  const t = TRANSFERENCIAS[lang];

  const migratedPosKey = migratePositionOverride(transfer.playerPositionPtBr) ?? "MID";
  const pos = POS_STYLE[migratedPosKey] ?? POS_STYLE.MID;
  const role = ROLE_COLORS[transfer.role];
  const isVenda = transfer.type === "venda";
  const isEmprestimo = transfer.type === "emprestimo";
  const isFree = !transfer.fromClub && !transfer.toClub;
  const isLoanEnded = isEmprestimo && transfer.loanEnded;

  const loanDurDisplay = transfer.loanDuration
    ? (LOAN_DURATION_DISPLAY[transfer.loanDuration]?.[lang] ?? transfer.loanDuration)
    : null;

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 glass glass-hover"
      style={isLoanEnded ? { opacity: 0.55 } : {}}
    >
      <PlayerFace src={transfer.playerPhoto} name={transfer.playerName} size={48} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-white font-bold text-sm truncate">{transfer.playerName}</p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: pos.bg, color: pos.color }}>
            {migratedPosKey}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: role.bg, color: role.color }}>
            {getRoleLabel(transfer.role, t)}
          </span>
          {isVenda && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-md flex-shrink-0 tracking-wider"
              style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
            >
              {t.badgeVenda}
            </span>
          )}
          {isEmprestimo && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-md flex-shrink-0 tracking-wider"
              style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}
            >
              {t.badgeEmprestimo}
            </span>
          )}
          {isEmprestimo && transfer.loanDirection === "entrada" && !isLoanEnded && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
            >
              {t.badgeLoanIn}
            </span>
          )}
          {isEmprestimo && transfer.loanDirection === "saida" && !isLoanEnded && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
            >
              {t.badgeLoanOut}
            </span>
          )}
          {isLoanEnded && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
            >
              {t.badgeLoanEnded}
            </span>
          )}
          {transfer.windowPending && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-md flex-shrink-0 tracking-wider"
              style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              {t.badgePendente}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/30 text-xs">{transfer.playerAge} {t.yearsOld}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/25 text-xs">{transfer.season}</span>
          {transfer.contractYears > 0 && !isVenda && !isEmprestimo && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/25 text-xs">{transfer.contractYears}{t.contractYearAbbr}</span>
            </>
          )}
          {isEmprestimo && loanDurDisplay && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/35 text-xs">{loanDurDisplay}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {isVenda ? (
            transfer.toClub ? (
              <>
                <ClubBadge src={clubLogoUrl} name={clubName} size={20} />
                <span className="text-white/30 text-xs truncate max-w-24">{clubName}</span>
                <svg className="w-3.5 h-3.5 text-yellow-400/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                </svg>
                <ClubBadge src={null} name={transfer.toClub} size={20} />
                <span className="text-white/30 text-xs truncate max-w-24">{transfer.toClub}</span>
              </>
            ) : (
              <span className="text-white/25 text-xs italic">{t.cardDeparture}</span>
            )
          ) : isEmprestimo ? (
            transfer.loanDirection === "saida" ? (
              <>
                <ClubBadge src={clubLogoUrl} name={clubName} size={20} />
                <span className="text-white/30 text-xs truncate max-w-24">{clubName}</span>
                <svg className="w-3.5 h-3.5 text-orange-400/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                </svg>
                {transfer.toClub ? (
                  <>
                    <ClubBadge src={transfer.toClubLogo ?? null} name={transfer.toClub} size={20} />
                    <span className="text-white/30 text-xs truncate max-w-24">{transfer.toClub}</span>
                  </>
                ) : (
                  <span className="text-white/25 text-xs italic">{t.cardUnknownClub}</span>
                )}
              </>
            ) : (
              <>
                {transfer.fromClub ? (
                  <>
                    <ClubBadge src={transfer.fromClubLogo} name={transfer.fromClub} size={20} />
                    <span className="text-white/30 text-xs truncate max-w-24">{transfer.fromClub}</span>
                    <svg className="w-3.5 h-3.5 text-orange-400/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </>
                ) : null}
                <ClubBadge src={clubLogoUrl} name={clubName} size={20} />
                <span className="text-white/30 text-xs truncate max-w-24">{clubName}</span>
              </>
            )
          ) : isFree ? (
            <span className="text-white/25 text-xs italic">{t.cardFreeAgent}</span>
          ) : (
            <>
              <ClubBadge src={transfer.fromClubLogo} name={transfer.fromClub!} size={20} />
              <span className="text-white/30 text-xs truncate max-w-24">{transfer.fromClub}</span>
              <svg className="w-3.5 h-3.5 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
              <ClubBadge src={clubLogoUrl} name={clubName} size={20} />
              <span className="text-white/30 text-xs truncate max-w-24">{clubName}</span>
            </>
          )}

          {isEmprestimo && !isLoanEnded && onLoanAction && (
            transfer.loanDirection === "saida" ? (
              <LoanActionButton
                label={t.btnRecallLoan}
                color="blue"
                onClick={() => onLoanAction(transfer.id, { loanEnded: true })}
              />
            ) : transfer.loanDirection === "entrada" ? (
              <LoanActionButton
                label={t.btnEndLoan}
                color="amber"
                onClick={() => onLoanAction(transfer.id, { loanEnded: true })}
              />
            ) : null
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-white font-black text-base tabular-nums">{formatFee(transfer.fee, t.freeLabel)}</p>
        {transfer.salary > 0 && !isVenda && !isEmprestimo && (
          <p className="text-white/35 text-xs tabular-nums">€{transfer.salary}{t.wagePerWeek}</p>
        )}
        <p className="text-white/20 text-xs mt-0.5">{formatDate(transfer.transferredAt)}</p>
      </div>
    </div>
  );
}

interface FormData {
  transferType: "compra" | "venda" | "emprestimo";
  loanDirection: "entrada" | "saida";
  loanDuration: string;
  playerMode: "search" | "create";
  playerName: string;
  playerPositionPtBr: PositionPtBr;
  playerAge: string;
  playerPhoto: string;
  playerNationality: string;
  shirtNumber: string;
  playerOverall: string;
  fee: string;
  salary: string;
  contractYears: string;
  role: TeamRole;
  fromClub: string;
  fromClubLogo: string;
  toClub: string;
  toClubLogo: string;
  resolvedPlayerId: number | null;
  tradeEnabled: boolean;
  tradePlayerName: string;
  tradePlayerPhoto: string;
  tradePlayerNationality: string;
  tradePlayerId: number | null;
  tradePlayerAge: string;
  tradePlayerPosition: PositionPtBr;
  tradePlayerOverall: string;
  tradePlayerMode: "search" | "create";
}

const DEFAULT_FORM: FormData = {
  transferType: "compra",
  loanDirection: "entrada",
  loanDuration: "1 temporada",
  playerMode: "search",
  playerName: "",
  playerPositionPtBr: "ATA",
  playerAge: "",
  playerPhoto: "",
  playerNationality: "",
  shirtNumber: "",
  playerOverall: "",
  fee: "",
  salary: "",
  contractYears: "4",
  role: "importante",
  fromClub: "",
  fromClubLogo: "",
  toClub: "",
  toClubLogo: "",
  resolvedPlayerId: null,
  tradeEnabled: false,
  tradePlayerName: "",
  tradePlayerPhoto: "",
  tradePlayerNationality: "",
  tradePlayerId: null,
  tradePlayerAge: "",
  tradePlayerPosition: "ATA",
  tradePlayerOverall: "",
  tradePlayerMode: "search",
};

interface TransferenciasViewProps {
  careerId: string;
  seasonId: string;
  transfers: TransferRecord[];
  season: string;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onTransferAdded: (transfer: TransferRecord) => void;
  onTransferUpdated?: (id: string, changes: Partial<TransferRecord>) => void;
  onHighValueSigning?: (playerName: string, ovr: number, position: string, fromClub?: string, deltaVsAvg?: number, isPending?: boolean) => void;
  onPlayerLeftInTrade?: (player: SquadPlayer) => void;
  transferWindowOpen?: boolean;
  transferWindowOpenCount?: number;
  onToggleWindow?: () => void;
  isReadOnly?: boolean;
}

export function TransferenciasView({
  careerId,
  seasonId,
  transfers,
  season,
  clubName,
  clubLogoUrl,
  allPlayers,
  onTransferAdded,
  onTransferUpdated,
  onHighValueSigning,
  onPlayerLeftInTrade,
  transferWindowOpen = false,
  transferWindowOpenCount = 0,
  onToggleWindow,
  isReadOnly,
}: TransferenciasViewProps) {
  const [lang] = useLang();
  const t = TRANSFERENCIAS[lang];
  const loanDurationLabels = LOAN_DURATION_LABELS[lang];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const sortedTransfers = [...transfers].sort((a, b) => {
    if (a.windowPending && !b.windowPending) return -1;
    if (!a.windowPending && b.windowPending) return 1;
    return b.transferredAt - a.transferredAt;
  });
  const comprasCount = transfers.filter((t) => !t.type || t.type === "compra").length;
  const vendasCount = transfers.filter((t) => t.type === "venda").length;
  const emprestimosCount = transfers.filter((t) => t.type === "emprestimo").length;
  const pendingCount = transfers.filter((t) => t.windowPending).length;

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const isVendaForm = form.transferType === "venda";
  const isEmprestimoForm = form.transferType === "emprestimo";
  const isLoanSaida = isEmprestimoForm && form.loanDirection === "saida";

  const valid =
    form.playerName.trim().length >= 2 &&
    form.playerAge.trim() !== "" &&
    parseInt(form.playerAge, 10) > 0;

  const handleSubmit = () => {
    if (!valid || submitting) return;
    setSubmitting(true);

    const isVenda = form.transferType === "venda";
    const isEmprestimo = form.transferType === "emprestimo";
    const isEntrada = !isVenda && !isLoanSaida;
    const isPending = !transferWindowOpen;

    const playerId =
      ((isVenda || isLoanSaida) && form.resolvedPlayerId)
        ? form.resolvedPlayerId
        : generatePlayerId();

    if (isEntrada) {
      setPlayerStats(seasonId, playerId, defaultStats(playerId));
    }

    const ovrVal = parseInt(form.playerOverall, 10);
    const signingOvr = isEntrada && !isNaN(ovrVal) && form.playerOverall.trim()
      ? Math.max(1, Math.min(99, ovrVal))
      : undefined;

    if (isEntrada && signingOvr != null) {
      setPlayerOverride(careerId, playerId, { overall: signingOvr });

      if (onHighValueSigning) {
        const allOverrides = getAllPlayerOverrides(careerId);
        const ovrs = allPlayers
          .map((p) => allOverrides[p.id]?.overall)
          .filter((o): o is number => o != null && o > 0);
        const squadAvg = ovrs.length > 0
          ? Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length)
          : null;
        if (squadAvg != null && signingOvr >= squadAvg + 3) {
          onHighValueSigning(
            form.playerName.trim(),
            signingOvr,
            form.playerPositionPtBr,
            form.fromClub.trim() || undefined,
            signingOvr - squadAvg,
            isPending,
          );
        }
      }
    }

    const transfer: TransferRecord = {
      id: generateTransferId(),
      careerId,
      season,
      playerId,
      playerName: form.playerName.trim(),
      playerPhoto: form.playerPhoto.trim(),
      playerPositionPtBr: form.playerPositionPtBr,
      playerAge: parseInt(form.playerAge, 10) || 0,
      shirtNumber: form.shirtNumber.trim() ? parseInt(form.shirtNumber, 10) : undefined,
      fee: parseFeeInput(form.fee),
      salary: isVenda || isEmprestimo ? 0 : (parseFloat(form.salary) || 0),
      contractYears: isVenda || isEmprestimo ? 0 : (parseInt(form.contractYears, 10) || 1),
      role: form.role,
      type: form.transferType,
      fromClub: isEntrada ? (form.fromClub.trim() || undefined) : undefined,
      fromClubLogo: isEntrada ? (form.fromClubLogo.trim() || undefined) : undefined,
      toClub: (isVenda || isLoanSaida) ? (form.toClub.trim() || undefined) : undefined,
      toClubLogo: (isVenda || isLoanSaida) ? (form.toClubLogo.trim() || undefined) : undefined,
      loanDuration: isEmprestimo ? form.loanDuration : undefined,
      loanDirection: isEmprestimo ? form.loanDirection : undefined,
      loanEnded: false,
      playerOverall: signingOvr,
      transferredAt: Date.now(),
      windowPending: isPending || undefined,
    };

    onTransferAdded(transfer);

    if (!isPending && (isVenda || isLoanSaida)) {
      const leftPlayer = allPlayers.find((p) => p.id === playerId);
      if (leftPlayer) {
        onPlayerLeftInTrade?.(leftPlayer);
      }
    }

    const squadIds = new Set(allPlayers.map((p) => p.id));
    const tradeIsValid = form.tradeEnabled && form.tradePlayerName.trim().length >= 2 &&
      (isEntrada
        ? form.tradePlayerId !== null
        : isVenda
          ? (form.tradePlayerMode === "create" ||
              (form.tradePlayerId !== null && !squadIds.has(form.tradePlayerId)))
          : false);

    if (tradeIsValid) {
      if (isEntrada) {
        const tradedPlayer = allPlayers.find((p) => p.id === form.tradePlayerId);
        const tradeTransfer: TransferRecord = {
          id: generateTransferId(),
          careerId,
          season,
          playerId: form.tradePlayerId!,
          playerName: form.tradePlayerName.trim(),
          playerPhoto: form.tradePlayerPhoto.trim(),
          playerPositionPtBr: form.tradePlayerPosition,
          playerAge: parseInt(form.tradePlayerAge, 10) || 0,
          fee: 0,
          salary: 0,
          contractYears: 0,
          role: "esporadico",
          type: "venda",
          toClub: form.fromClub.trim() || undefined,
          toClubLogo: form.fromClubLogo.trim() || undefined,
          loanEnded: false,
          transferredAt: Date.now() + 1,
          windowPending: isPending || undefined,
        };
        onTransferAdded(tradeTransfer);
        if (!isPending && tradedPlayer) {
          onPlayerLeftInTrade?.(tradedPlayer);
        }
      } else if (isVenda) {
        const tradePlayerId = form.tradePlayerId ?? generatePlayerId();
        setPlayerStats(seasonId, tradePlayerId, defaultStats(tradePlayerId));
        const tradeOvrVal = parseInt(form.tradePlayerOverall, 10);
        const tradeOvr = !isNaN(tradeOvrVal) && form.tradePlayerOverall.trim()
          ? Math.max(1, Math.min(99, tradeOvrVal))
          : undefined;
        if (tradeOvr != null) {
          setPlayerOverride(careerId, tradePlayerId, { overall: tradeOvr });
        }
        const tradeTransfer: TransferRecord = {
          id: generateTransferId(),
          careerId,
          season,
          playerId: tradePlayerId,
          playerName: form.tradePlayerName.trim(),
          playerPhoto: form.tradePlayerPhoto.trim(),
          playerPositionPtBr: form.tradePlayerPosition,
          playerAge: parseInt(form.tradePlayerAge, 10) || 0,
          fee: 0,
          salary: 0,
          contractYears: 1,
          role: "importante",
          type: "compra",
          fromClub: form.toClub.trim() || undefined,
          fromClubLogo: form.toClubLogo.trim() || undefined,
          loanEnded: false,
          playerOverall: tradeOvr,
          transferredAt: Date.now() + 1,
          windowPending: isPending || undefined,
        };
        onTransferAdded(tradeTransfer);
      }
    }

    setForm(DEFAULT_FORM);
    setShowForm(false);
    setSubmitting(false);
  };

  const openForm = (type: "compra" | "venda" | "emprestimo") => {
    setForm({ ...DEFAULT_FORM, transferType: type });
    setShowForm(true);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20";
  const labelClass = "text-white/40 text-xs font-medium mb-1 block";

  const formTitle = isVendaForm
    ? t.formTitleVenda
    : isEmprestimoForm
    ? t.formTitleEmprestimo
    : t.formTitleCompra;

  const submitLabel = submitting
    ? t.btnSubmitting
    : isVendaForm
    ? t.btnConfirmVenda
    : isEmprestimoForm
    ? t.btnConfirmEmprestimo
    : t.btnConfirmContratacao;

  const submitStyle = isVendaForm
    ? { background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24" }
    : isEmprestimoForm
    ? { background: "rgba(251,146,60,0.2)", border: "1px solid rgba(251,146,60,0.35)", color: "#fb923c" }
    : { background: "var(--club-gradient)", border: "none", color: "white" };

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">{t.heading}</h2>
          {comprasCount > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums"
              style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
            >
              {comprasCount} {comprasCount !== 1 ? t.entradaPlural : t.entradaSingular}
            </span>
          )}
          {emprestimosCount > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums"
              style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c" }}
            >
              {emprestimosCount} {emprestimosCount !== 1 ? t.emprestimoPlural : t.emprestimoSingular}
            </span>
          )}
          {vendasCount > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
            >
              {vendasCount} {vendasCount !== 1 ? t.saidaPlural : t.saidaSingular}
            </span>
          )}
          {pendingCount > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums"
              style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}
            >
              {pendingCount} {pendingCount !== 1 ? t.pendentePlural : t.pendenteSingular}
            </span>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openForm("venda")}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold text-white/80 transition-all duration-200 hover:opacity-90 active:scale-95 glass glass-hover"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              <span className="hidden sm:inline">{t.btnRegVenda}</span>
            </button>
            <button
              onClick={() => openForm("emprestimo")}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-95 glass glass-hover"
              style={{ color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="hidden sm:inline">{t.btnEmprestimo}</span>
            </button>
            <button
              onClick={() => openForm("compra")}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: "var(--club-gradient)" }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{t.btnRegContratacao}</span>
            </button>
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
          style={{
            background: transferWindowOpen
              ? "rgba(34,197,94,0.08)"
              : "rgba(168,85,247,0.08)",
            border: `1px solid ${transferWindowOpen ? "rgba(34,197,94,0.2)" : "rgba(168,85,247,0.2)"}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: transferWindowOpen ? "#22c55e" : "#a855f7",
                boxShadow: transferWindowOpen ? "0 0 8px rgba(34,197,94,0.6)" : "0 0 8px rgba(168,85,247,0.5)",
              }}
            />
            <div>
              <p className="text-white font-bold text-sm">
                {t.windowLabel} {transferWindowOpen ? t.windowOpen : t.windowClosed}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                {transferWindowOpen
                  ? t.windowImmediateEffect
                  : transferWindowOpenCount >= 2
                  ? t.windowClosedSeason
                  : `${2 - transferWindowOpenCount} ${2 - transferWindowOpenCount !== 1 ? t.windowOpeningsPlural : t.windowOpeningsSingular}`}
              </p>
            </div>
          </div>
          {onToggleWindow && (
            <button
              onClick={onToggleWindow}
              disabled={!transferWindowOpen && transferWindowOpenCount >= 2}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed flex-shrink-0"
              style={
                transferWindowOpen
                  ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                  : transferWindowOpenCount >= 2
                  ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }
                  : { background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }
              }
            >
              {transferWindowOpen ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t.btnCloseWindow}
                </>
              ) : transferWindowOpenCount >= 2 ? (
                t.btnWindowEnded
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t.btnOpenWindow}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {sortedTransfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl gap-4 glass text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}>
            <svg className="w-8 h-8" style={{ color: "rgba(var(--club-primary-rgb),0.5)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 font-semibold text-base">{t.emptyTitle}</p>
            <p className="text-white/25 text-sm mt-1">{t.emptySub}</p>
          </div>
          <button
            onClick={() => openForm("compra")}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--club-gradient)" }}
          >
            {t.emptyBtn}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-x-auto">
          {sortedTransfers.map((tr) => (
            <TransferCard
              key={tr.id}
              transfer={tr}
              clubName={clubName}
              clubLogoUrl={clubLogoUrl}
              onLoanAction={!isReadOnly && onTransferUpdated ? onTransferUpdated : undefined}
            />
          ))}
        </div>
      )}

      {showForm && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowForm(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
            style={{
              background: "var(--app-bg-lighter)",
              border: "1px solid var(--surface-border)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
              maxHeight: "90vh",
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--surface-border)" }}
            >
              <div>
                <h3 className="text-white font-black text-lg">{formTitle}</h3>
                <p className="text-white/35 text-xs mt-0.5">{t.formSeasonLabel} {season}</p>
              </div>
              {!transferWindowOpen && (
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}
                >
                  {t.formWindowPending}
                </span>
              )}
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
              {(["compra", "emprestimo", "venda"] as const).map((tp) => {
                const active = form.transferType === tp;
                const activeStyle =
                  tp === "compra"
                    ? { bg: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "rgba(var(--club-primary-rgb),0.4)" }
                    : tp === "emprestimo"
                    ? { bg: "rgba(251,146,60,0.18)", color: "#fb923c", border: "rgba(251,146,60,0.4)" }
                    : { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.35)" };
                return (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => set("transferType", tp)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: active ? activeStyle.bg : "rgba(255,255,255,0.05)",
                      color: active ? activeStyle.color : "rgba(255,255,255,0.4)",
                      border: `1px solid ${active ? activeStyle.border : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {tp === "compra" ? t.tabCompra : tp === "emprestimo" ? t.tabEmprestimo : t.tabVenda}
                  </button>
                );
              })}
            </div>

            {isEmprestimoForm && (
              <div className="px-6 pt-3 flex-shrink-0 flex flex-col gap-3">
                <div className="flex gap-2">
                  {(["entrada", "saida"] as const).map((dir) => {
                    const active = form.loanDirection === dir;
                    return (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => set("loanDirection", dir)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                        style={{
                          background: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                          color: active ? "white" : "rgba(255,255,255,0.35)",
                          border: `1px solid ${active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                        }}
                      >
                        <span>{dir === "entrada" ? "↓" : "↑"}</span>
                        <span>{dir === "entrada" ? t.loanIn : t.loanOut}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label className={labelClass}>{t.loanDurationLabel}</label>
                  <div className="flex gap-2 flex-wrap">
                    {LOAN_DURATIONS.map((dur, idx) => {
                      const active = form.loanDuration === dur;
                      const displayLabel = loanDurationLabels[idx] ?? dur;
                      return (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => set("loanDuration", dur)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: active ? "rgba(251,146,60,0.18)" : "rgba(255,255,255,0.05)",
                            color: active ? "#fb923c" : "rgba(255,255,255,0.4)",
                            border: `1px solid ${active ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-y-auto p-6 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass} style={{ marginBottom: 0 }}>{t.playerLabel}</label>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                    {(["search", "create"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, playerMode: mode, playerName: "", playerPhoto: "", playerNationality: "", resolvedPlayerId: null }))}
                        className="px-2.5 py-1 text-[11px] font-semibold transition-all"
                        style={{
                          background: form.playerMode === mode ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                          color: form.playerMode === mode ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {mode === "search" ? t.btnSearch : t.btnCreate}
                      </button>
                    ))}
                  </div>
                </div>

                {form.playerMode === "search" ? (
                  <PlayerAutocomplete
                    value={form.playerName}
                    photo={form.playerPhoto}
                    allPlayers={allPlayers}
                    onChange={(v) => set("playerName", v)}
                    onSelect={(p) => {
                      setForm((f) => ({
                        ...f,
                        playerName: p.name,
                        playerPhoto: p.photo,
                        playerAge: p.age ? String(p.age) : f.playerAge,
                        playerPositionPtBr: p.position,
                        resolvedPlayerId: p.id,
                      }));
                    }}
                    localOnly={isLoanSaida}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      autoFocus
                      className={inputClass}
                      value={form.playerName}
                      onChange={(e) => set("playerName", e.target.value)}
                      placeholder={t.playerFullNamePlaceholder}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{t.nationalityLabel}</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={form.playerNationality}
                          onChange={(e) => set("playerNationality", e.target.value)}
                          placeholder={t.nationalityPtPlaceholder}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t.photoLabel}</label>
                        <input
                          type="url"
                          className={inputClass}
                          value={form.playerPhoto}
                          onChange={(e) => set("playerPhoto", e.target.value)}
                          placeholder={t.phPhoto}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t.positionLabel}</label>
                  <select
                    className={`${inputClass} cursor-pointer`}
                    style={{ appearance: "none" }}
                    value={form.playerPositionPtBr}
                    onChange={(e) => set("playerPositionPtBr", e.target.value as PositionPtBr)}
                  >
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p} style={{ background: "#1a1030" }}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t.ageLabel}</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.playerAge}
                    onChange={(e) => set("playerAge", e.target.value)}
                    placeholder={t.phAge}
                    min={14}
                    max={50}
                  />
                </div>

                {!isVendaForm && !isLoanSaida && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.overallLabel}</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.playerOverall}
                      onChange={(e) => set("playerOverall", e.target.value)}
                      placeholder={t.overallPlaceholder}
                      min={1}
                      max={99}
                    />
                    <p className="text-white/20 text-xs mt-1">{t.overallHint}</p>
                  </div>
                )}

                {!isVendaForm && !isEmprestimoForm && (
                  <>
                    <div>
                      <label className={labelClass}>{t.shirtNumberLabel}</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={form.shirtNumber}
                        onChange={(e) => set("shirtNumber", e.target.value)}
                        placeholder={t.phShirtNumber}
                        min={1}
                        max={99}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t.contractLabel}</label>
                      <select
                        className={`${inputClass} cursor-pointer`}
                        style={{ appearance: "none" }}
                        value={form.contractYears}
                        onChange={(e) => set("contractYears", e.target.value)}
                      >
                        {[1,2,3,4,5,6,7].map((y) => (
                          <option key={y} value={y} style={{ background: "#1a1030" }}>{y} {y === 1 ? t.yearSingular : t.yearPlural}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>{t.fromClubLabel}</label>
                      <ClubAutocomplete
                        value={form.fromClub}
                        onChange={(v) => set("fromClub", v)}
                        onSelectLogo={(logo) => set("fromClubLogo", logo ?? "")}
                        placeholder={t.fromClubPlaceholder}
                      />
                      <p className="text-white/20 text-xs mt-1">{t.fromClubHint}</p>
                    </div>
                  </>
                )}

                {isEmprestimoForm && form.loanDirection === "entrada" && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.fromClubLabel}</label>
                    <ClubAutocomplete
                      value={form.fromClub}
                      onChange={(v) => set("fromClub", v)}
                      onSelectLogo={(logo) => set("fromClubLogo", logo ?? "")}
                      placeholder={t.fromClubLoanPlaceholder}
                    />
                  </div>
                )}

                {isEmprestimoForm && form.loanDirection === "saida" && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.toClubLabel}</label>
                    <ClubAutocomplete
                      value={form.toClub}
                      onChange={(v) => set("toClub", v)}
                      onSelectLogo={(logo) => set("toClubLogo", logo ?? "")}
                      placeholder={t.toClubPlaceholder}
                    />
                  </div>
                )}

                {isVendaForm && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t.toClubLabel}</label>
                    <ClubAutocomplete
                      value={form.toClub}
                      onChange={(v) => set("toClub", v)}
                      onSelectLogo={(logo) => set("toClubLogo", logo ?? "")}
                      placeholder={t.toClubPlaceholder}
                    />
                    <p className="text-white/20 text-xs mt-1">{t.toClubHint}</p>
                  </div>
                )}
              </div>

              {!isVendaForm && !isEmprestimoForm && (
                <div>
                  <label className={labelClass}>{t.squadRoleLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((r) => {
                      const c = ROLE_COLORS[r];
                      const active = form.role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => set("role", r)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150"
                          style={{
                            background: active ? c.bg : "rgba(255,255,255,0.05)",
                            color: active ? c.color : "rgba(255,255,255,0.4)",
                            border: active ? `1px solid ${c.color}40` : "1px solid rgba(255,255,255,0.08)",
                            transform: active ? "scale(1.04)" : "scale(1)",
                          }}
                        >
                          {getRoleLabel(r, t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isEmprestimoForm && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: form.tradeEnabled
                      ? "1px solid rgba(251,146,60,0.35)"
                      : "1px solid rgba(251,146,60,0.2)",
                    background: form.tradeEnabled
                      ? "rgba(251,146,60,0.06)"
                      : "rgba(251,146,60,0.04)",
                  }}
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold transition-all"
                    style={{
                      color: form.tradeEnabled ? "#fb923c" : "rgba(251,146,60,0.75)",
                    }}
                    onClick={() => setForm((f) => ({
                      ...f,
                      tradeEnabled: !f.tradeEnabled,
                      tradePlayerName: "",
                      tradePlayerPhoto: "",
                      tradePlayerNationality: "",
                      tradePlayerId: null,
                      tradePlayerAge: "",
                      tradePlayerPosition: "ATA",
                      tradePlayerOverall: "",
                      tradePlayerMode: "search",
                    }))}
                  >
                    <span className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span>
                        {isVendaForm ? t.tradeReceive : t.tradeInclude}
                        <span className="block text-[11px] font-normal mt-0.5" style={{ color: "rgba(251,146,60,0.5)" }}>
                          {isVendaForm ? t.tradeSubReceive : t.tradeSubInclude}
                        </span>
                      </span>
                    </span>
                    <svg
                      className="w-4 h-4 flex-shrink-0 transition-transform"
                      style={{ transform: form.tradeEnabled ? "rotate(180deg)" : "rotate(0deg)" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {form.tradeEnabled && (
                    <div className="px-4 pb-4 pt-3 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                      {!isVendaForm ? (
                        <>
                          <p className="text-xs text-white/30">{t.tradeSelectHint}</p>
                          {form.tradePlayerName ? (
                            <div
                              className="flex items-center gap-3 p-3 rounded-xl"
                              style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.25)" }}
                            >
                              {form.tradePlayerPhoto ? (
                                <img src={form.tradePlayerPhoto} alt={form.tradePlayerName} className="w-9 h-9 rounded-lg object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "rgba(251,146,60,0.2)", color: "#fb923c" }}>
                                  {form.tradePlayerName.charAt(0)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-bold truncate">{form.tradePlayerName}</p>
                                <p className="text-white/40 text-xs">{form.tradePlayerPosition} · {form.tradePlayerAge ? `${form.tradePlayerAge} ${t.yearsOld}` : "—"}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, tradePlayerName: "", tradePlayerPhoto: "", tradePlayerId: null, tradePlayerAge: "", tradePlayerPosition: "ATA" }))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <PlayerAutocomplete
                              value={form.tradePlayerName}
                              photo={form.tradePlayerPhoto}
                              allPlayers={allPlayers}
                              onChange={(v) => set("tradePlayerName", v)}
                              onSelect={(p) => setForm((f) => ({
                                ...f,
                                tradePlayerName: p.name,
                                tradePlayerPhoto: p.photo,
                                tradePlayerId: p.id,
                                tradePlayerAge: p.age ? String(p.age) : "",
                                tradePlayerPosition: p.position,
                              }))}
                              localOnly={true}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-white/30">{t.tradeRegisterHint}</p>

                          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", alignSelf: "flex-start" }}>
                            {(["search", "create"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, tradePlayerMode: mode, tradePlayerName: "", tradePlayerPhoto: "", tradePlayerNationality: "", tradePlayerId: null }))}
                                className="px-2.5 py-1 text-[11px] font-semibold transition-all"
                                style={{
                                  background: form.tradePlayerMode === mode ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.04)",
                                  color: form.tradePlayerMode === mode ? "#fb923c" : "rgba(255,255,255,0.35)",
                                }}
                              >
                                {mode === "search" ? t.btnSearch : t.btnCreate}
                              </button>
                            ))}
                          </div>

                          {form.tradePlayerMode === "search" ? (
                            <PlayerAutocomplete
                              value={form.tradePlayerName}
                              photo={form.tradePlayerPhoto}
                              allPlayers={allPlayers}
                              onChange={(v) => set("tradePlayerName", v)}
                              onSelect={(p) => setForm((f) => ({
                                ...f,
                                tradePlayerName: p.name,
                                tradePlayerPhoto: p.photo,
                                tradePlayerId: p.id,
                                tradePlayerAge: p.age ? String(p.age) : "",
                                tradePlayerPosition: p.position,
                              }))}
                              localOnly={false}
                            />
                          ) : (
                            <div className="flex flex-col gap-3">
                              <input
                                type="text"
                                autoFocus
                                className={inputClass}
                                value={form.tradePlayerName}
                                onChange={(e) => set("tradePlayerName", e.target.value)}
                                placeholder={t.playerFullNamePlaceholder}
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={labelClass}>{t.nationalityLabel}</label>
                                  <input
                                    type="text"
                                    className={inputClass}
                                    value={form.tradePlayerNationality}
                                    onChange={(e) => set("tradePlayerNationality", e.target.value)}
                                    placeholder={t.tradeNationalityPlaceholder}
                                  />
                                </div>
                                <div>
                                  <label className={labelClass}>{t.photoLabel}</label>
                                  <input
                                    type="url"
                                    className={inputClass}
                                    value={form.tradePlayerPhoto}
                                    onChange={(e) => set("tradePlayerPhoto", e.target.value)}
                                    placeholder={t.phPhoto}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={labelClass}>{t.tradePosLabel}</label>
                              <select
                                className={`${inputClass} cursor-pointer`}
                                style={{ appearance: "none" }}
                                value={form.tradePlayerPosition}
                                onChange={(e) => set("tradePlayerPosition", e.target.value as PositionPtBr)}
                              >
                                {ALL_POSITIONS.map((p) => (
                                  <option key={p} value={p} style={{ background: "#1a1030" }}>{p}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>{t.tradeAgeLabel}</label>
                              <input
                                type="number"
                                className={inputClass}
                                value={form.tradePlayerAge}
                                onChange={(e) => set("tradePlayerAge", e.target.value)}
                                placeholder={t.phTradeAge}
                                min={14}
                                max={50}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>{t.overallAbbr}</label>
                              <input
                                type="number"
                                className={inputClass}
                                value={form.tradePlayerOverall}
                                onChange={(e) => set("tradePlayerOverall", e.target.value)}
                                placeholder={t.phTradeOvr}
                                min={1}
                                max={99}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div
                className="p-4 rounded-2xl flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">
                  {isVendaForm ? t.financeSaleLabel : isEmprestimoForm ? t.financeLoanLabel : t.financeGeneralLabel}
                </p>
                <div className={`grid gap-4 ${isVendaForm || isEmprestimoForm ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div>
                    <label className={labelClass}>{t.feeLabel}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClass}
                      value={form.fee}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const hasMSuffix = /[Mm]$/.test(raw.trim());
                        if (hasMSuffix || raw === "" || raw === "0") {
                          set("fee", raw);
                        } else {
                          const digits = raw.replace(/[^\d]/g, "");
                          set("fee", digits ? Number(digits).toLocaleString("pt-BR") : "");
                        }
                      }}
                      onBlur={(e) => {
                        const formatted = formatFeeInput(e.target.value);
                        set("fee", formatted === "0" ? "" : formatted);
                      }}
                      placeholder={isEmprestimoForm ? t.feeLoanPlaceholder : t.feeSigningPlaceholder}
                    />
                  </div>
                  {!isVendaForm && !isEmprestimoForm && (
                    <div>
                      <label className={labelClass}>{t.salaryLabel}</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={form.salary}
                        onChange={(e) => set("salary", e.target.value)}
                        placeholder={t.phSalary}
                        min={0}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="flex gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: "1px solid var(--surface-border)" }}
            >
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 glass glass-hover transition-all"
              >
                {t.btnCancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!valid || submitting}
                className="flex-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ ...submitStyle, flex: 2 }}
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
