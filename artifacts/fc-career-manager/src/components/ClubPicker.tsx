import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, LeagueInfo } from "@/lib/footballApiMap";
import { getClubsByLeague, searchClubs } from "@/lib/clubListCache";

interface ClubPickerProps {
  allClubs: ClubEntry[];
  onSelectClub: (entry: ClubEntry) => void;
}

function ClubLogo({ logo, name, size = 56 }: { logo: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="flex items-center justify-center rounded-xl flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.08)" }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width: size - 12, height: size - 12 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-white/40 font-black text-sm">
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
      className="group flex items-center gap-4 p-4 rounded-2xl text-left w-full transition-all duration-200 animate-slide-up"
      style={{
        animationDelay: `${Math.min(index * 25, 400)}ms`,
        animationFillMode: "both",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.08)";
        el.style.borderColor = "var(--club-primary, #6366f1)50";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.04)";
        el.style.borderColor = "rgba(255,255,255,0.07)";
        el.style.transform = "translateY(0)";
      }}
    >
      <span className="text-3xl flex-shrink-0">{league.flag}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight truncate">
          {league.displayName ?? league.name}
        </p>
        <p className="text-white/35 text-xs mt-0.5">{league.country}</p>
      </div>
      {count > 0 && (
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 tabular-nums"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}
        >
          {count}
        </span>
      )}
      <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function BigClubCard({ entry, onClick, index }: { entry: ClubEntry; onClick: () => void; index: number }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-2xl text-left w-full transition-all duration-200 animate-slide-up"
      style={{
        animationDelay: `${Math.min(index * 18, 350)}ms`,
        animationFillMode: "both",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.09)";
        el.style.borderColor = "var(--club-primary, #6366f1)60";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.04)";
        el.style.borderColor = "rgba(255,255,255,0.07)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      <ClubLogo logo={entry.logo} name={entry.name} size={56} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight truncate">{entry.name}</p>
        <p className="text-white/35 text-xs mt-0.5 truncate">{entry.league}</p>
        {entry.country && (
          <p className="text-white/20 text-xs mt-0.5">{entry.country}</p>
        )}
      </div>
      <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

type Tab = "domestic" | "international";

export function ClubPicker({ allClubs, onSelectClub }: ClubPickerProps) {
  const [tab, setTab] = useState<Tab>("domestic");
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="text-center mb-6">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "var(--club-primary, #6366f1)" }}
        >
          Etapa 2 de 3
        </p>
        <h2 className="text-3xl font-black text-white mb-2">
          {selectedLeague
            ? `${selectedLeague.flag} ${selectedLeague.displayName ?? selectedLeague.name}`
            : "Escolha seu clube"}
        </h2>
        <p className="text-white/40 text-sm">
          {selectedLeague
            ? selectedLeague.country
            : "Pesquise ou navegue pelas ligas"}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
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
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-white placeholder-white/25 focus:outline-none transition-all duration-200 text-sm"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--club-primary, #6366f1)60")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {/* Global search results */}
        {isSearching && !selectedLeague ? (
          <div>
            <p className="text-white/25 text-xs mb-3 tabular-nums">
              {globalSearchResults.length} {globalSearchResults.length === 1 ? "clube encontrado" : "clubes encontrados"}
            </p>
            {globalSearchResults.length === 0 ? (
              <EmptySearchState />
            ) : (
              <div className="flex flex-col gap-2">
                {globalSearchResults.map((entry, i) => (
                  <BigClubCard key={entry.id} entry={entry} onClick={() => onSelectClub(entry)} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : selectedLeague ? (
          /* Club list inside a league */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Ligas
              </button>
              <span className="text-white/15 text-sm">/</span>
              <span className="text-white/50 text-sm truncate">
                {selectedLeague.displayName ?? selectedLeague.name}
              </span>
              <span className="text-white/20 text-xs ml-auto tabular-nums">
                {clubsInLeague.length} clubes
              </span>
            </div>
            {clubsInLeague.length === 0 ? (
              <EmptySearchState />
            ) : (
              <div className="flex flex-col gap-2">
                {clubsInLeague.map((entry, i) => (
                  <BigClubCard key={entry.id} entry={entry} onClick={() => onSelectClub(entry)} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* League grid */
          <div>
            {/* Tabs */}
            <div
              className="flex rounded-xl p-1 mb-5"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {(["domestic", "international"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: tab === t ? "rgba(255,255,255,0.12)" : "transparent",
                    color: tab === t ? "white" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {t === "domestic" ? "Ligas Domésticas" : "Competições Internacionais"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
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
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <svg className="w-10 h-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p className="text-white/25 text-sm">Nenhum clube encontrado</p>
    </div>
  );
}
