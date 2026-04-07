import { useState, useMemo, useCallback } from "react";
import { Club } from "@/types/club";
import { ClubCard } from "./ClubCard";
import { useClubData } from "@/hooks/useClubData";
import { getClubColors } from "@/lib/clubColors";
import { applyTheme, extractColorsFromImage } from "@/lib/themeManager";
import { getClubImage } from "@/lib/imageCache";

interface ClubSelectionProps {
  onSelectClub: (club: Club) => void;
}

export function ClubSelection({ onSelectClub }: ClubSelectionProps) {
  const { clubs, leagues, loading, error, retry } = useClubData();
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState("Todas as ligas");
  const [selecting, setSelecting] = useState(false);

  const allLeagues = useMemo(() => ["Todas as ligas", ...leagues], [leagues]);

  const filtered = useMemo(() => {
    return clubs.filter((c: Club) => {
      if (!c.name) return false;
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchesLeague =
        league === "Todas as ligas" ||
        c.league === league ||
        (league === "Outras ligas" && (!c.league || c.league === "Outras ligas"));
      return matchesSearch && matchesLeague;
    });
  }, [clubs, search, league]);

  const handleSelectClub = useCallback(
    async (club: Club) => {
      if (selecting) return;
      setSelecting(true);

      const hardcoded = getClubColors(club.name);
      if (hardcoded) {
        applyTheme(hardcoded);
        onSelectClub(club);
        return;
      }

      const imageUrl = await getClubImage(club.name);
      if (imageUrl) {
        const colors = await extractColorsFromImage(imageUrl);
        applyTheme(colors);
      }

      onSelectClub(club);
    },
    [selecting, onSelectClub]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--club-primary)", borderTopColor: "transparent" }}
          />
          <p className="text-white/50 text-sm tracking-widest uppercase">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#0a0a0a" }}>
        <div className="text-center">
          <svg className="w-12 h-12 text-white/20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-white font-semibold mb-1">Erro ao carregar os dados</p>
          <p className="text-white/40 text-sm mb-6">{error}</p>
          <button
            onClick={retry}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ background: "var(--club-primary)" }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Hero header */}
      <div
        className="w-full py-14 px-4 text-center relative overflow-hidden"
        style={{ background: "var(--club-gradient)" }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
        <div className="relative z-10">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--club-primary)" }}
          >
            EA FC 26 · Modo Carreira
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Selecione seu clube
          </h1>
          <p className="text-white/50 text-base mt-3">
            Escolha o time que vai gerir na sua temporada
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div
        className="sticky top-0 z-20 px-4 py-4"
        style={{
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3">
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
              placeholder="Buscar clube..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--club-primary)80")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <div className="relative sm:w-60">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <select
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white appearance-none focus:outline-none transition-all duration-200 cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {allLeagues.map((l) => (
                <option key={l} value={l} style={{ background: "#1a1a1a", color: "#fff" }}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="max-w-7xl mx-auto mt-2 text-xs text-white/25">
          {filtered.length}{" "}
          {filtered.length === 1 ? "clube encontrado" : "clubes encontrados"}
          {clubs.length > 0 && ` de ${clubs.length} disponíveis`}
        </p>
      </div>

      {/* Club grid */}
      <div className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <svg className="w-12 h-12 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-white/30 text-sm">Nenhum clube encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {filtered.map((club: Club, index: number) => (
                <div
                  key={club.name}
                  className="animate-slide-up"
                  style={{ animationDelay: `${Math.min(index * 20, 400)}ms`, animationFillMode: "both" }}
                >
                  <ClubCard
                    club={club}
                    onClick={() => handleSelectClub(club)}
                    index={index}
                  />
                </div>
              ))}
            </div>
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
