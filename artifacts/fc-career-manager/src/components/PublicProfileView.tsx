import { useState, useEffect } from "react";
import type { PublicProfileResponse, CommunityPost } from "@/types/community";
import { getPublicProfile, blockUser, reportContent } from "@/lib/community";
import { CommunityPostCard } from "./CommunityPostCard";
import { CommentsModal } from "./CommentsModal";

interface Props {
  username: string;
  careerId: string;
  lang: "pt" | "en";
  viewerUserId?: number;
  onBack: () => void;
}

const T = {
  pt: { back: "Voltar", live: "ao vivo", posts: "publicações", likes: "curtidas", since: "publicado desde", block: "Bloquear", report: "Denunciar", sharedHistory: "Você também já comandou", verified: "Verificado", noPosts: "Sem publicações.", reasonPrompt: "Motivo:" },
  en: { back: "Back", live: "live", posts: "posts", likes: "likes", since: "published since", block: "Block", report: "Report", sharedHistory: "You also managed", verified: "Verified", noPosts: "No posts.", reasonPrompt: "Reason:" },
};

export function PublicProfileView({ username, careerId, lang, viewerUserId, onBack }: Props) {
  const t = T[lang];
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [openComments, setOpenComments] = useState<CommunityPost | null>(null);

  useEffect(() => {
    (async () => {
      try { setData(await getPublicProfile(username, careerId)); }
      catch (e) { setError((e as Error).message); }
    })();
  }, [username, careerId]);

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <button onClick={onBack} className="text-white/50 hover:text-white text-sm mb-4">← {t.back}</button>
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );
  if (!data) return <div className="text-white/40 text-center py-12">…</div>;

  const accent = data.clubPrimary ?? "#8b5cf6";

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-5">
      <button onClick={onBack} className="text-white/50 hover:text-white text-sm self-start">← {t.back}</button>

      {/* Header */}
      <div className="rounded-3xl p-5 sm:p-6 flex flex-col gap-4" style={{ background: `linear-gradient(135deg, ${accent}22, transparent)`, border: `1px solid ${accent}44` }}>
        <div className="flex items-start gap-4">
          {data.clubLogo && <img src={data.clubLogo} alt="" className="w-20 h-20 rounded-2xl object-contain" style={{ background: "rgba(255,255,255,0.05)", border: `2px solid ${accent}66` }} />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-black text-2xl">{data.coachName || data.username}</h1>
              {data.verified && <svg className="w-5 h-5" viewBox="0 0 24 24" fill={accent} aria-label={t.verified}><path d="M12 2l2.4 2.4L18 4l1.6 3.6L23 9l-2 3.4 2 3.4-3.4 1.4L18 21l-3.6-.4L12 22l-2.4-2.4L6 21l-1.6-3.4L1 16l2-3.4L1 9l3.4-1.4L6 4l3.6.4z"/></svg>}
              {data.isLive && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: "rgba(16,185,129,0.2)", color: "#34d399" }}>● {t.live}</span>}
            </div>
            <p className="text-white/55 text-sm mt-0.5">@{data.username} · {data.clubName}</p>
            <p className="text-white/35 text-xs">{data.clubLeague}</p>
            {data.bio && <p className="text-white/75 text-sm mt-3 leading-relaxed">{data.bio}</p>}
          </div>
        </div>
        <div className="flex items-center gap-5 text-xs text-white/55">
          <span><b className="text-white text-base">{data.stats.totalPosts}</b> {t.posts}</span>
          <span><b className="text-white text-base">{data.stats.totalLikes}</b> {t.likes}</span>
        </div>
        {data.sharedHistory && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span>🤝</span><span className="text-white/75">{t.sharedHistory} <b>{data.sharedHistory.clubName}</b> ({data.sharedHistory.season})</span>
          </div>
        )}
        {viewerUserId !== data.userId && (
          <div className="flex gap-2">
            <button onClick={async () => { if (window.confirm(t.block + " @" + data.username + "?")) { await blockUser(data.userId); onBack(); } }}
              className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-white" style={{ background: "rgba(255,255,255,0.04)" }}>{t.block}</button>
            <button onClick={async () => { const r = window.prompt(t.reasonPrompt); if (r) { await reportContent("profile", data.careerId, r); window.alert("✓"); } }}
              className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-white" style={{ background: "rgba(255,255,255,0.04)" }}>{t.report}</button>
          </div>
        )}
      </div>

      {/* Posts */}
      {data.posts.length === 0
        ? <div className="text-white/40 text-sm text-center py-12">{t.noPosts}</div>
        : data.posts.map((p) => (
            <CommunityPostCard key={p.id} post={p} lang={lang} viewerUserId={viewerUserId}
              onOpenComments={(post) => setOpenComments(post)} />
          ))}

      {openComments && <CommentsModal post={openComments} lang={lang} viewerUserId={viewerUserId} onClose={() => setOpenComments(null)} />}
    </div>
  );
}
