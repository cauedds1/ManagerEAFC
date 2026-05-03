import { useState } from "react";
import type { CommunityPost, ReactionType } from "@/types/community";
import { REACTION_EMOJI } from "@/types/community";
import { addReaction, removeReaction, repost as doRepost, unrepost, reportContent, blockUser, unpublishPost } from "@/lib/community";
import { FanCommentsList } from "./FanCommentsList";
import type { NewsComment } from "@/types/noticias";

interface Props {
  post: CommunityPost;
  lang: "pt" | "en";
  viewerUserId?: number;
  compact?: boolean;
  onOpenComments?: (post: CommunityPost) => void;
  onOpenProfile?: (username: string, careerId: string) => void;
  onMutate?: () => void;
  onDeleted?: (id: string) => void;
}

const T = {
  pt: { repost: "Repostar", reposted: "Repostado", comments: "Comentar", report: "Denunciar", block: "Bloquear", delete: "Excluir", confirmDelete: "Excluir publicação?", reasonPrompt: "Motivo da denúncia:", verified: "Verificado", reportSuccess: "Denúncia enviada", live: "ao vivo", justNow: "agora", min: "min", h: "h", d: "d" },
  en: { repost: "Repost", reposted: "Reposted", comments: "Comment", report: "Report", block: "Block", delete: "Delete", confirmDelete: "Delete post?", reasonPrompt: "Reason for report:", verified: "Verified", reportSuccess: "Report submitted", live: "live", justNow: "now", min: "min", h: "h", d: "d" },
};

function timeAgo(ms: number, lang: "pt" | "en"): string {
  const t = T[lang];
  const diff = Date.now() - ms;
  if (diff < 60_000) return t.justNow;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}${t.min}`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}${t.h}`;
  return `${Math.floor(diff / 86400_000)}${t.d}`;
}

export function CommunityPostCard({ post, lang, viewerUserId, compact, onOpenComments, onOpenProfile, onMutate, onDeleted }: Props) {
  const t = T[lang];
  const [showReact, setShowReact] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [optimistic, setOptimistic] = useState<{ reactions: Record<string, number>; viewerReactions: string[]; reposted: boolean; repostsCount: number } | null>(null);

  const reactions = optimistic?.reactions ?? post.reactions;
  const viewerReactions = optimistic?.viewerReactions ?? post.viewerReactions;
  const reposted = optimistic?.reposted ?? post.viewerReposted;
  const repostsCount = optimistic?.repostsCount ?? post.repostsCount;

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
  const isOwn = viewerUserId === post.userId;
  const verified = post.plan === "pro" || post.plan === "ultra";

  const toggleReaction = async (rt: ReactionType) => {
    setShowReact(false);
    const has = viewerReactions.includes(rt);
    const newReacts = { ...reactions };
    newReacts[rt] = (newReacts[rt] ?? 0) + (has ? -1 : 1);
    if (newReacts[rt] <= 0) delete newReacts[rt];
    const newViewer = has ? viewerReactions.filter((r) => r !== rt) : [...viewerReactions, rt];
    setOptimistic({ reactions: newReacts, viewerReactions: newViewer, reposted, repostsCount });
    try {
      if (has) await removeReaction(post.id, rt);
      else await addReaction(post.id, rt);
    } catch { setOptimistic(null); }
  };

  const handleRepost = async () => {
    const newState = !reposted;
    setOptimistic({ reactions, viewerReactions, reposted: newState, repostsCount: repostsCount + (newState ? 1 : -1) });
    try { newState ? await doRepost(post.id) : await unrepost(post.id); }
    catch { setOptimistic(null); }
  };

  const handleReport = async () => {
    setShowMenu(false);
    const reason = window.prompt(t.reasonPrompt);
    if (!reason) return;
    try { await reportContent("post", post.id, reason); window.alert(t.reportSuccess); } catch (e) { window.alert((e as Error).message); }
  };

  const handleBlock = async () => {
    setShowMenu(false);
    if (!window.confirm(t.block + " @" + post.username + "?")) return;
    try { await blockUser(post.userId); onMutate?.(); } catch (e) { window.alert((e as Error).message); }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (!window.confirm(t.confirmDelete)) return;
    try { await unpublishPost(post.id); onDeleted?.(post.id); } catch (e) { window.alert((e as Error).message); }
  };

  const accent = post.clubPrimary ?? "#8b5cf6";
  const accentRgb = post.clubPrimary ? hexToRgb(post.clubPrimary) : "139,92,246";

  const clubLogoUrl = post.clubLogo || (post.clubId > 0 ? `https://media.api-sports.io/football/teams/${post.clubId}.png` : "");
  const avatarUrl = post.coachPhoto || clubLogoUrl;
  const isCoachPhoto = !!post.coachPhoto;

  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3" style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeft: `3px solid ${accent}`,
    }}>
      {/* Header — author identity */}
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => post.username && onOpenProfile?.(post.username, post.careerId)} className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition">
          {avatarUrl && <img src={avatarUrl} alt="" className={"w-10 h-10 rounded-full flex-shrink-0 " + (isCoachPhoto ? "object-cover" : "object-contain")} style={{ background: "rgba(255,255,255,0.04)", border: `1.5px solid rgba(${accentRgb},0.35)` }} />}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-sm truncate">{post.coachName || "—"}</span>
              {verified && <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill={accent} aria-label={t.verified}><path d="M12 2l2.4 2.4L18 4l1.6 3.6L23 9l-2 3.4 2 3.4-3.4 1.4L18 21l-3.6-.4L12 22l-2.4-2.4L6 21l-1.6-3.4L1 16l2-3.4L1 9l3.4-1.4L6 4l3.6.4z"/></svg>}
            </div>
            <span className="text-white/45 text-xs truncate">@{post.username ?? "anon"} · {post.clubName} · {post.clubLeague}</span>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-white/35 text-xs tabular-nums">{timeAgo(post.publishedAt, lang)}</span>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-white/40 hover:text-white/80 transition p-1">⋯</button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1 z-10" style={{ background: "rgba(20,18,32,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {isOwn ? (
                  <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5">{t.delete}</button>
                ) : (
                  <>
                    <button onClick={handleReport} className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5">{t.report}</button>
                    <button onClick={handleBlock} className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5">{t.block}</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source/category badge */}
      {post.content.sourceName && (
        <div className="flex items-center gap-2 text-xs text-white/55">
          {post.content.sourcePhotoUrl && <img src={post.content.sourcePhotoUrl} alt="" className="w-5 h-5 rounded object-cover" />}
          <span className="font-semibold">{post.content.sourceName}</span>
          {post.content.sourceHandle && <span className="text-white/35">@{post.content.sourceHandle}</span>}
        </div>
      )}

      {/* Content */}
      {post.content.title && <h3 className="text-white font-bold text-base leading-snug">{post.content.title}</h3>}
      {post.content.content && (
        <p className={"text-white/85 text-sm leading-relaxed whitespace-pre-wrap " + (compact ? "line-clamp-3" : "")}>{post.content.content}</p>
      )}
      {post.content.imageUrl && !compact && (
        <img src={post.content.imageUrl} alt="" className="w-full max-h-96 rounded-xl object-cover" />
      )}

      {/* Fan comments preview (AI-generated, imported from career news) */}
      {!compact && Array.isArray((post.content as { comments?: unknown }).comments) && (
        <FanCommentsList
          comments={(post.content as { comments: NewsComment[] }).comments}
          lang={lang}
          limit={2}
          onShowAll={() => onOpenComments?.(post)}
        />
      )}

      {/* Reactions strip */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          {Object.entries(reactions).slice(0, 3).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">{REACTION_EMOJI[k as ReactionType] ?? "•"}<span className="tabular-nums">{v}</span></span>
          ))}
          <span className="text-white/30">· {totalReactions}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <div className="relative">
          <button onClick={() => setShowReact(!showReact)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition">
            {viewerReactions.length > 0 ? <span>{REACTION_EMOJI[viewerReactions[0] as ReactionType]}</span> : <span>👍</span>}
            <span>{totalReactions || ""}</span>
          </button>
          {showReact && (
            <div className="absolute bottom-full left-0 mb-2 flex gap-1 px-2 py-1.5 rounded-2xl z-10" style={{ background: "rgba(20,18,32,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {(Object.keys(REACTION_EMOJI) as ReactionType[]).map((rt) => (
                <button key={rt} onClick={() => toggleReaction(rt)} className="text-xl hover:scale-125 transition-transform p-1">{REACTION_EMOJI[rt]}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onOpenComments?.(post)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition">
          💬 <span className="tabular-nums">{post.commentsCount || ""}</span>
        </button>
        <button onClick={handleRepost} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition"
          style={{ color: reposted ? accent : "rgba(255,255,255,0.6)" }}>
          🔁 <span className="tabular-nums">{repostsCount || ""}</span>
        </button>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
