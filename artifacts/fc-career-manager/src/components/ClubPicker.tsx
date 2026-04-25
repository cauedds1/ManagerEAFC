import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, ALL_LEAGUES, LeagueInfo } from "@/lib/footballApiMap";
import { getClubsByLeague, searchClubs } from "@/lib/clubListCache";
import { applyTheme, resetTheme, extractColorsFromImage, getCurrentColors } from "@/lib/themeManager";
import { useLang } from "@/hooks/useLang";
import { WIZARD } from "@/lib/i18n";

interface ClubPickerProps {
  allClubs: ClubEntry[];
  onSelectClub: (entry: ClubEntry, league: LeagueInfo | null) => void;
  initialLeague?: LeagueInfo | null;
}

function LeagueLogo({ logoUrl, size = 24 }: { logoUrl: string; size?: number }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="flex items-center justify-center rounded-md flex-shrink-0 overflow-hidden"
      style={{ width: size + 4, height: size + 4, background: "rgba(255,255,255,0.06)" }}
    >
      {!err && (
        <img
          src={logoUrl}
          alt=""
          className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width: size, height: size }}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      )}
    </div>
  );
}

function ClubLogo({ logo, name, size = 36 }: { logo: string; name: string; size?: number }) {
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

function LeagueCard({
  league,
  count,
  onClick,
  index,
  clubsLabel,
}: {
  league: LeagueInfo;
  count: number;
  onClick: () => void;
  index: number;
  clubsLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left w-full transition-all duration-150 animate-slide-up glass glass-hover"
      style={{
        animationDelay: `${Math.min(index * 15, 250)}ms`,
        animationFillMode: "both",
      }}
    >
      <LeagueLogo logoUrl={league.logo} size={26} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">
          {league.displayName ?? league.name}
        </p>
        {count > 0 && (
          <p className="text-white/30 text-xs tabular-nums mt-0.5">{count} {clubsLabel}</p>
        )}
      </div>
      <svg
        className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function CompactClubCard({
  entry,
  onClick,
  index,
}: {
  entry: ClubEntry;
  onClick: () => void;
  index: number;
}) {
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

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
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
          if (isMounted.current && !isSelected.current) applyTheme(colors);
        } catch {}
      }, 150);
    },
    [entry.logo]
  );

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
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all duration-150 animate-slide-up glass"
      style={{
        animationDelay: `${Math.min(index * 12, 200)}ms`,
        animationFillMode: "both",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ClubLogo logo={entry.logo} name={entry.name} size={44} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">{entry.name}</p>
        <p className="text-white/30 text-xs mt-0.5 truncate">{entry.league}</p>
      </div>
      <svg
        className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export function ClubPicker({ allClubs, onSelectClub, initialLeague }: ClubPickerProps) {
  const [lang] = useLang();
  const t = WIZARD[lang];

  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(
    initialLeague ?? null
  );
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

  const domesticLeagues = DOMESTIC_LEAGUES.map((l) => ({
    league: l,
    count: countByLeague.get(l.id) ?? 0,
  }));

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

  // ─── Custom club creation ──────────────────────────────────────────────────
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customLeagueSearch, setCustomLeagueSearch] = useState("");
  const [customSelectedLeague, setCustomSelectedLeague] = useState<LeagueInfo | null>(null);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [customNameError, setCustomNameError] = useState("");
  const [customLeagueError, setCustomLeagueError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCustomLeagues = useMemo(() => {
    const q = customLeagueSearch.trim().toLowerCase();
    if (!q) return ALL_LEAGUES;
    return ALL_LEAGUES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.displayName ?? "").toLowerCase().includes(q) ||
        (l.country ?? "").toLowerCase().includes(q)
    );
  }, [customLeagueSearch]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setCustomLogoDataUrl(dataUrl);
      try {
        const colors = await extractColorsFromImage(dataUrl);
        applyTheme(colors);
      } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleCustomSubmit = useCallback(() => {
    let hasError = false;
    if (!customName.trim()) { setCustomNameError(t.customClubNameError); hasError = true; }
    else setCustomNameError("");
    if (!customSelectedLeague) { setCustomLeagueError(t.customClubLeagueError); hasError = true; }
    else setCustomLeagueError("");
    if (hasError) return;

    const customEntry: ClubEntry = {
      id: 0,
      name: customName.trim(),
      logo: customLogoDataUrl ?? "",
      league: customSelectedLeague!.displayName ?? customSelectedLeague!.name,
      leagueId: customSelectedLeague!.id,
      country: customSelectedLeague!.country,
    };
    onSelectClub(customEntry, customSelectedLeague);
  }, [customName, customSelectedLeague, customLogoDataUrl, onSelectClub, t]);

  const handleOpenCustomForm = useCallback(() => {
    setShowCustomForm(true);
    setCustomName("");
    setCustomLeagueSearch("");
    setCustomSelectedLeague(null);
    setCustomLogoDataUrl(null);
    setCustomNameError("");
    setCustomLeagueError("");
  }, []);

  const handleCloseCustomForm = useCallback(() => {
    setShowCustomForm(false);
    resetTheme();
  }, []);

  if (showCustomForm) {
    return (
      <div className="flex flex-col h-full animate-fade-up">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--club-primary)" }}>
              {t.step2of4}
            </p>
            <h2 className="text-lg font-black text-white leading-tight">{t.createOwnClub}</h2>
          </div>
          <button
            onClick={handleCloseCustomForm}
            className="flex items-center gap-1 text-white/40 hover:text-white text-xs font-medium transition-colors duration-200 flex-shrink-0 ml-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.customClubBack}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0 flex flex-col gap-4">
          {/* Logo upload */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1.5px dashed rgba(var(--club-primary-rgb),0.3)" }}
            >
              {customLogoDataUrl ? (
                <img src={customLogoDataUrl} alt="logo" className="w-14 h-14 object-contain" />
              ) : (
                <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-white/60 text-xs font-semibold">{t.customClubLogo}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 active:scale-95"
                style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.25)" }}
              >
                {customLogoDataUrl ? t.customClubLogoChange : t.customClubLogoUpload}
              </button>
              <p className="text-white/25 text-[10px]">{t.customClubLogoHint}</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Club name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-semibold">{t.customClubName}</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => { setCustomName(e.target.value); if (e.target.value.trim()) setCustomNameError(""); }}
              placeholder={t.customClubNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-lg text-white placeholder-white/25 focus:outline-none transition-all text-sm glass"
              style={customNameError ? { borderColor: "rgba(239,68,68,0.5)" } : {}}
            />
            {customNameError && <p className="text-red-400 text-[10px]">{customNameError}</p>}
          </div>

          {/* League selector */}
          <div className="flex flex-col gap-1.5 flex-1 min-h-0">
            <label className="text-white/60 text-xs font-semibold flex-shrink-0">{t.customClubLeague}</label>
            {customSelectedLeague ? (
              <button
                onClick={() => setCustomSelectedLeague(null)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all hover:opacity-80"
                style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
              >
                {customSelectedLeague.logo && (
                  <img src={customSelectedLeague.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                <span className="text-white text-sm font-semibold flex-1">{customSelectedLeague.displayName ?? customSelectedLeague.name}</span>
                <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                <div className="relative flex-shrink-0">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={customLeagueSearch}
                    onChange={(e) => setCustomLeagueSearch(e.target.value)}
                    placeholder={t.customClubLeaguePlaceholder}
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-white placeholder-white/25 focus:outline-none transition-all text-xs glass"
                    style={customLeagueError ? { borderColor: "rgba(239,68,68,0.5)" } : {}}
                  />
                </div>
                {customLeagueError && <p className="text-red-400 text-[10px] flex-shrink-0">{customLeagueError}</p>}
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5">
                  {filteredCustomLeagues.map((league) => (
                    <button
                      key={league.id}
                      onClick={() => { setCustomSelectedLeague(league); setCustomLeagueError(""); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/05 w-full"
                    >
                      {league.logo ? (
                        <img src={league.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className="w-5 h-5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{league.displayName ?? league.name}</p>
                        {league.country && <p className="text-white/30 text-[10px] truncate">{league.country}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleCustomSubmit}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-98 flex-shrink-0 mt-auto"
            style={{ background: "var(--club-gradient)", color: "#fff" }}
          >
            {t.customClubSubmit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-up">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <p
            className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
            style={{ color: "var(--club-primary)" }}
          >
            {t.step2of4}
          </p>
          <h2 className="text-lg font-black text-white leading-tight">
            {selectedLeague
              ? (selectedLeague.displayName ?? selectedLeague.name)
              : t.chooseClub}
          </h2>
        </div>
        {selectedLeague && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-white/40 hover:text-white text-xs font-medium transition-colors duration-200 flex-shrink-0 ml-4"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.backLeagues}
          </button>
        )}
      </div>

      <div className="relative mb-3 flex-shrink-0">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            selectedLeague
              ? `${t.searchInLeague} ${selectedLeague.displayName ?? selectedLeague.name}...`
              : t.searchClubOrLeague
          }
          className="w-full pl-9 pr-8 py-2 rounded-lg text-white placeholder-white/25 focus:outline-none transition-all duration-200 text-xs glass"
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(var(--club-primary-rgb),0.3)")
          }
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Create own club — pinned above the scrollable list, hidden when searching or inside a league */}
      {!isSearching && !selectedLeague && (
        <button
          onClick={handleOpenCustomForm}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-3 text-left transition-all hover:opacity-90 active:scale-98 flex-shrink-0"
          style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1.5px dashed rgba(var(--club-primary-rgb),0.35)" }}
        >
          <div
            className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: "rgba(var(--club-primary-rgb),0.18)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--club-primary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">{t.createOwnClub}</p>
            <p className="text-white/40 text-[11px] mt-0.5 leading-snug">{t.createOwnClubDesc}</p>
          </div>
          <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
        {isSearching && !selectedLeague ? (
          <div>
            <p className="text-white/25 text-[10px] mb-1.5 tabular-nums">
              {globalSearchResults.length}{" "}
              {globalSearchResults.length === 1 ? t.clubFound : t.clubsFound}
            </p>
            {globalSearchResults.length === 0 ? (
              <EmptySearchState label={t.noClub} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {globalSearchResults.map((entry, i) => (
                  <CompactClubCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => onSelectClub(entry, selectedLeague)}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        ) : selectedLeague ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/25 text-[10px]">
                {selectedLeague.country} · {clubsInLeague.length} {t.clubs}
              </span>
            </div>
            {clubsInLeague.length === 0 ? (
              <EmptySearchState label={t.noClub} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {clubsInLeague.map((entry, i) => (
                  <CompactClubCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => onSelectClub(entry, selectedLeague)}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-white/25 text-[10px] font-semibold tracking-widest uppercase mb-1.5">
              {t.domesticLeagues}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mb-4">
              {domesticLeagues.map(({ league, count }, i) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  count={count}
                  onClick={() => setSelectedLeague(league)}
                  index={i}
                  clubsLabel={t.clubs}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptySearchState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <svg
        className="w-7 h-7 text-white/10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <p className="text-white/25 text-sm">{label}</p>
    </div>
  );
}
