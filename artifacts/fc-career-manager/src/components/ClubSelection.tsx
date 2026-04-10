import { useState, useMemo, useCallback } from "react";
import { ClubEntry } from "@/types/club";
import { ClubCard } from "./ClubCard";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, LeagueInfo } from "@/lib/footballApiMap";
import { getClubsByLeague, searchClubs } from "@/lib/clubListCache";

interface ClubSelectionProps {
  allClubs: ClubEntry[];
  onSelectClub: (entry: ClubEntry) => Promise<void>;
  selecting: boolean;
}

interface LeagueCardProps {
  league: LeagueInfo;
  count: number;
  onClick: () => void;
  index: number;
}

function LeagueCard({ league, count, onClick, index }: LeagueCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 p-4 rounded-2xl text-left w-full focus:outline-none focus:ring-2 focus:ring-[var(--club-primary)] focus:ring-offset-2 focus:ring-offset-black"
      style={{
        animationDelay: `${Math.min(index * 30, 500)}ms`,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "transform 200ms ease, border-color 200ms ease, background 200ms ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(-3px) scale(1.02)";
        el.style.borderColor = "var(--club-primary)70";
        el.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(0) scale(1)";
        el.style.borderColor = "rgba(255,255,255,0.08)";
        el.style.background = "rgba(255,255,255,0.04)";
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{league.flag}</span>
        {count > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: "var(--club-primary)18", color: "var(--club-primary)" }}
          >
            {count}
          </span>
        )}
      </div>
      <div>
        <p className="text-white font-semibold text-sm leading-tight line-clamp-2">
          {league.displayName ?? league.name}
        </p>
        <p className="text-white/35 text-xs mt-0.5">{league.country}</p>
      </div>
    </button>
  );
}

export function ClubSelection({ allClubs, onSelectClub, selecting }: ClubSelectionProps) {
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null);
  const [search, setSearch] = useState("");

  const countByLeague = useMemo(() => {
    const map = new Map<number, number>();
    for (const club of allClubs) {
      map.set(club.leagueId, (map.get(club.leagueId) ?? 0) + 1);
    }
    return map;
  }, [allClubs]);

  const clubsInLeague = useMemo(() => {
    if (!selectedLeague) return [];
    const base = getClubsByLeague(selectedLeague.id, allClubs);
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [selectedLeague, allClubs, search]);

  const globalSearch = useMemo(() => {
    if (!search.trim() || selectedLeague) return [];
    return searchClubs(search, allClubs).slice(0, 60);
  }, [search, allClubs, selectedLeague]);

  const handleSelectClub = useCallback(
    async (entry: ClubEntry) => {
      if (selecting) return;
      await onSelectClub(entry);
    },
    [selecting, onSelectClub]
  );

  const handleBack = useCallback(() => {
    setSelectedLeague(null);
    setSearch("");
  }, []);

  const domesticCounts = DOMESTIC_LEAGUES.map((l) => ({
    league: l,
    count: countByLeague.get(l.id) ?? 0,
  }));

  const internationalCounts = INTERNATIONAL_LEAGUES.map((l) => ({
    league: l,
    count: countByLeague.get(l.id) ?? 0,
  }));

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--app-bg, #0a0a0a)" }}>
      {/* Hero */}
      <div
        className="w-full py-14 px-4 text-center relative overflow-hidden"
        style={{ background: "var(--club-gradient)" }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
        <div className="relative z-10">
          {selectedLeague ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium mb-4 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar às ligas
            </button>
          ) : (
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--club-primary)" }}
            >
              EA FC 26 · Modo Carreira
            </p>
          )}
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            {selectedLeague
              ? selectedLeague.flag + " " + (selectedLeague.displayName ?? selectedLeague.name)
              : "Selecione seu clube"}
          </h1>
          <p className="text-white/50 text-base mt-3">
            {selectedLeague
              ? selectedLeague.country
              : "Escolha a liga e depois o time que vai gerir"}
          </p>
        </div>
      </div>

      {/* Search bar — only when inside a league or global searching */}
      <div
        className="sticky top-0 z-20 px-4 py-4"
        style={{
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={selectedLeague ? "Buscar clube nesta liga..." : "Buscar clube ou liga..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--club-primary)80")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          {selectedLeague && (
            <p className="mt-2 text-xs text-white/25">
              {clubsInLeague.length}{" "}
              {clubsInLeague.length === 1 ? "clube encontrado" : "clubes encontrados"}
            </p>
          )}
          {!selectedLeague && search.trim() && (
            <p className="mt-2 text-xs text-white/25">
              {globalSearch.length} {globalSearch.length === 1 ? "clube encontrado" : "clubes encontrados"} em todas as ligas
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Global search results */}
          {!selectedLeague && search.trim() ? (
            globalSearch.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {globalSearch.map((entry, i) => (
                  <div key={entry.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 400)}ms`, animationFillMode: "both" }}>
                    <ClubCard entry={entry} onClick={() => handleSelectClub(entry)} index={i} />
                  </div>
                ))}
              </div>
            )
          ) : selectedLeague ? (
            /* Club grid */
            clubsInLeague.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {clubsInLeague.map((entry, i) => (
                  <div key={entry.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 400)}ms`, animationFillMode: "both" }}>
                    <ClubCard entry={entry} onClick={() => handleSelectClub(entry)} index={i} />
                  </div>
                ))}
              </div>
            )
          ) : (
            /* League grid */
            <>
              <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">
                Ligas Domésticas
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-10">
                {domesticCounts.map(({ league, count }, i) => (
                  <div key={league.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 400)}ms`, animationFillMode: "both" }}>
                    <LeagueCard
                      league={league}
                      count={count}
                      onClick={() => setSelectedLeague(league)}
                      index={i}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">
                  Competições Internacionais
                </h2>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {internationalCounts.map(({ league, count }, i) => (
                  <div key={league.id} className="animate-slide-up" style={{ animationDelay: `${Math.min((domesticCounts.length + i) * 20, 400)}ms`, animationFillMode: "both" }}>
                    <LeagueCard
                      league={league}
                      count={count}
                      onClick={() => setSelectedLeague(league)}
                      index={domesticCounts.length + i}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selecting overlay */}
      {selecting && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--club-primary)", borderTopColor: "transparent" }}
            />
            <p className="text-white/70 text-sm">Carregando tema do clube...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <svg className="w-12 h-12 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-white/30 text-sm">Nenhum clube encontrado</p>
    </div>
  );
}
