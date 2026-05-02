import { useState, useEffect, useMemo, useRef } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import { migratePositionOverride } from "@/lib/squadCache";
import type { PlayerOverride } from "@/types/playerStats";
import { setPlayerOverride, addMarketValueEntry, getPlayerStats, setPlayerStats } from "@/lib/playerStatsStorage";
import { getMatches } from "@/lib/matchStorage";
import { syncSeasonFromDb } from "@/lib/dbSync";
import { getSeasons } from "@/lib/seasonStorage";
import { useLang } from "@/hooks/useLang";
import { PLAYER_PROFILE, POSITION_DISPLAY } from "@/lib/i18n";

// ── Flag emoji ────────────────────────────────────────────────────────────────
const NAT_CODE: Record<string, string> = {
  "Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Angola":"AO","Argentina":"AR",
  "Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ","Bahrain":"BH",
  "Bangladesh":"BD","Belarus":"BY","Belgium":"BE","Bolivia":"BO","Bosnia":"BA",
  "Brazil":"BR","Bulgaria":"BG","Cameroon":"CM","Canada":"CA","Chile":"CL",
  "China":"CN","Colombia":"CO","Congo":"CD","Costa Rica":"CR","Croatia":"HR",
  "Cuba":"CU","Czech Republic":"CZ","Denmark":"DK","Dominican Republic":"DO",
  "Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Ethiopia":"ET","Finland":"FI",
  "France":"FR","Gambia":"GM","Georgia":"GE","Germany":"DE","Ghana":"GH",
  "Greece":"GR","Guatemala":"GT","Guinea":"GN","Honduras":"HN","Hungary":"HU",
  "Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ",
  "Ireland":"IE","Israel":"IL","Italy":"IT","Ivory Coast":"CI","Jamaica":"JM",
  "Japan":"JP","Jordan":"JO","Kazakhstan":"KZ","Kenya":"KE","Kuwait":"KW",
  "Lebanon":"LB","Liberia":"LR","Libya":"LY","Mali":"ML","Mexico":"MX",
  "Moldova":"MD","Montenegro":"ME","Morocco":"MA","Mozambique":"MZ",
  "Netherlands":"NL","New Zealand":"NZ","Nicaragua":"NI","Nigeria":"NG",
  "North Korea":"KP","North Macedonia":"MK","Norway":"NO","Oman":"OM",
  "Pakistan":"PK","Palestine":"PS","Panama":"PA","Paraguay":"PY","Peru":"PE",
  "Poland":"PL","Portugal":"PT","Qatar":"QA","Romania":"RO","Russia":"RU",
  "Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS","Sierra Leone":"SL",
  "Slovakia":"SK","Slovenia":"SI","Somalia":"SO","South Africa":"ZA",
  "South Korea":"KR","Spain":"ES","Sudan":"SD","Sweden":"SE","Switzerland":"CH",
  "Syria":"SY","Tanzania":"TZ","Thailand":"TH","Togo":"TG",
  "Trinidad and Tobago":"TT","Tunisia":"TN","Turkey":"TR","Uganda":"UG",
  "Ukraine":"UA","United Arab Emirates":"AE","United States":"US","Uruguay":"UY",
  "Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN","Zambia":"ZM","Zimbabwe":"ZW",
};

const FLAG_SPECIAL: Record<string, string> = {
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Northern Ireland": "🇬🇧",
  "Kosovo": "🇽🇰",
};

function toFlag(nat: string): string {
  if (!nat) return "";
  if (FLAG_SPECIAL[nat]) return FLAG_SPECIAL[nat];
  const code = NAT_CODE[nat];
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)).join("");
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#34d399" }: {
  data: Array<{ value: number; date: number }>;
  color?: string;
}) {
  if (data.length < 2) return null;
  const W = 240, H = 50, PAD = 6;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max === min ? 1 : max - min;
  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + ((max - v) / range) * (H - PAD * 2);
  const pts = data.map((d, i) => [toX(i), toY(d.value)] as [number, number]);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={color} />)}
    </svg>
  );
}

// ── Monthly bar chart ─────────────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: Array<{ label: string; avg: number }> }) {
  if (data.length === 0) {
    return <div className="text-white/20 text-xs text-center py-6">—</div>;
  }
  const max = Math.max(...data.map(d => d.avg), 0.1);
  const H = 52;
  return (
    <div className="flex items-end gap-1" style={{ height: H + 32 }}>
      {data.map((d, i) => {
        const barH = Math.max(4, (d.avg / max) * H);
        const color = d.avg >= 8 ? "#34d399" : d.avg >= 7 ? "#a3e635" : d.avg >= 6 ? "#fbbf24" : "#f87171";
        return (
          <div key={i} className="flex flex-col items-center flex-1 gap-0.5">
            <span className="text-[9px] font-semibold" style={{ color }}>{d.avg.toFixed(1)}</span>
            <div className="w-full rounded-t" style={{ height: barH, background: color, opacity: 0.75 }} />
            <span className="text-[9px] text-white/25">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Position badge colors ─────────────────────────────────────────────────────
const POS_STYLE: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",  color: "#f87171" },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ProfileTab = "details" | "season" | "matches" | "career";
type MatchItem = ReturnType<typeof getMatches>[number];

interface PlayerProfileModalProps {
  player: SquadPlayer;
  careerId: string;
  seasonId?: string;
  override?: PlayerOverride;
  onClose: () => void;
  onUpdated: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function PlayerProfileModal({
  player,
  careerId,
  seasonId,
  override,
  onClose,
  onUpdated,
}: PlayerProfileModalProps) {
  const [lang] = useLang();
  const t = PLAYER_PROFILE[lang];

  const [tab, setTab] = useState<ProfileTab>("details");
  const [allSeasons, setAllSeasons] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(seasonId ?? "");
  const syncedRef = useRef(new Set<string>(seasonId ? [seasonId] : []));
  const [isSyncing, setIsSyncing] = useState(false);
  const [seasonMatches, setSeasonMatches] = useState<MatchItem[]>([]);

  const [editMode, setEditMode] = useState(false);
  const [editFoot, setEditFoot] = useState(override?.preferredFoot ?? "");
  const [editContractStart, setEditContractStart] = useState(override?.contractStart ?? "");
  const [editContractEnd, setEditContractEnd] = useState(override?.contractEnd ?? "");
  const [editMv, setEditMv] = useState(override?.marketValue != null ? String(override.marketValue) : "");
  const editMvDateRef = useRef(new Date().toISOString().slice(0, 10));

  const [careerData, setCareerData] = useState<Array<{
    seasonId: string;
    label: string;
    goals: number;
    assists: number;
    matches: number;
    minutes: number;
    avgRating: number;
    motm: number;
  }>>([]);
  const [careerLoaded, setCareerLoaded] = useState(false);

  const displayName  = override?.nameOverride ?? player.name;
  const displayOvr   = override?.overall;
  const displayPos   = (migratePositionOverride(override?.positionOverride) ?? player.positionPtBr) as PositionPtBr;
  const displayPhoto = override?.photoOverride ?? player.photo;
  const posStyle     = POS_STYLE[displayPos] ?? POS_STYLE.MID;

  useEffect(() => {
    getSeasons(careerId).then(seasons =>
      setAllSeasons(seasons.map(s => ({ id: s.id, label: s.label })))
    );
  }, [careerId]);

  useEffect(() => {
    if (!selectedSeasonId || (tab !== "season" && tab !== "matches")) return;
    let cancelled = false;
    const load = async () => {
      if (!syncedRef.current.has(selectedSeasonId)) {
        setIsSyncing(true);
        try { await syncSeasonFromDb(selectedSeasonId); } catch {}
        syncedRef.current.add(selectedSeasonId);
      }
      if (!cancelled) {
        setIsSyncing(false);
        setSeasonMatches(getMatches(selectedSeasonId));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedSeasonId, tab]);

  useEffect(() => {
    if (tab !== "career" || careerLoaded) return;
    getSeasons(careerId).then(seasons => {
      const data = seasons
        .map(s => {
          const st = getPlayerStats(s.id, player.id);
          let motm: number;
          if (st.motmCount !== undefined) {
            motm = st.motmCount;
          } else {
            const derived = getMatches(s.id).filter(m => m.motmPlayerId === player.id).length;
            // Only persist when > 0 to avoid writing incorrect zeroes for
            // historical seasons whose matches aren't loaded in this session.
            if (derived > 0) {
              setPlayerStats(s.id, player.id, { ...st, motmCount: derived }, false);
            }
            motm = derived;
          }
          const ratings = st.recentRatings ?? [];
          const avgRating = ratings.length
            ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
            : 0;
          return {
            seasonId: s.id,
            label: s.label,
            goals: st.goals,
            assists: st.assists,
            matches: st.matchesAsStarter + st.matchesAsSubstitute,
            minutes: st.totalMinutes,
            avgRating,
            motm,
          };
        });
      setCareerData(data);
      setCareerLoaded(true);
    });
  }, [tab, careerLoaded, careerId, player.id]);

  const playerMatches = useMemo<MatchItem[]>(() =>
    seasonMatches
      .filter(m => m.starterIds.includes(player.id) || m.subIds.includes(player.id))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  , [seasonMatches, player.id]);

  const monthlyData = useMemo(() => {
    const byMonth: Record<string, { sum: number; count: number }> = {};
    for (const m of playerMatches) {
      const ps = m.playerStats?.[player.id];
      const rating = ps?.rating ?? 0;
      if (rating > 0 && m.date && m.date.length >= 7) {
        const key = m.date.slice(0, 7);
        if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 };
        byMonth[key].sum += rating;
        byMonth[key].count++;
      }
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { sum, count }]) => ({ label: month.slice(5), avg: sum / count }));
  }, [playerMatches, player.id]);

  const seasonStatsData = useMemo(() =>
    getPlayerStats(selectedSeasonId, player.id)
  , [selectedSeasonId, player.id]);

  const motmInSeason = useMemo(() =>
    seasonMatches.filter(m => m.motmPlayerId === player.id).length
  , [seasonMatches, player.id]);

  const matchAggregates = useMemo(() => {
    let goals = 0, penGoals = 0, hatTricks = 0;
    let assists = 0;
    let passes = 0, passAccSum = 0, passAccWeightCount = 0;
    let keyPasses = 0, dribs = 0;
    let ballRec = 0, ballLoss = 0;
    let yellows = 0, reds = 0, ownGoals = 0, missedPen = 0;
    for (const m of playerMatches) {
      const ps = m.playerStats?.[player.id];
      if (!ps) continue;
      const goalEntries = ps.goals ?? [];
      const mg = goalEntries.length;
      goals += mg;
      penGoals += goalEntries.filter((g: { goalType?: string }) => g.goalType === "penalti").length;
      if (mg >= 3) hatTricks++;
      const ma = Object.values(m.playerStats ?? {}).reduce(
        (acc, pms) => acc + (pms.goals ?? []).filter((g: { assistPlayerId?: number }) => g.assistPlayerId === player.id).length, 0
      );
      assists += ma;
      if (ps.passes != null) {
        passes += ps.passes;
        if (ps.passAccuracy != null) {
          passAccSum += ps.passAccuracy * ps.passes;
          passAccWeightCount += ps.passes;
        }
      }
      if (ps.keyPasses != null) keyPasses += ps.keyPasses;
      if (ps.dribblesCompleted != null) dribs += ps.dribblesCompleted;
      if (ps.ballRecoveries != null) ballRec += ps.ballRecoveries;
      if (ps.ballLosses != null) ballLoss += ps.ballLosses;
      if (ps.yellowCard) yellows++;
      if (ps.yellowCard2) yellows++;
      if (ps.redCard) reds++;
      if (ps.ownGoal) ownGoals++;
      if (ps.missedPenalty) missedPen++;
    }
    const totalMin = seasonStatsData.totalMinutes;
    const totalGames = playerMatches.length;
    const avgPass = passAccWeightCount > 0 ? passAccSum / passAccWeightCount : null;
    const goalsPerGame = totalGames > 0 ? (goals / totalGames).toFixed(2) : "—";
    const assistsPerGame = totalGames > 0 ? (assists / totalGames).toFixed(2) : "—";
    const minPerGoal = goals > 0 ? Math.round(totalMin / goals) : null;
    const minPerAssist = assists > 0 ? Math.round(totalMin / assists) : null;
    return { goals, penGoals, hatTricks, assists, passes, avgPass, keyPasses, dribs,
             ballRec, ballLoss, yellows, reds, ownGoals, missedPen,
             goalsPerGame, assistsPerGame, minPerGoal, minPerAssist };
  }, [playerMatches, player.id, seasonStatsData.totalMinutes]);

  const saveEdit = () => {
    setPlayerOverride(careerId, player.id, {
      preferredFoot: (editFoot as "right" | "left" | "both") || undefined,
      contractStart: editContractStart.trim() || undefined,
      contractEnd: editContractEnd.trim() || undefined,
    });
    const mvNum = parseFloat(editMv.replace(/[^0-9.]/g, ""));
    const currentMv = override?.marketValue ?? 0;
    if (!isNaN(mvNum) && mvNum > 0 && mvNum !== currentMv) {
      addMarketValueEntry(
        careerId,
        player.id,
        mvNum,
        new Date(editMvDateRef.current + "T12:00:00").getTime(),
      );
    }
    setEditMode(false);
    onUpdated();
  };

  const TABS: { key: ProfileTab; label: string }[] = [
    { key: "details", label: t.tabDetails },
    { key: "season",  label: t.tabSeason  },
    { key: "matches", label: t.tabMatches },
    { key: "career",  label: t.tabCareer  },
  ];

  const seasonSelector = allSeasons.length > 0 && (
    <select
      value={selectedSeasonId}
      onChange={e => setSelectedSeasonId(e.target.value)}
      className="px-3 py-1.5 rounded-xl text-white/80 text-xs font-semibold focus:outline-none"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <option value="">—</option>
      {allSeasons.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );

  const bioItems = [
    { label: t.nationality,   value: override?.nationality ? `${toFlag(override.nationality)} ${override.nationality}` : "—" },
    { label: t.age,           value: player.age > 0 ? `${player.age} ${lang === "pt" ? "anos" : "y.o."}` : "—" },
    { label: t.position,      value: displayPos || "—" },
    { label: t.height,        value: override?.height || "—" },
    { label: t.weight,        value: override?.weight || "—" },
    { label: t.preferredFoot, value: override?.preferredFoot
      ? (override.preferredFoot === "right" ? t.footRight : override.preferredFoot === "left" ? t.footLeft : t.footBoth)
      : "—" },
    { label: t.salary,        value: override?.salary && override.salary > 0 ? `€${fmt(override.salary)}/sem` : "—" },
    { label: t.marketValue,   value: override?.marketValue && override.marketValue > 0 ? `€${fmt(override.marketValue)}` : "—" },
    { label: t.shirtNumber,   value: override?.shirtNumber != null ? `#${override.shirtNumber}` : "—" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "rgba(0,0,0,0.72)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-full items-start justify-center p-4 py-6">
        <div
          className="w-full flex flex-col rounded-2xl animate-slide-up overflow-hidden"
          style={{
            maxWidth: 660,
            background: "var(--app-bg-lighter, #141024)",
            border: "1px solid var(--surface-border)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.75)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div
            className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0 gap-4"
            style={{ borderBottom: "1px solid var(--surface-border)" }}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
              >
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={displayName}
                    className="w-16 h-16 object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <svg viewBox="0 0 40 40" className="w-8 h-8 text-white/15" fill="currentColor">
                    <circle cx="20" cy="14" r="7" />
                    <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-black leading-tight truncate">{displayName}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-lg"
                    style={{ background: posStyle.bg, color: posStyle.color }}
                  >
                    {POSITION_DISPLAY[lang][displayPos] ?? displayPos}
                  </span>
                  {displayOvr != null && (
                    <span
                      className="text-xs font-black px-2.5 py-0.5 rounded-lg"
                      style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
                    >
                      {displayOvr} OVR
                    </span>
                  )}
                  {override?.nationality && (
                    <span className="text-sm" title={override.nationality}>
                      {toFlag(override.nationality)}
                    </span>
                  )}
                  {override?.shirtNumber != null && (
                    <span className="text-xs text-white/30 font-mono">#{override.shirtNumber}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 px-6 pt-4 pb-0 flex-shrink-0">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                style={tab === key
                  ? { background: "var(--club-gradient)", color: "#fff", boxShadow: "0 2px 12px rgba(var(--club-primary-rgb),0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Scrollable body ── */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4"
            style={{ maxHeight: "66vh" }}
          >

            {/* ════ DETALHES ════ */}
            {tab === "details" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {bioItems.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-0.5 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                      <span className="text-white/80 text-xs font-semibold">{value}</span>
                    </div>
                  ))}
                </div>

                {/* ── Contract block ── */}
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2.5">{t.contractSection}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 text-[10px] font-medium">{t.contractStart}</span>
                      <span className="text-white/75 text-xs font-semibold">{override?.contractStart || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 text-[10px] font-medium">{t.contractEnd}</span>
                      <span className="text-white/75 text-xs font-semibold">{override?.contractEnd || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 text-[10px] font-medium">{t.salary} {t.weekly}</span>
                      <span className="text-white/75 text-xs font-semibold">
                        {override?.salary && override.salary > 0 ? `€${fmt(override.salary)}` : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 text-[10px] font-medium">{t.salary} {t.annual}</span>
                      <span className="text-white/75 text-xs font-semibold">
                        {override?.salary && override.salary > 0 ? `€${fmt(override.salary * 52)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {(override?.ovrHistory?.length ?? 0) > 1 && (
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">{t.ovrSection}</p>
                    <Sparkline
                      data={override!.ovrHistory!.map(e => ({ value: e.ovr, date: e.date }))}
                      color="var(--club-primary, #8b5cf6)"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-white/20 text-[10px]">
                        {new Date(override!.ovrHistory![0].date).toLocaleDateString()}
                      </span>
                      <span className="text-white/20 text-[10px]">
                        {new Date(override!.ovrHistory![override!.ovrHistory!.length - 1].date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {(override?.marketValueHistory?.length ?? 0) > 1 && (
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">{t.marketValueSection}</p>
                    <Sparkline
                      data={override!.marketValueHistory!.map(e => ({ value: e.value, date: e.date }))}
                      color="#34d399"
                    />
                  </div>
                )}

                {(override?.salaryHistory?.length ?? 0) > 1 && (
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">{t.salarySection}</p>
                    <Sparkline
                      data={override!.salaryHistory!.map(e => ({ value: e.value, date: e.date }))}
                      color="#60a5fa"
                    />
                  </div>
                )}

                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white/40 hover:text-white/70 transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    ✏️ {t.editSection}
                  </button>
                ) : (
                  <div
                    className="flex flex-col gap-3 p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-white/50 text-xs font-bold uppercase tracking-wider">{t.editSection}</p>

                    <div>
                      <label className="text-white/35 text-[11px] font-medium mb-1 block">{t.preferredFoot}</label>
                      <select
                        value={editFoot}
                        onChange={e => setEditFoot(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-white/80 text-xs focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <option value="">—</option>
                        <option value="right">{t.footRight}</option>
                        <option value="left">{t.footLeft}</option>
                        <option value="both">{t.footBoth}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-white/35 text-[11px] font-medium mb-1 block">{t.contractStart}</label>
                        <input
                          type="text"
                          placeholder="01/07/2023"
                          value={editContractStart}
                          onChange={e => setEditContractStart(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-white/80 text-xs focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                      <div>
                        <label className="text-white/35 text-[11px] font-medium mb-1 block">{t.contractEnd}</label>
                        <input
                          type="text"
                          placeholder="30/06/2026"
                          value={editContractEnd}
                          onChange={e => setEditContractEnd(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-white/80 text-xs focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-white/35 text-[11px] font-medium mb-1 block">{t.newMarketValue} (€)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="5000000"
                        value={editMv}
                        onChange={e => setEditMv(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-white/80 text-xs focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveEdit}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all"
                        style={{ background: "var(--club-gradient)" }}
                      >
                        {t.saveBtn}
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white/70 transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
                      >
                        {t.cancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ════ TEMPORADA ════ */}
            {tab === "season" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.seasonSection}</p>
                  {seasonSelector}
                </div>

                {isSyncing && (
                  <p className="text-white/30 text-xs text-center py-4">{t.loading}</p>
                )}

                {!isSyncing && !selectedSeasonId && (
                  <p className="text-white/25 text-xs text-center py-8">{t.noData}</p>
                )}

                {!isSyncing && selectedSeasonId && (
                  <>
                    {(() => {
                      const avgRating = (() => {
                        const r = seasonStatsData.recentRatings ?? [];
                        return r.length ? r.reduce((a: number, b: number) => a + b, 0) / r.length : null;
                      })();
                      const totalGames = seasonStatsData.matchesAsStarter + seasonStatsData.matchesAsSubstitute;
                      const statBlock = (title: string, items: { label: string; value: string | number | null; color?: string }[]) => (
                        <div
                          key={title}
                          className="p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2.5">{title}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {items.map(({ label, value, color }) => (
                              <div key={label} className="flex flex-col gap-0.5">
                                <span
                                  className="text-sm font-black tabular-nums"
                                  style={{ color: color ?? "rgba(255,255,255,0.75)" }}
                                >
                                  {value ?? "—"}
                                </span>
                                <span className="text-white/30 text-[10px] font-medium leading-tight">{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      return (
                        <>
                          {statBlock(t.matchesBlock, [
                            { label: t.totalGames, value: totalGames },
                            { label: t.starters,   value: seasonStatsData.matchesAsStarter },
                            { label: t.minutesCol, value: seasonStatsData.totalMinutes },
                            { label: t.motm,       value: motmInSeason > 0 ? `⭐${motmInSeason}` : "—", color: "#fbbf24" },
                            { label: t.avgRating,  value: avgRating ? avgRating.toFixed(1) : "—", color: "#a78bfa" },
                          ])}
                          {statBlock(t.attackBlock, [
                            { label: t.goals,          value: matchAggregates.goals,          color: matchAggregates.goals > 0 ? "#34d399" : undefined },
                            { label: t.penGoals,       value: matchAggregates.penGoals > 0 ? matchAggregates.penGoals : "—" },
                            { label: t.goalsPerGame,   value: matchAggregates.goalsPerGame },
                            { label: t.hatTricks,      value: matchAggregates.hatTricks > 0 ? matchAggregates.hatTricks : "—", color: matchAggregates.hatTricks > 0 ? "#fbbf24" : undefined },
                            { label: t.minPerGoal,     value: matchAggregates.minPerGoal ?? "—" },
                            { label: t.assists,        value: matchAggregates.assists,         color: matchAggregates.assists > 0 ? "#60a5fa" : undefined },
                            { label: t.assistsPerGame, value: matchAggregates.assistsPerGame },
                            { label: t.minPerAssist,   value: matchAggregates.minPerAssist ?? "—" },
                          ])}
                          {statBlock(t.passesBlock, [
                            { label: t.passes,         value: matchAggregates.passes > 0 ? matchAggregates.passes : "—" },
                            { label: t.passAccuracy,   value: matchAggregates.avgPass != null ? `${Math.round(matchAggregates.avgPass)}%` : "—" },
                            { label: t.keyPasses,      value: matchAggregates.keyPasses > 0 ? matchAggregates.keyPasses : "—" },
                            { label: t.dribbles,       value: matchAggregates.dribs > 0 ? matchAggregates.dribs : "—" },
                          ])}
                          {statBlock(t.defenseBlock, [
                            { label: t.ballRecoveries, value: matchAggregates.ballRec > 0 ? matchAggregates.ballRec : "—" },
                            { label: t.ballLosses,     value: matchAggregates.ballLoss > 0 ? matchAggregates.ballLoss : "—" },
                          ])}
                          {statBlock(t.otherBlock, [
                            { label: t.yellowCards,      value: matchAggregates.yellows > 0 ? matchAggregates.yellows : "—",  color: matchAggregates.yellows > 0 ? "#fbbf24" : undefined },
                            { label: t.redCards,         value: matchAggregates.reds > 0 ? matchAggregates.reds : "—",        color: matchAggregates.reds > 0 ? "#f87171" : undefined },
                            { label: t.ownGoals,         value: matchAggregates.ownGoals > 0 ? matchAggregates.ownGoals : "—" },
                            { label: t.missedPenalties,  value: matchAggregates.missedPen > 0 ? matchAggregates.missedPen : "—" },
                          ])}
                        </>
                      );
                    })()}

                    <div
                      className="p-4 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-4">{t.monthlyRating}</p>
                      <MonthlyBarChart data={monthlyData} />
                    </div>
                  </>
                )}
              </>
            )}

            {/* ════ PARTIDAS ════ */}
            {tab === "matches" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.tabMatches}</p>
                  {seasonSelector}
                </div>

                {isSyncing && (
                  <p className="text-white/30 text-xs text-center py-4">{t.loading}</p>
                )}

                {!isSyncing && playerMatches.length === 0 && (
                  <p className="text-white/25 text-xs text-center py-8">{t.noData}</p>
                )}

                {!isSyncing && playerMatches.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {playerMatches.map((match, i) => {
                      const ps = match.playerStats?.[player.id];
                      const isStarter = match.starterIds.includes(player.id);
                      const isMotm   = match.motmPlayerId === player.id;
                      const rating   = ps?.rating;
                      const goalCount = (ps?.goals ?? []).length;
                      const assistCount = Object.values(match.playerStats ?? {}).reduce(
                        (acc, pms) => acc + (pms.goals ?? []).filter(g => g.assistPlayerId === player.id).length,
                        0,
                      );
                      const won  = match.myScore > match.opponentScore;
                      const drew = match.myScore === match.opponentScore;
                      const resultColor = won ? "#34d399" : drew ? "#fbbf24" : "#f87171";
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div className="flex-1 min-w-0">
                            {/* Fixture line: both teams + score */}
                            {(() => {
                              const isHome = match.location !== "fora";
                              const myLabel  = t.myClub;
                              const oppLabel = match.opponent ?? "—";
                              const [leftTeam, leftScore, rightScore, rightTeam] = isHome
                                ? [myLabel,  match.myScore, match.opponentScore, oppLabel]
                                : [oppLabel, match.opponentScore, match.myScore, myLabel];
                              return (
                                <div className="flex items-center gap-1 text-xs font-semibold">
                                  <span className="text-white/70 truncate max-w-[5rem]">{leftTeam}</span>
                                  <span className="font-black tabular-nums" style={{ color: resultColor }}>
                                    {leftScore}–{rightScore}
                                  </span>
                                  <span className="text-white/70 truncate max-w-[5rem]">{rightTeam}</span>
                                  {isMotm && <span className="text-[10px] ml-0.5">⭐</span>}
                                </div>
                              );
                            })()}
                            {/* Metadata row: date · competition · round */}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-white/25 text-[10px]">{match.date ?? ""}</span>
                              {match.tournament && (
                                <span className="text-white/20 text-[10px] truncate">{match.tournament}</span>
                              )}
                              {match.stage && (
                                <span className="text-white/20 text-[10px] truncate">{match.stage}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {goalCount > 0 && (
                              <span className="text-[10px] font-bold" style={{ color: "#34d399" }}>⚽{goalCount}</span>
                            )}
                            {assistCount > 0 && (
                              <span className="text-[10px] font-bold" style={{ color: "#60a5fa" }}>🅰️{assistCount}</span>
                            )}
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                              style={{
                                background: "rgba(255,255,255,0.07)",
                                color: isStarter ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)",
                              }}
                            >
                              {isStarter ? t.starter : t.sub}
                            </span>
                            {rating != null && (
                              <span
                                className="text-xs font-black tabular-nums"
                                style={{
                                  color: rating >= 8 ? "#34d399" : rating >= 7 ? "#a3e635" : rating >= 6 ? "#fbbf24" : "#f87171",
                                  minWidth: "2rem",
                                  textAlign: "center",
                                }}
                              >
                                {rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ════ CARREIRA ════ */}
            {tab === "career" && (
              <>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.careerSection}</p>

                {!careerLoaded && (
                  <p className="text-white/30 text-xs text-center py-4">{t.loading}</p>
                )}

                {careerLoaded && careerData.length === 0 && (
                  <p className="text-white/25 text-xs text-center py-8">{t.noData}</p>
                )}

                {careerLoaded && careerData.length > 0 && (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full border-collapse text-xs min-w-[420px]">
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {[t.seasonCol, t.gamesCol, t.goalsCol, t.assistsCol, t.minutesCol, t.ratingCol, t.motmCol].map((col, ci) => (
                            <th
                              key={col}
                              className="px-2 py-2 text-white/30 font-semibold uppercase tracking-wider text-[10px]"
                              style={{ textAlign: ci === 0 ? "left" : "center" }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {careerData.map((row, i) => (
                          <tr
                            key={row.seasonId}
                            style={{
                              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                            }}
                          >
                            <td className="px-2 py-2.5 text-white/60 font-semibold text-left">{row.label}</td>
                            <td className="px-2 py-2.5 text-white/70 text-center tabular-nums">{row.matches}</td>
                            <td className="px-2 py-2.5 text-center tabular-nums">
                              {row.goals > 0
                                ? <span style={{ color: "#34d399" }} className="font-bold">{row.goals}</span>
                                : <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-2 py-2.5 text-center tabular-nums">
                              {row.assists > 0
                                ? <span style={{ color: "#60a5fa" }} className="font-bold">{row.assists}</span>
                                : <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-2 py-2.5 text-white/50 text-center tabular-nums">
                              {row.minutes > 0 ? row.minutes : "—"}
                            </td>
                            <td className="px-2 py-2.5 text-center tabular-nums">
                              {row.avgRating > 0 ? (
                                <span
                                  className="font-bold"
                                  style={{ color: row.avgRating >= 8 ? "#34d399" : row.avgRating >= 7 ? "#a3e635" : row.avgRating >= 6 ? "#fbbf24" : "#f87171" }}
                                >
                                  {row.avgRating.toFixed(1)}
                                </span>
                              ) : <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-2 py-2.5 text-center tabular-nums">
                              {row.motm > 0
                                ? <span style={{ color: "#fbbf24" }} className="font-bold">⭐{row.motm}</span>
                                : <span className="text-white/20">—</span>}
                            </td>
                          </tr>
                        ))}

                        {careerData.length > 1 && (() => {
                          const tot = careerData.reduce(
                            (acc, r) => ({
                              matches:  acc.matches  + r.matches,
                              goals:    acc.goals    + r.goals,
                              assists:  acc.assists  + r.assists,
                              minutes:  acc.minutes  + r.minutes,
                              motm:     acc.motm     + r.motm,
                            }),
                            { matches: 0, goals: 0, assists: 0, minutes: 0, motm: 0 },
                          );
                          return (
                            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(var(--club-primary-rgb),0.04)" }}>
                              <td className="px-2 py-2.5 text-white/40 font-bold text-[10px] uppercase tracking-wider">{t.totals}</td>
                              <td className="px-2 py-2.5 text-white/70 text-center tabular-nums font-bold">{tot.matches}</td>
                              <td className="px-2 py-2.5 text-center tabular-nums font-bold" style={{ color: "#34d399" }}>{tot.goals || "—"}</td>
                              <td className="px-2 py-2.5 text-center tabular-nums font-bold" style={{ color: "#60a5fa" }}>{tot.assists || "—"}</td>
                              <td className="px-2 py-2.5 text-white/50 text-center tabular-nums font-bold">{tot.minutes || "—"}</td>
                              <td className="px-2 py-2.5 text-white/25 text-center">—</td>
                              <td className="px-2 py-2.5 text-center tabular-nums font-bold" style={{ color: "#fbbf24" }}>
                                {tot.motm > 0 ? `⭐${tot.motm}` : "—"}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
