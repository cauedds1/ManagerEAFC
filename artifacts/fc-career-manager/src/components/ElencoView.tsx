import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/hooks/useLang";
import { CLUBE } from "@/lib/i18n";
import { SectionHelp } from "./SectionHelp";
import type { SquadResult, SquadPlayer, PositionPtBr, PositionGroup } from "@/lib/squadCache";
import { migratePositionOverride, PT_BR_TO_POSITION } from "@/lib/squadCache";
import type { PlayerOverride } from "@/types/playerStats";
import type { TransferRecord } from "@/types/transfer";
import { getAllPlayerOverrides, applyOverridesToPlayers, setPlayerOverride } from "@/lib/playerStatsStorage";
import { getEffectiveToken } from "@/lib/authToken";
import { PlayerProfileModal } from "./PlayerProfileModal";
import {
  getCustomPlayers,
  addCustomPlayer,
  getExitSeasonMap,
  saveExitSeasonId,
  removeCustomPlayer,
  getHiddenPlayerIds,
  addHiddenPlayerId,
  addFormerPlayer,
  generateCustomPlayerId,
} from "@/lib/customPlayersStorage";
import { FootballPitch, pickBestEleven } from "./FootballPitch";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import {
  getCustomLineup,
  setCustomLineup,
  clearCustomLineup,
  getBenchOrder,
  setBenchOrder,
  clearBenchOrder,
  getFormation,
  setFormation,
} from "@/lib/lineupStorage";
import {
  type FormationKey,
  FORMATION_GROUPS,
  getFormationLabel,
  DEFAULT_FORMATION,
} from "@/lib/formations";

const ALL_POSITIONS: PositionPtBr[] = ["GOL", "DEF", "MID", "ATA"];

interface AddPlayerForm {
  name: string;
  position: PositionPtBr;
  age: string;
  nationality: string;
  photo: string;
  overall: string;
}

const DEFAULT_ADD_FORM: AddPlayerForm = {
  name: "",
  position: "ATA",
  age: "",
  nationality: "",
  photo: "",
  overall: "",
};

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!src);
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.06)" }}
    >
      {!error ? (
        <img
          src={src}
          alt={name}
          className={`w-9 h-9 object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="w-6 h-6 text-white/15" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
    </div>
  );
}

function ovrStyle(ovr: number): { bg: string; color: string; ring?: string } {
  if (ovr >= 90) return { bg: "rgba(234,179,8,0.20)", color: "#facc15", ring: "rgba(234,179,8,0.40)" };
  if (ovr >= 85) return { bg: "rgba(99,102,241,0.22)", color: "#a5b4fc", ring: "rgba(99,102,241,0.40)" };
  if (ovr >= 75) return { bg: "rgba(16,185,129,0.18)", color: "#6ee7b7", ring: "rgba(16,185,129,0.30)" };
  return { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" };
}

function OvrBadge({ ovr }: { ovr: number }) {
  const s = ovrStyle(ovr);
  return (
    <span
      className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md leading-none"
      style={{
        background: s.bg,
        color: s.color,
        boxShadow: s.ring ? `0 0 0 1px ${s.ring}` : undefined,
        minWidth: "2rem",
        textAlign: "center",
        display: "inline-block",
      }}
    >
      {ovr}
    </span>
  );
}

function SquadSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl glass">
          <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "60%" }} />
            <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: "30%" }} />
          </div>
          <div className="w-10 h-5 rounded-md animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  overrides,
  selected,
  onClick,
  dimmed,
  ageYears,
}: {
  player: SquadPlayer;
  overrides: Record<number, PlayerOverride>;
  selected?: boolean;
  onClick: (player: SquadPlayer) => void;
  dimmed?: boolean;
  ageYears: string;
}) {
  const ov = overrides[player.id];
  const displayName = ov?.nameOverride ?? player.name;
  const displayNumber = ov?.shirtNumber ?? player.number;
  const displayOverall = ov?.overall;
  const displayPos = migratePositionOverride(ov?.positionOverride) ?? player.positionPtBr;
  const displayPhoto = ov?.photoOverride ?? player.photo;
  const pos = POS_STYLE[displayPos] ?? POS_STYLE.MID;

  return (
    <button
      onClick={() => onClick(player)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-left${selected ? " pulse-swap" : ""}`}
      style={{
        background: selected
          ? "rgba(var(--club-primary-rgb),0.14)"
          : "rgba(255,255,255,0.04)",
        border: selected
          ? "1px solid rgba(var(--club-primary-rgb),0.35)"
          : "1px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
        opacity: dimmed ? 0.4 : 1,
        filter: dimmed ? "grayscale(0.5)" : undefined,
      }}
    >
      <PlayerPhoto src={displayPhoto} name={displayName} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-tight truncate">{displayName}</p>
        <p className="text-white/30 text-xs mt-0.5">{player.age > 0 ? `${player.age} ${ageYears}` : ""}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {displayOverall != null && (
          <OvrBadge ovr={displayOverall} />
        )}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: pos.bg, color: pos.color }}
        >
          {displayPos}
        </span>
        {displayNumber != null && (
          <span className="text-white/25 text-xs font-mono tabular-nums w-5 text-right">
            #{displayNumber}
          </span>
        )}
      </div>
    </button>
  );
}

type SquadTab = "pitch" | "list" | "exits";

interface ElencoViewProps {
  careerId: string;
  seasonId?: string;
  clubName?: string;
  teamId?: number;
  backfillSeasonYear?: number;
  squad: SquadResult | null;
  squadLoading: boolean;
  squadError: boolean;
  allPlayers: SquadPlayer[];
  transfers?: TransferRecord[];
  formerPlayers?: SquadPlayer[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOverridesUpdated?: () => void;
  onPlayerRemoved?: () => void;
  onImportSquad?: (players: SquadPlayer[]) => void;
  onCustomPlayersChange?: (players: SquadPlayer[]) => void;
  isFinalized?: boolean;
  finalizedPlayers?: SquadPlayer[];
  finalizedLeftIds?: Set<number>;
  finalizedSeasonStats?: Record<number, { matchesAsStarter: number; totalMinutes: number }>;
  isCustomClub?: boolean;
  isDemo?: boolean;
}

export function ElencoView({
  careerId,
  seasonId,
  squad,
  squadLoading,
  squadError,
  allPlayers,
  transfers,
  formerPlayers,
  onRefresh,
  onOpenSettings,
  onOverridesUpdated,
  onPlayerRemoved,
  onImportSquad,
  onCustomPlayersChange,
  isFinalized,
  finalizedPlayers,
  finalizedLeftIds,
  finalizedSeasonStats,
  isCustomClub,
  isDemo,
  teamId,
  backfillSeasonYear,
}: ElencoViewProps) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const [tab, setTab] = useState<SquadTab>("pitch");
  const [pendingSwap, setPendingSwap] = useState<SquadPlayer | null>(null);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<SquadPlayer | null>(null);
  const [overrides, setOverrides] = useState<Record<number, PlayerOverride>>(
    () => getAllPlayerOverrides(careerId)
  );

  const [customPlayers, setCustomPlayers] = useState<SquadPlayer[]>(() => getCustomPlayers(careerId));
  const [hiddenPlayerIds, setHiddenPlayerIds] = useState<number[]>(() => getHiddenPlayerIds(careerId));
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addForm, setAddForm] = useState<AddPlayerForm>(DEFAULT_ADD_FORM);
  const [importFeedback, setImportFeedback] = useState<"success" | "error" | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [profilePlayer, setProfilePlayer] = useState<SquadPlayer | null>(null);
  const backfillDoneRef = useRef(false);

  const hiddenSet = useMemo(() => new Set(hiddenPlayerIds), [hiddenPlayerIds]);

  useEffect(() => {
    onCustomPlayersChange?.(customPlayers);
  }, [customPlayers, onCustomPlayersChange]);

  useEffect(() => {
    if (!teamId || isDemo) return;
    // Natural gate: skip if all active players already have nationality stored.
    // Once the backfill succeeds, overrides persist to localStorage/DB so this
    // becomes false on the next mount — no permanent "done" flag needed.
    const needsBackfill = allPlayers.some(p => !overrides[p.id]?.nationality);
    if (!needsBackfill) return;
    // In-memory guard prevents duplicate in-flight calls within the same session.
    if (backfillDoneRef.current) return;
    backfillDoneRef.current = true;
    const playerIdSet = new Set(allPlayers.map(p => p.id));
    const season = String(backfillSeasonYear ?? new Date().getFullYear());
    const token = getEffectiveToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/players/team-details?teamId=${teamId}&season=${season}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then((data: { players: Array<{ playerId: number; nationality: string; height: string; weight: string }> } | null) => {
        if (!data?.players?.length) {
          // Non-OK or empty response: reset ref so the next mount can retry.
          backfillDoneRef.current = false;
          return;
        }
        for (const info of data.players) {
          if (!playerIdSet.has(info.playerId)) continue;
          if (!info.nationality && !info.height && !info.weight) continue;
          setPlayerOverride(careerId, info.playerId, {
            ...(info.nationality ? { nationality: info.nationality } : {}),
            ...(info.height     ? { height: info.height }           : {}),
            ...(info.weight     ? { weight: info.weight }           : {}),
          });
        }
        setOverrides(getAllPlayerOverrides(careerId));
        onOverridesUpdated?.();
      })
      .catch(() => { backfillDoneRef.current = false; });
  }, [allPlayers, customPlayers, teamId, isDemo, careerId, overrides, onOverridesUpdated, backfillSeasonYear]);

  type ExitEntry = { player: SquadPlayer; reason: string; date: number };
  const exitsList = useMemo<ExitEntry[]>(() => {
    const list: ExitEntry[] = [];
    const seenIds = new Set<number>();

    for (const t of (transfers ?? [])) {
      if (t.type === "venda") {
        seenIds.add(t.playerId);
        list.push({
          player: { id: t.playerId, name: t.playerName, age: t.playerAge, position: PT_BR_TO_POSITION[t.playerPositionPtBr] ?? "Midfielder", positionPtBr: t.playerPositionPtBr, photo: t.playerPhoto ?? "", number: t.shirtNumber },
          reason: "Vendido",
          date: t.transferredAt,
        });
      } else if (t.type === "emprestimo" && t.loanDirection === "saida" && !t.loanEnded) {
        seenIds.add(t.playerId);
        list.push({
          player: { id: t.playerId, name: t.playerName, age: t.playerAge, position: PT_BR_TO_POSITION[t.playerPositionPtBr] ?? "Midfielder", positionPtBr: t.playerPositionPtBr, photo: t.playerPhoto ?? "", number: t.shirtNumber },
          reason: "Emprestado",
          date: t.transferredAt,
        });
      }
    }

    if (seasonId) {
      const exitSeasonMap = getExitSeasonMap(careerId);
      for (const p of (formerPlayers ?? [])) {
        if (seenIds.has(p.id)) continue;
        const exitSeason = exitSeasonMap[String(p.id)];
        if (exitSeason !== seasonId) continue;
        if (hiddenSet.has(p.id)) {
          seenIds.add(p.id);
          list.push({ player: p, reason: "Removido do elenco", date: 0 });
        } else if (p.id < 0) {
          const stillActive = customPlayers.some((cp) => cp.id === p.id);
          if (!stillActive) {
            seenIds.add(p.id);
            list.push({ player: p, reason: "Removido do elenco", date: 0 });
          }
        }
      }
    }

    return list.sort((a, b) => b.date - a.date);
  }, [transfers, formerPlayers, hiddenSet, customPlayers, seasonId, careerId]);

  const loanedOutOrSoldIds = useMemo(() => new Set(
    (transfers ?? [])
      .filter((t) => !t.windowPending && (
        t.type === "venda" ||
        (t.type === "emprestimo" && t.loanDirection === "saida" && !t.loanEnded)
      ))
      .map((t) => t.playerId)
  ), [transfers]);

  const mergedPlayers = useMemo<SquadPlayer[]>(() => {
    const seenIds = new Set<number>();
    return [...allPlayers, ...customPlayers].filter((p) => {
      if (hiddenSet.has(p.id) || seenIds.has(p.id) || loanedOutOrSoldIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });
  }, [allPlayers, customPlayers, hiddenSet, loanedOutOrSoldIds]);

  const handleRemovePlayer = (player: SquadPlayer) => {
    const ovr = overrides[player.id];
    const posOvr = ovr?.positionOverride ? migratePositionOverride(ovr.positionOverride) : undefined;
    const resolvedPlayer: SquadPlayer = {
      ...player,
      name: ovr?.nameOverride ?? player.name,
      number: ovr?.shirtNumber ?? player.number,
      ...(posOvr ? { positionPtBr: posOvr, position: PT_BR_TO_POSITION[posOvr] ?? player.position } : {}),
    };
    addFormerPlayer(careerId, resolvedPlayer);
    if (seasonId) saveExitSeasonId(careerId, player.id, seasonId);

    if (player.id < 0) {
      removeCustomPlayer(careerId, player.id);
      setCustomPlayers((prev) => prev.filter((p) => p.id !== player.id));
    } else {
      addHiddenPlayerId(careerId, player.id);
      setHiddenPlayerIds((prev) => [...prev, player.id]);
    }
    setDetailPlayer(null);
    onPlayerRemoved?.();
  };

  const setAddField = <K extends keyof AddPlayerForm>(field: K, value: AddPlayerForm[K]) =>
    setAddForm((f) => ({ ...f, [field]: value }));

  const addFormValid = addForm.name.trim().length >= 2 && addForm.age.trim() !== "" && parseInt(addForm.age, 10) > 0;

  const handleAddPlayer = () => {
    if (!addFormValid) return;
    const ovrVal = parseInt(addForm.overall, 10);
    const player: SquadPlayer = {
      id: generateCustomPlayerId(),
      name: addForm.name.trim(),
      age: parseInt(addForm.age, 10),
      positionPtBr: addForm.position,
      position: PT_BR_TO_POSITION[addForm.position] as PositionGroup,
      photo: addForm.photo.trim(),
      number: undefined,
    };
    addCustomPlayer(careerId, player);
    const next = [...customPlayers, player];
    setCustomPlayers(next);
    if (ovrVal > 0 && !isNaN(ovrVal)) {
      import("@/lib/playerStatsStorage").then(({ setPlayerOverride }) => {
        setPlayerOverride(careerId, player.id, { overall: Math.max(1, Math.min(99, ovrVal)) });
      });
    }
    setAddForm(DEFAULT_ADD_FORM);
    setShowAddPlayer(false);
    onOverridesUpdated?.();
  };

  const [customLineup, setCustomLineupState] = useState<number[] | null>(
    () => getCustomLineup(careerId)
  );

  const [benchOrderState, setBenchOrderState] = useState<number[] | null>(
    () => getBenchOrder(careerId)
  );

  const [formation, setFormationState] = useState<FormationKey>(
    () => getFormation(careerId) ?? DEFAULT_FORMATION
  );
  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const formationPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFormationPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (formationPickerRef.current && !formationPickerRef.current.contains(e.target as Node)) {
        setShowFormationPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFormationPicker]);

  const handleFormationChange = useCallback((key: FormationKey) => {
    setFormationState(key);
    setFormation(careerId, key);
    setShowFormationPicker(false);
  }, [careerId]);

  const refreshOverrides = useCallback(() => {
    setOverrides(getAllPlayerOverrides(careerId));
    onOverridesUpdated?.();
  }, [careerId, onOverridesUpdated]);

  // Apply trained-position overrides BEFORE picking the best eleven so a player
  // that was retrained (e.g. CDM → CB) is placed in the trained sector, not the
  // original one. Without this, auto-fill ignores the user's training.
  const playersWithOverrides = useMemo(
    () => applyOverridesToPlayers(mergedPlayers, overrides),
    [mergedPlayers, overrides],
  );
  const defaultStarterIds = playersWithOverrides.length > 0
    ? pickBestEleven(playersWithOverrides, formation)
    : [];
  const starterIds: number[] = customLineup ?? defaultStarterIds;
  // 0 is used as a "reserved empty slot" placeholder — filter it out for the player lists
  const starterSet = new Set(starterIds.filter((id) => id > 0));
  const starters = starterIds
    .map((id) => (id > 0 ? playersWithOverrides.find((p) => p.id === id) : null))
    .filter((p): p is SquadPlayer => p != null);

  const rawBench = playersWithOverrides.filter((p) => !starterSet.has(p.id));
  const bench: SquadPlayer[] = useMemo(() => {
    if (!benchOrderState) return rawBench;
    const benchMap = new Map(rawBench.map((p) => [p.id, p]));
    const ordered = benchOrderState
      .filter((id) => benchMap.has(id))
      .map((id) => benchMap.get(id)!);
    const known = new Set(benchOrderState);
    const extras = rawBench.filter((p) => !known.has(p.id));
    return [...ordered, ...extras];
  }, [rawBench, benchOrderState]);

  const isCustom = customLineup !== null || benchOrderState !== null;

  const squadAvgOvr = useMemo(() => {
    const ovrs = mergedPlayers
      .map((p) => overrides[p.id]?.overall)
      .filter((o): o is number => o != null && o > 0);
    if (ovrs.length === 0) return null;
    return Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length);
  }, [mergedPlayers, overrides]);

  const handleResetLineup = useCallback(() => {
    clearCustomLineup(careerId);
    clearBenchOrder(careerId);
    setCustomLineupState(null);
    setBenchOrderState(null);
  }, [careerId]);

  const swapPlayers = useCallback((idA: number, idB: number) => {
    const aIsStarter = starterIds.includes(idA);
    const bIsStarter = starterIds.includes(idB);
    const nextStarters = [...starterIds];
    const nextBench = bench.map((p) => p.id);

    if (aIsStarter && bIsStarter) {
      const si = nextStarters.indexOf(idA);
      const di = nextStarters.indexOf(idB);
      if (si !== -1 && di !== -1) { [nextStarters[si], nextStarters[di]] = [nextStarters[di], nextStarters[si]]; }
      setCustomLineupState(nextStarters);
      setCustomLineup(careerId, nextStarters);
    } else if (aIsStarter && !bIsStarter) {
      const si = nextStarters.indexOf(idA);
      if (si !== -1) { nextStarters[si] = idB; }
      const bi = nextBench.indexOf(idB);
      if (bi !== -1) { nextBench[bi] = idA; }
      setCustomLineupState(nextStarters);
      setCustomLineup(careerId, nextStarters);
      setBenchOrderState(nextBench);
      setBenchOrder(careerId, nextBench);
    } else if (!aIsStarter && bIsStarter) {
      const si = nextStarters.indexOf(idB);
      if (si !== -1) { nextStarters[si] = idA; }
      const bi = nextBench.indexOf(idA);
      if (bi !== -1) { nextBench[bi] = idB; }
      setCustomLineupState(nextStarters);
      setCustomLineup(careerId, nextStarters);
      setBenchOrderState(nextBench);
      setBenchOrder(careerId, nextBench);
    } else {
      const ai = nextBench.indexOf(idA);
      const bi = nextBench.indexOf(idB);
      if (ai !== -1 && bi !== -1) { [nextBench[ai], nextBench[bi]] = [nextBench[bi], nextBench[ai]]; }
      setBenchOrderState(nextBench);
      setBenchOrder(careerId, nextBench);
    }
  }, [careerId, starterIds, bench]);

  const fillSlot = useCallback((slotIndex: number, playerId: number) => {
    // Build a full 11-slot array; 0 = empty position
    const lineup: number[] = Array(11).fill(0);
    for (let i = 0; i < Math.min(starterIds.length, 11); i++) {
      lineup[i] = starterIds[i] ?? 0;
    }
    // Remove player from its current slot if already a starter
    const existing = lineup.indexOf(playerId);
    if (existing !== -1) lineup[existing] = 0;
    lineup[slotIndex] = playerId;
    setCustomLineupState(lineup);
    setCustomLineup(careerId, lineup);
    setPendingSlot(null);
  }, [careerId, starterIds]);

  const handlePlayerClick = useCallback((player: SquadPlayer) => {
    if (isFinalized) {
      setDetailPlayer(player);
      return;
    }
    // Fill an empty slot if one is pending
    if (pendingSlot !== null) {
      fillSlot(pendingSlot, player.id);
      return;
    }
    if (pendingSwap === null) {
      setPendingSwap(player);
    } else if (pendingSwap.id === player.id) {
      setDetailPlayer(player);
      setPendingSwap(null);
    } else {
      swapPlayers(pendingSwap.id, player.id);
      setPendingSwap(null);
    }
  }, [isFinalized, pendingSlot, fillSlot, pendingSwap, swapPlayers]);

  const sourceLabel = squad
    ? squad.source === "api-football"
      ? `API-Football · ${formatDate(squad.cachedAt)}`
      : `EA FC 26 · ${formatDate(squad.cachedAt)}`
    : "";

  const handleExportSquad = useCallback(() => {
    const data = JSON.stringify({ version: 1, players: mergedPlayers }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elenco-${careerId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mergedPlayers, careerId]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportSquad) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as { version?: number; players?: SquadPlayer[] };
        const players = parsed?.players;
        if (!Array.isArray(players) || players.length === 0) throw new Error("invalid");
        onImportSquad(players);
        setImportFeedback("success");
      } catch {
        setImportFeedback("error");
      } finally {
        setTimeout(() => setImportFeedback(null), 3000);
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }, [onImportSquad]);

  return (
    <div className="animate-fade-up w-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">{t.squadHeading}</h2>
          <SectionHelp section="elenco" />
          {squad && !squadLoading && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background:
                  squad.source === "api-football"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(var(--club-primary-rgb),0.12)",
                color:
                  squad.source === "api-football"
                    ? "#34d399"
                    : "var(--club-primary)",
              }}
            >
              {sourceLabel}
            </span>
          )}
          {mergedPlayers.length > 0 && !squadLoading && (
            <span className="text-white/25 text-xs">{mergedPlayers.length} {t.playersCount}</span>
          )}
          {squadAvgOvr != null && !squadLoading && (
            <span
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "rgba(255,255,255,0.30)" }}
              title={t.avgLabel}
            >
              {t.avgLabel} <OvrBadge ovr={squadAvgOvr} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
          {/* Hidden file input for import */}
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          {/* Export button */}
          {!isDemo && mergedPlayers.length > 0 && !squadLoading && (
            <button
              onClick={handleExportSquad}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
              title={t.exportLabel}
              aria-label={t.exportLabel}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">{t.exportLabel}</span>
            </button>
          )}
          {/* Import button */}
          {!isDemo && onImportSquad && (
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
              aria-label={t.importLabel}
              style={{
                background: importFeedback === "success"
                  ? "rgba(16,185,129,0.15)"
                  : importFeedback === "error"
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: importFeedback === "success"
                  ? "#34d399"
                  : importFeedback === "error"
                  ? "#f87171"
                  : "rgba(255,255,255,0.55)",
                border: importFeedback === "success"
                  ? "1px solid rgba(16,185,129,0.3)"
                  : importFeedback === "error"
                  ? "1px solid rgba(239,68,68,0.3)"
                  : "1px solid rgba(255,255,255,0.1)",
              }}
              title={t.importLabel}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span className="hidden sm:inline">{importFeedback === "success" ? t.importSuccess : importFeedback === "error" ? t.importError : t.importLabel}</span>
            </button>
          )}
          {!isDemo && <button
            onClick={() => setShowAddPlayer(true)}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
            title={t.addManualPlayer}
            aria-label={t.addManualPlayer}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t.addPlayerLabel}</span>
          </button>}
          {mergedPlayers.length > 0 && !squadLoading && (
            <>
              {isCustom && (
                <button
                  onClick={handleResetLineup}
                  className="flex items-center gap-1 text-xs font-medium transition-colors duration-200"
                  style={{ color: "rgba(248,113,113,0.8)" }}
                  title={t.resetLabel}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">{t.resetLabel}</span>
                </button>
              )}
              <div className="flex rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                {(["pitch", "list", "exits"] as SquadTab[]).map((tabKey) => (
                  <button
                    key={tabKey}
                    onClick={() => setTab(tabKey)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5"
                    style={{
                      background: tab === tabKey ? (tabKey === "exits" ? "rgba(248,113,113,0.12)" : "rgba(var(--club-primary-rgb),0.15)") : "transparent",
                      color: tab === tabKey ? (tabKey === "exits" ? "#f87171" : "var(--club-primary)") : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {tabKey === "pitch" ? t.tabField : tabKey === "list" ? t.tabList : t.tabExits}
                    {tabKey === "exits" && exitsList.length > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: tab === "exits" ? "rgba(248,113,113,0.2)" : "rgba(248,113,113,0.15)", color: "#f87171" }}
                      >
                        {exitsList.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={squadLoading}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors duration-200 disabled:opacity-30"
          >
            <svg
              className={`w-3.5 h-3.5 ${squadLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs">{t.refreshLabel}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {squadLoading ? (
        <div className="px-4 sm:px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0d2218", minHeight: 300 }}>
              <div className="flex items-center justify-center h-72">
                <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "transparent" }} />
              </div>
            </div>
            <SquadSkeleton />
          </div>
        </div>
      ) : squadError ? (
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl gap-3 glass w-full">
            <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-white/30 text-sm">{t.squadError}</p>
            <button
              onClick={onRefresh}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ background: "var(--club-gradient)" }}
            >
              {t.retryLabel}
            </button>
          </div>
        </div>
      ) : mergedPlayers.length === 0 && !(isFinalized && finalizedPlayers && finalizedPlayers.length > 0) ? (
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl gap-4 glass w-full">
            {isCustomClub ? (
              <>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1.5px dashed rgba(var(--club-primary-rgb),0.3)" }}
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--club-primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-xs">
                  <p className="text-white/70 text-sm font-semibold">{t.customClubEmptySquad ?? "Nenhum jogador cadastrado ainda"}</p>
                  <p className="text-white/30 text-xs leading-relaxed">{t.customClubEmptySquadDesc ?? "Este clube foi criado do zero — adicione os jogadores manualmente"}</p>
                </div>
                {!isDemo && (
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "var(--club-gradient)" }}
                >
                  {t.addPlayerLabel ?? t.addManualPlayer}
                </button>
                )}
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-white/30 text-sm text-center leading-relaxed">
                  {t.noPlayers}
                </p>
                {!isDemo && (
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "var(--club-gradient)" }}
                >
                  {t.addManualPlayer}
                </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : isFinalized && finalizedPlayers && finalizedPlayers.length > 0 ? (
        tab === "exits" ? (
          <div className="px-4 sm:px-6 pb-6">
            {exitsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <p className="text-white/25 text-sm font-medium">{t.noExits}</p>
                <p className="text-white/15 text-xs text-center max-w-xs">{t.exitsSubtext}</p>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-3">{t.exitsSection} ({exitsList.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {exitsList.map(({ player, reason }) => {
                    const badgeColors: Record<string, { bg: string; text: string; icon: string }> = {
                      "Vendido":           { bg: "rgba(34,197,94,0.15)",   text: "#4ade80", icon: "€" },
                      "Emprestado":        { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", icon: "↑" },
                      "Removido do elenco":{ bg: "rgba(248,113,113,0.15)", text: "#f87171", icon: "✕" },
                    };
                    const badge = badgeColors[reason] ?? { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.4)", icon: "–" };
                    const reasonLabel = reason === "Vendido" ? t.reasonSold : reason === "Emprestado" ? t.reasonLoaned : t.reasonRemoved;
                    return (
                      <div key={`exit-fin-${player.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: 0.72 }} onClick={() => setDetailPlayer(player)}>
                        {player.photo ? (
                          <img src={player.photo} alt={player.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ filter: "grayscale(40%)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white/20 text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)" }}>{player.name.charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-sm font-semibold truncate leading-tight">{player.name}</p>
                          <p className="text-white/30 text-xs truncate">{player.positionPtBr ?? player.position}{player.age ? ` · ${player.age} ${t.ageYears}` : ""}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: badge.bg, color: badge.text }}>{badge.icon} {reasonLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (() => {
          const stats = finalizedSeasonStats ?? {};
          const finalizedWithOverrides = applyOverridesToPlayers(finalizedPlayers, overrides);
          const finalStarters = finalizedWithOverrides.filter(p => (stats[p.id]?.matchesAsStarter ?? 0) > 0);
          const finalNonStarters = finalizedWithOverrides.filter(p => (stats[p.id]?.matchesAsStarter ?? 0) === 0);
          const finalStarterIds = pickBestEleven(finalStarters, formation);
          const finalStarterIdsSet = new Set(finalStarterIds);
          const finalStartersNotInBestEleven = finalStarters.filter(p => !finalStarterIdsSet.has(p.id));
          const allOthers = [...finalStartersNotInBestEleven, ...finalNonStarters];
          return (
            <div className="px-4 sm:px-6 pb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-white/20 text-xs font-semibold tracking-widest uppercase">{t.finalizedSeason}</span>
                <span className="text-white/15 text-xs">{t.playedThisSeason}</span>
                {finalizedLeftIds && finalizedLeftIds.size > 0 && (
                  <span className="text-white/15 text-xs">· <span style={{ color: "rgba(255,255,255,0.3)" }}>{finalizedLeftIds.size} {t.leftClub}</span></span>
                )}
              </div>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="w-full lg:w-[420px] flex-shrink-0">
                  <FootballPitch
                    players={finalizedPlayers}
                    starterIds={finalStarterIds}
                    className="w-full"
                    onPlayerClick={handlePlayerClick}
                    formation={formation}
                    dimmedPlayerIds={finalizedLeftIds}
                  />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  {allOthers.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">
                        {t.othersWhoPlayed} ({allOthers.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {allOthers.map(player => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            overrides={overrides}
                            onClick={handlePlayerClick}
                            dimmed={finalizedLeftIds?.has(player.id)}
                            ageYears={t.ageYears}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {allOthers.length === 0 && (
                    <p className="text-white/20 text-xs text-center py-4">{t.allWereStarters}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      ) : tab === "pitch" ? (
        <div className="px-4 sm:px-6 pb-8">
          {/* Header row: titulares count + swap hint */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-white/25 text-xs font-semibold tracking-widest uppercase">
              {t.startersLabel} ({starters.length})
            </p>
            {pendingSlot !== null ? (
              <div className="flex items-center gap-2">
                <p className="text-xs" style={{ color: "var(--club-primary)" }}>
                  {t.clickFillSlot}
                </p>
                <button
                  onClick={() => setPendingSlot(null)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  title={t.cancel}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : pendingSwap ? (
              <div className="flex items-center gap-2">
                <p className="text-xs" style={{ color: "var(--club-primary)" }}>
                  {(() => { const ov = overrides[pendingSwap.id]; return ov?.nameOverride ?? pendingSwap.name; })()}
                  {" "}{t.chooseTarget}
                </p>
                <button
                  onClick={() => setPendingSwap(null)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  title={t.cancelSelection}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-white/20 text-xs">
                {isCustom ? t.customized : ""}{t.clickSelect}
              </p>
            )}
          </div>

          {/* Formation selector */}
          <div ref={formationPickerRef} className="relative mb-3">
            <button
              onClick={() => setShowFormationPicker((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 w-full lg:w-auto lg:min-w-[160px]"
              style={{
                background: showFormationPicker ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.05)",
                color: showFormationPicker ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
                border: `1px solid ${showFormationPicker ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span className="flex-1 text-left">{getFormationLabel(formation)}</span>
              <svg
                className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${showFormationPicker ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFormationPicker && (
              <div
                className="absolute left-0 mt-1 rounded-xl overflow-hidden shadow-2xl z-20 w-full lg:w-[220px]"
                style={{ background: "#141024", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="max-h-72 overflow-y-auto overflow-x-hidden">
                  {FORMATION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div
                        className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
                        style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)" }}
                      >
                        {group.label}
                      </div>
                      {group.formations.map((f) => {
                        const isActive = f.key === formation;
                        return (
                          <button
                            key={f.key}
                            onClick={() => handleFormationChange(f.key)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors duration-150"
                            style={{
                              background: isActive ? "rgba(var(--club-primary-rgb),0.12)" : "transparent",
                              color: isActive ? "var(--club-primary)" : "rgba(255,255,255,0.6)",
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            }}
                          >
                            <span className="font-medium">{f.label}</span>
                            {isActive && (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main layout: pitch + bench side by side on desktop */}
          <div className="flex flex-col lg:flex-row gap-6 items-start overflow-x-auto">
            {/* Left: pitch */}
            <div className="w-full lg:w-[420px] flex-shrink-0 min-w-0">
              <FootballPitch
                players={mergedPlayers}
                starterIds={starterIds}
                className="w-full"
                onPlayerClick={handlePlayerClick}
                highlightedPlayerId={pendingSwap?.id}
                formation={formation}
                onEmptySlotClick={(i) => { setPendingSwap(null); setPendingSlot(i); }}
                pendingSlotIndex={pendingSlot}
              />
            </div>

            {/* Right: bench */}
            <div className="flex-1 min-w-0 w-full">
              {bench.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-4">
                  {t.allStartersText}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 items-start">
                  <div className="flex flex-col gap-1">
                    <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-1">
                      {t.relatedLabel} ({Math.min(bench.length, 9)})
                    </p>
                    {bench.slice(0, 9).map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        overrides={overrides}
                        selected={pendingSwap?.id === player.id}
                        onClick={handlePlayerClick}
                        ageYears={t.ageYears}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-1">
                      {t.notRelatedLabel} ({Math.max(0, bench.length - 9)})
                    </p>
                    {bench.slice(9).length === 0 ? (
                      <p className="text-white/15 text-xs text-center py-4">—</p>
                    ) : (
                      bench.slice(9).map((player) => (
                        <PlayerRow
                          key={player.id}
                          player={player}
                          overrides={overrides}
                          selected={pendingSwap?.id === player.id}
                          onClick={handlePlayerClick}
                          ageYears={t.ageYears}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === "exits" ? (
        <div className="px-4 sm:px-6 pb-6">
          {exitsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <p className="text-white/25 text-sm font-medium">{t.noExits}</p>
              <p className="text-white/15 text-xs text-center max-w-xs">{t.exitsSubtext}</p>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-3">
                {t.exitsSection} ({exitsList.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {exitsList.map(({ player, reason }) => {
                  const badgeColors: Record<string, { bg: string; text: string; icon: string }> = {
                    "Vendido":           { bg: "rgba(34,197,94,0.15)",   text: "#4ade80", icon: "€" },
                    "Emprestado":        { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", icon: "↑" },
                    "Removido do elenco":{ bg: "rgba(248,113,113,0.15)", text: "#f87171", icon: "✕" },
                  };
                  const badge = badgeColors[reason] ?? { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.4)", icon: "–" };
                  const reasonLabel = reason === "Vendido" ? t.reasonSold : reason === "Emprestado" ? t.reasonLoaned : t.reasonRemoved;
                  return (
                    <div
                      key={`exit-${player.id}`}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        opacity: 0.72,
                      }}
                      onClick={() => setDetailPlayer(player)}
                    >
                      {player.photo ? (
                        <img
                          src={player.photo}
                          alt={player.name}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                          style={{ filter: "grayscale(40%)" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white/20 text-sm font-bold"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white/60 text-sm font-semibold truncate leading-tight">{player.name}</p>
                        <p className="text-white/30 text-xs truncate">
                          {player.positionPtBr ?? player.position}
                          {player.age ? ` · ${player.age} ${t.ageYears}` : ""}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {badge.icon} {reasonLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex flex-col gap-2">
            <div className="mb-1">
              <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">
                {t.startersLabel} ({starters.length}) · <span className="normal-case font-normal text-white/20">{t.clickSelect}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {starters.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    overrides={overrides}
                    selected={pendingSwap?.id === player.id}
                    onClick={handlePlayerClick}
                    ageYears={t.ageYears}
                  />
                ))}
              </div>
            </div>
            {bench.length > 0 && (
              <div className="mt-2">
                <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">
                  {t.reservas} ({bench.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {bench.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      overrides={overrides}
                      selected={pendingSwap?.id === player.id}
                      onClick={handlePlayerClick}
                      ageYears={t.ageYears}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {detailPlayer && createPortal(
        <PlayerDetailPanel
          player={detailPlayer}
          careerId={careerId}
          seasonId={seasonId}
          override={overrides[detailPlayer.id]}
          onClose={() => setDetailPlayer(null)}
          onUpdated={refreshOverrides}
          onRemove={!isDemo ? () => handleRemovePlayer(detailPlayer) : undefined}
          onOpenProfile={() => { setProfilePlayer(detailPlayer); setDetailPlayer(null); }}
          isDemo={isDemo}
        />,
        document.body
      )}

      {profilePlayer && createPortal(
        <PlayerProfileModal
          player={profilePlayer}
          careerId={careerId}
          seasonId={seasonId}
          override={overrides[profilePlayer.id]}
          onClose={() => setProfilePlayer(null)}
          onUpdated={refreshOverrides}
        />,
        document.body
      )}

      {showAddPlayer && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => { setShowAddPlayer(false); setAddForm(DEFAULT_ADD_FORM); }}
          />
          <div
            className="relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
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
                <h3 className="text-white font-black text-lg">{t.addPlayerTitle}</h3>
                <p className="text-white/35 text-xs mt-0.5">{t.addPlayerSub}</p>
              </div>
              <button
                onClick={() => { setShowAddPlayer(false); setAddForm(DEFAULT_ADD_FORM); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex flex-col gap-5">
              <div>
                <label className="text-white/40 text-xs font-medium mb-1 block">{t.nameLabel}</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
                  value={addForm.name}
                  onChange={(e) => setAddField("name", e.target.value)}
                  placeholder="Ex: João Silva"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/40 text-xs font-medium mb-1 block">{t.positionLabel}</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass cursor-pointer"
                    style={{ appearance: "none" }}
                    value={addForm.position}
                    onChange={(e) => setAddField("position", e.target.value as PositionPtBr)}
                  >
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p} style={{ background: "#1a1030" }}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-xs font-medium mb-1 block">{t.ageLabel}</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
                    value={addForm.age}
                    onChange={(e) => setAddField("age", e.target.value)}
                    placeholder="Ex: 19"
                    min={14}
                    max={50}
                  />
                </div>

                <div>
                  <label className="text-white/40 text-xs font-medium mb-1 block">{t.overallLabel}</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
                    value={addForm.overall}
                    onChange={(e) => setAddField("overall", e.target.value)}
                    placeholder="Ex: 72"
                    min={1}
                    max={99}
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs font-medium mb-1 block">{t.nationalityLabel}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
                    value={addForm.nationality}
                    onChange={(e) => setAddField("nationality", e.target.value)}
                    placeholder="Ex: Brasileiro"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-white/40 text-xs font-medium mb-1 block">{t.photoLabel}</label>
                  <input
                    type="url"
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass placeholder:text-white/20"
                    value={addForm.photo}
                    onChange={(e) => setAddField("photo", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div
              className="flex gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: "1px solid var(--surface-border)" }}
            >
              <button
                onClick={() => { setShowAddPlayer(false); setAddForm(DEFAULT_ADD_FORM); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 glass glass-hover transition-all"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={!addFormValid}
                className="py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ flex: 2, background: "var(--club-gradient)" }}
              >
                {t.addToSquad}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
