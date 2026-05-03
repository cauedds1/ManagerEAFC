import { useState } from "react";
import type { NewsComment } from "@/types/noticias";
import { getCommentAvatarUrl } from "@/lib/commentAvatar";

type Lang = "pt" | "en";

const T = {
  pt: { fans: "Comentários da torcida", viewAll: "Ver todos os {n} comentários", viewReply: "— ver {n} resposta", viewReplies: "— ver {n} respostas", hideReplies: "— ocultar respostas" },
  en: { fans: "Fan comments", viewAll: "View all {n} comments", viewReply: "— view {n} reply", viewReplies: "— view {n} replies", hideReplies: "— hide replies" },
};

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

function timeAgo(ms: number, lang: Lang): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return lang === "pt" ? "agora" : "now";
  const m = Math.floor(diff / 60_000); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ username, displayName, size }: { username: string; displayName: string; size: number }) {
  const [err, setErr] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();
  if (err) {
    return (
      <div className="rounded-full flex-shrink-0 flex items-center justify-center text-white/60 font-bold"
        style={{ width: size, height: size, background: "rgba(255,255,255,0.07)", fontSize: size * 0.38 }}>
        {initial}
      </div>
    );
  }
  return <img src={getCommentAvatarUrl(username)} alt={displayName || username} onError={() => setErr(true)}
    className="rounded-full flex-shrink-0 object-cover" style={{ width: size, height: size }} />;
}

function Reply({ comment, lang }: { comment: NewsComment; lang: Lang }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="flex gap-2.5 mt-2.5 ml-8">
      <Avatar username={comment.username} displayName={comment.displayName} size={24} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-white/80 text-xs font-bold">{comment.username}</span>
          <span className="text-white/35 text-xs leading-relaxed">{comment.content}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-white/25 text-xs">{timeAgo(comment.createdAt, lang)}</span>
          {comment.likes > 0 && (
            <button onClick={() => setLiked((l) => !l)} className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}>
              <span style={{ fontSize: 11 }}>{liked ? "❤️" : "🤍"}</span>
              <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ comment, lang }: { comment: NewsComment; lang: Lang }) {
  const t = T[lang];
  const [liked, setLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const hasReplies = !!(comment.replies && comment.replies.length > 0);
  return (
    <div className="flex gap-2.5">
      <Avatar username={comment.username} displayName={comment.displayName} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-white text-xs font-bold">{comment.username}</span>
          <span className="text-white/60 text-xs leading-relaxed">{comment.content}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-white/25 text-xs">{timeAgo(comment.createdAt, lang)}</span>
          <button onClick={() => setLiked((l) => !l)} className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}>
            <span style={{ fontSize: 11 }}>{liked ? "❤️" : "🤍"}</span>
            {comment.likes > 0 && <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>}
          </button>
          {hasReplies && (
            <button onClick={() => setShowReplies((v) => !v)} className="text-xs font-semibold transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              {showReplies ? t.hideReplies : (comment.replies!.length === 1 ? t.viewReply.replace("{n}", String(comment.replies!.length)) : t.viewReplies.replace("{n}", String(comment.replies!.length)))}
            </button>
          )}
        </div>
        {hasReplies && showReplies && (
          <div className="mt-1">
            {comment.replies!.map((r) => <Reply key={r.id} comment={r} lang={lang} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function FanCommentsList({ comments, lang, limit, onShowAll }: { comments: NewsComment[]; lang: Lang; limit?: number; onShowAll?: () => void }) {
  const t = T[lang];
  if (!comments || comments.length === 0) return null;
  const shown = typeof limit === "number" ? comments.slice(0, limit) : comments;
  const hidden = comments.length - shown.length;
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t.fans} · {comments.length}</div>
      {shown.map((c) => <Item key={c.id} comment={c} lang={lang} />)}
      {hidden > 0 && onShowAll && (
        <button onClick={onShowAll} className="text-xs font-semibold text-white/45 hover:text-white/70 text-left">
          {t.viewAll.replace("{n}", String(comments.length))}
        </button>
      )}
    </div>
  );
}
