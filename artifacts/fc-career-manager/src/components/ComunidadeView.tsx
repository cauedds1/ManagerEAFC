import { useState, useEffect, useCallback } from "react";
import type { CommunityPost, DiscoverProfile, ActivityItem } from "@/types/community";
import { REACTION_EMOJI, type ReactionType } from "@/types/community";
import {
  getFeed, getDiscover, getTopWeek, getActivity, getMyUsername, getQuota, markSeen,
} from "@/lib/community";
import { CommunityPostCard } from "./CommunityPostCard";
import { CommentsModal } from "./CommentsModal";
import { UsernameModal } from "./UsernameModal";
import { PublicProfileView } from "./PublicProfileView";
import type { Career } from "@/types/career";

type SubTab = "feed" | "descobrir" | "atividade" | "topweek";

interface Props {
  career: Career;
  lang: "pt" | "en";
  viewerUserId?: number;
}

const T = {
  pt: {
    title: "Comunidade",
    feed: "Feed",
    descobrir: "Descobrir",
    atividade: "Atividade",
    topweek: "Top da Semana",
    filterAll: "Todos",
    filterMyClub: "Meu Clube",
    filterMyLeague: "Minha Liga",
    langPt: "PT", langEn: "EN",
    searchPlaceholder: "Buscar @, clube, liga, técnico…",
    noPosts: "Nada por aqui ainda. Volte mais tarde.",
    noActivity: "Sem atividade recente.",
    quotaUsed: "Cota hoje",
    loadMore: "Carregar mais",
    reactedTo: "reagiu", commentedOn: "comentou em", repostedYour: "repostou seu post",
  },
  en: {
    title: "Community",
    feed: "Feed", descobrir: "Discover", atividade: "Activity", topweek: "Top of Week",
    filterAll: "All", filterMyClub: "My Club", filterMyLeague: "My League",
    langPt: "PT", langEn: "EN",
    searchPlaceholder: "Search @, club, league, coach…",
    noPosts: "Nothing here yet. Check back later.",
    noActivity: "No recent activity.",
    quotaUsed: "Today's quota",
    loadMore: "Load more",
    reactedTo: "reacted", commentedOn: "commented on", repostedYour: "reposted your post",
  },
};

export function ComunidadeView({ career, lang, viewerUserId }: Props) {
  const t = T[lang];
  const [tab, setTab] = useState<SubTab>("feed");
  const [filter, setFilter] = useState<"all" | "myClub" | "myLeague">("all");
  const [langFilter, setLangFilter] = useState<"all" | "pt" | "en">("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [discover, setDiscover] = useState<DiscoverProfile[]>([]);
  const [topWeek, setTopWeek] = useState<CommunityPost[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [openComments, setOpenComments] = useState<CommunityPost | null>(null);
  const [openProfile, setOpenProfile] = useState<{ username: string; careerId: string } | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

  // Username gate + initial seen
  useEffect(() => {
    (async () => {
      try {
        const r = await getMyUsername();
        setHasUsername(!!r.username);
        if (!r.username) setShowUsernameModal(true);
        await markSeen();
      } catch { setHasUsername(false); }
    })();
  }, []);

  // Quota
  useEffect(() => { getQuota().then(setQuota).catch(() => {}); }, []);

  const loadFeed = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const r = await getFeed({
        lang: langFilter === "all" ? undefined : langFilter,
        myClub: filter === "myClub",
        myLeague: filter === "myLeague",
        before: append ? cursor ?? undefined : undefined,
      });
      setPosts((prev) => append ? [...prev, ...r.posts] : r.posts);
      setCursor(r.nextCursor);
    } finally { setLoading(false); }
  }, [filter, langFilter, cursor]);

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    try { setDiscover(await getDiscover(search.trim() || undefined, { myClub: filter === "myClub", myLeague: filter === "myLeague" })); }
    finally { setLoading(false); }
  }, [search, filter]);

  const loadTopWeek = useCallback(async () => {
    setLoading(true);
    try { setTopWeek(await getTopWeek()); } finally { setLoading(false); }
  }, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try { setActivity(await getActivity()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!hasUsername) return;
    if (tab === "feed") void loadFeed(false);
    if (tab === "descobrir") void loadDiscover();
    if (tab === "topweek") void loadTopWeek();
    if (tab === "atividade") void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter, langFilter, hasUsername]);

  if (openProfile) {
    return <PublicProfileView username={openProfile.username} careerId={openProfile.careerId} lang={lang} viewerUserId={viewerUserId} onBack={() => setOpenProfile(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-white font-black text-2xl sm:text-3xl">{t.title}</h2>
        {quota && quota.limit > 0 && (
          <span className="text-xs text-white/50 tabular-nums">{t.quotaUsed}: {quota.used}/{quota.limit}</span>
        )}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {(["feed", "descobrir", "topweek", "atividade"] as SubTab[]).map((id) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition"
              style={{
                background: active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.03)",
                color: active ? "var(--club-primary)" : "rgba(255,255,255,0.55)",
                border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.05)"}`,
              }}>
              {t[id]}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {(tab === "feed" || tab === "descobrir") && (
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "myClub", "myLeague"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: filter === f ? "rgba(255,255,255,0.08)" : "transparent", color: filter === f ? "white" : "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {f === "all" ? t.filterAll : f === "myClub" ? t.filterMyClub : t.filterMyLeague}
            </button>
          ))}
          {tab === "feed" && (
            <div className="flex gap-1 ml-auto">
              {(["all", "pt", "en"] as const).map((l) => (
                <button key={l} onClick={() => setLangFilter(l)}
                  className="px-2 py-1 rounded text-[10px] font-bold uppercase transition"
                  style={{ background: langFilter === l ? "rgba(255,255,255,0.1)" : "transparent", color: langFilter === l ? "white" : "rgba(255,255,255,0.4)" }}>
                  {l === "all" ? "—" : l}
                </button>
              ))}
            </div>
          )}
          {tab === "descobrir" && (
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadDiscover(); }}
              placeholder={t.searchPlaceholder}
              className="flex-1 min-w-[180px] ml-auto px-3 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          )}
        </div>
      )}

      {/* Body */}
      {loading && <div className="text-white/40 text-sm text-center py-12">…</div>}

      {!loading && tab === "feed" && (
        posts.length === 0
          ? <div className="text-white/40 text-sm text-center py-12">{t.noPosts}</div>
          : <>
              {posts.map((p) => (
                <CommunityPostCard key={p.id} post={p} lang={lang} viewerUserId={viewerUserId}
                  onOpenComments={(post) => setOpenComments(post)}
                  onOpenProfile={(u, c) => setOpenProfile({ username: u, careerId: c })}
                  onMutate={() => loadFeed(false)}
                  onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
              ))}
              {cursor && (
                <button onClick={() => loadFeed(true)} className="w-full py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {t.loadMore}
                </button>
              )}
            </>
      )}

      {!loading && tab === "descobrir" && (
        discover.length === 0
          ? <div className="text-white/40 text-sm text-center py-12">{t.noPosts}</div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {discover.map((d) => (
                <button key={d.careerId} onClick={() => d.username && setOpenProfile({ username: d.username, careerId: d.careerId })}
                  className="rounded-xl p-3 flex items-center gap-3 text-left hover:opacity-90 transition"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {d.clubLogo && <img src={d.clubLogo} alt="" className="w-12 h-12 rounded-full object-contain flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)" }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-white font-bold text-sm truncate">{d.coachName || "—"}</span>
                      {(d.plan === "pro" || d.plan === "ultra") && <span className="text-[10px]">✓</span>}
                    </div>
                    <span className="text-white/45 text-xs block truncate">@{d.username} · {d.clubName}</span>
                    <span className="text-white/35 text-[10px]">{d.clubLeague}</span>
                  </div>
                </button>
              ))}
            </div>
      )}

      {!loading && tab === "topweek" && (
        topWeek.length === 0
          ? <div className="text-white/40 text-sm text-center py-12">{t.noPosts}</div>
          : topWeek.map((p) => (
              <CommunityPostCard key={p.id} post={p} lang={lang} viewerUserId={viewerUserId}
                onOpenComments={(post) => setOpenComments(post)}
                onOpenProfile={(u, c) => setOpenProfile({ username: u, careerId: c })}
                onMutate={() => loadTopWeek()} />
            ))
      )}

      {!loading && tab === "atividade" && (
        activity.length === 0
          ? <div className="text-white/40 text-sm text-center py-12">{t.noActivity}</div>
          : <div className="flex flex-col gap-2">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm rounded-lg px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-base">{a.type === "reaction" ? (a.reactionType ? REACTION_EMOJI[a.reactionType as ReactionType] : "👍") : a.type === "comment" ? "💬" : "🔁"}</span>
                  <span className="text-white/85 flex-1 min-w-0 truncate">
                    <b>@{a.username ?? "anon"}</b> {a.type === "reaction" ? t.reactedTo : a.type === "comment" ? t.commentedOn : t.repostedYour}
                    {a.content && <span className="text-white/55"> — "{a.content.slice(0, 40)}…"</span>}
                  </span>
                  <span className="text-white/30 text-xs flex-shrink-0">{relativeTime(a.createdAt, lang)}</span>
                </div>
              ))}
            </div>
      )}

      {openComments && (
        <CommentsModal post={openComments} lang={lang} viewerUserId={viewerUserId} onClose={() => setOpenComments(null)} />
      )}

      {showUsernameModal && (
        <UsernameModal lang={lang} onSet={() => { setShowUsernameModal(false); setHasUsername(true); }} />
      )}
    </div>
  );
}

function relativeTime(ms: number, lang: "pt" | "en"): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return lang === "pt" ? "agora" : "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
