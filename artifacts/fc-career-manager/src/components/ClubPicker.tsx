import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, LeagueInfo } from "@/lib/footballApiMap";
import { getClubsByLeague, searchClubs } from "@/lib/clubListCache";
import { applyTheme, resetTheme, extractColorsFromImage, getCurrentColors } from "@/lib/themeManager";

interface ClubPickerProps {
  allClubs: ClubEntry[];
  onSelectClub: (entry: ClubEntry, league: LeagueInfo | null) => void;
  initialLeague?: LeagueInfo | null;
}

function LeagueLogo({ logoUrl, size = 28 }: { logoUrl: string; size?: number }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden"
      style={{ width: size + 6, height: size + 6, background: "rgba(255,255,255,0.06)" }}
    >
      {!err ? (
        <img
          src={logoUrl}
          alt=""
          className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width: size, height: size }}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : null}
    </div>
  );
}

function ClubLogo({ logo, name, size = 40 }: { logo: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.06)" }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width: size - 8, height: size - 8 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-white/40 font-black text-[10px]">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function LeagueCard({ league, count, onClick, index }: { league: LeagueInfo; count: number; onClick: () => void; index: number }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all duration-200 animate-slide-up glass glass-hover"
      style={{
        animationDelay: `${Math.min(index * 20, 300)}ms`,
        animationFillMode: "both",
      }}
    >
      <LeagueLogo logoUrl={league.logo} size={24} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">
          {league.displayName ?? league.name}
        </p>
      </div>
      {count > 0 && (
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums"
          style={{ background: "rgba(var(--club-primary-rgb),0.1)", color: "var(--club-primary)" }}
        >
          {count}
        </span>
      )}
      <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function CompactClubCard({ entry, onClick, index }: { entry: ClubEntry; onClick: () => void; index: number }) {
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevColors = useRef<ReturnType<typeof getCurrentColors> | null>(null);
  const isSelected = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.background = "var(--surface-hover)";
    el.style.borderColor = "rgba(var(--club-primary-rgb),0.3)";
    el.style.transform = "translateY(-1px)";
    el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";

    if (!entry.logo) return;
    prevColors.current = getCurrentColors();
    hoverTimer.current = setTimeout(async () => {
      try {
        const colors = await extractColorsFromImage(entry.logo);
        if (isMounted.current && !isSelected.current) {
          applyTheme(colors);
        }
      } catch {}
    }, 150);
  }, [entry.logo]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.background = "";
    el.style.borderColor = "";
    el.style.transform = "translateY(0)";
    el.style.boxShadow = "none";

    clearTimeout(hoverTimer.current);
    if (isSelected.current) return;
    if (prevColors.current) {
      applyTheme(prevColors.current);
      prevColors.current = null;
    } else {
      resetTheme();
    }
  }, []);

  const handleClick = useCallback(() => {
    isSelected.current = true;
    clearTimeout(hoverTimer.current);
    onClick();
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-left w-full transition-all duration-200 animate-slide-up glass"
      style={{
        animationDelay: `${Math.min(index * 15, 250)}ms`,
        animationFillMode: "both",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ClubLogo logo={entry.logo} name={entry.name} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">{entry.name}</p>
        <p className="text-white/30 text-xs mt-0.5 truncate">{entry.league}</p>
      </div>
      <svg className="w-3.5 h-3.5 text-white/15 group-hover:text-white/50 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

type Tab = "domestic" | "international";

export function ClubPicker({ allClubs, onSelectClub, initialLeague }: ClubPickerProps) {
  const [tab, setTab] = useState<Tab>(initialLeague?.type === "international" ? "international" : "domestic");
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(initialLeague ?? null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const countByLeague = useMemo(() => {
    const map = new Map<number, number>();
    for (const club of allClubs) {
      map.set(club.leagueId, (map.get(club.leagueId) ?? 0) + 1);
    }
    return map;
  }, [allClubs]);

  const domesticLeagues = DOMESTIC_LEAGUES.map((l) => ({ league: l, count: countByLeague.get(l.id) ?? 0 }));
  const internationalLeagues = INTERNATIONAL_LEAGUES.map((l) => ({ league: l, count: countByLeague.get(l.id) ?? 0 }));

  const clubsInLeague = useMemo(() => {
    if (!selectedLeague) return [];
    const base = getClubsByLeague(selectedLeague.id, allClubs);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [selectedLeague, allClubs, search]);

  const globalSearchResults = useMemo(() => {
    if (!search.trim() || selectedLeague) return [];
    return searchClubs(search, allClubs).slice(0, 80);
  }, [search, allClubs, selectedLeague]);

  const handleBack = useCallback(() => {
    setSelectedLeague(null);
    setSearch("");
  }, []);

  const isSearching = search.trim().length > 0;

  return (
    <div className="flex flex-col h-full animate-fade-up">
      <div className="text-center mb-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: "var(--club-primary)" }}>
          Etapa 2 de 4
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
          {selectedLeague
            ? (selectedLeague.displayName ?? selectedLeague.name)
            : "Escolha seu clube"}
        </h2>
        <p className="text-white/40 text-sm">
          {selectedLeague ? selectedLeague.country : "Pesquise ou navegue pelas ligas"}
        </p>
      </div>

      <div className="relative mb-4">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={selectedLeague ? `Buscar em ${selectedLeague.displayName ?? selectedLeague.name}...` : "Buscar clube em todas as ligas..."}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl text-white placeholder-white/25 focus:outline-none transition-all duration-200 text-sm glass"
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(var(--club-primary-rgb),0.3)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {isSearching && !selectedLeague ? (
          <div>
            <p className="text-white/25 text-xs mb-2 tabular-nums">
              {globalSearchResults.length} {globalSearchResults.length === 1 ? "clube encontrado" : "clubes encontrados"}
            </p>
            {globalSearchResults.length === 0 ? (
              <EmptySearchState />
            ) : (
              <div className="flex flex-col gap-1">
                {globalSearchResults.map((entry, i) => (
                  <CompactClubCard key={entry.id} entry={entry} onClick={() => onSelectClub(entry, selectedLeague)} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : selectedLeague ? (
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-white/40 hover:text-white text-sm font-medium transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Ligas
              </button>
              <span className="text-white/15 text-xs">/</span>
              <span className="text-white/50 text-xs truncate">
                {selectedLeague.displayName ?? selectedLeague.name}
              </span>
              <span className="text-white/20 text-xs ml-auto tabular-nums">
                {clubsInLeague.length} clubes
              </span>
            </div>
            {clubsInLeague.length === 0 ? (
              <EmptySearchState />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {clubsInLeague.map((entry, i) => (
                  <CompactClubCard key={entry.id} entry={entry} onClick={() => onSelectClub(entry, selectedLeague)} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex rounded-lg p-0.5 mb-4" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["domestic", "international"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 rounded-md text-sm font-semibold transition-all duration-200"
                  style={{
                    background: tab === t ? "rgba(var(--club-primary-rgb),0.15)" : "transparent",
                    color: tab === t ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {t === "domestic" ? "Ligas Dom\u00e9sticas" : "Internacionais"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {(tab === "domestic" ? domesticLeagues : internationalLeagues).map(({ league, count }, i) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  count={count}
                  onClick={() => setSelectedLeague(league)}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptySearchState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p className="text-white/25 text-sm">Nenhum clube encontrado</p>
    </div>
  );
}
