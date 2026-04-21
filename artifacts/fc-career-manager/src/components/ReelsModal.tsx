import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NewsPost, NewsComment, NewsSource } from "@/types/noticias";
import type { PortalPhotos } from "@/lib/portalPhotosStorage";
import { PORTAL_DEFAULT_PHOTOS } from "@/lib/portalPhotosStorage";
import type { CustomPortal } from "@/lib/customPortalStorage";
import { getCommentAvatarUrl } from "@/lib/commentAvatar";

const SOURCE_CONFIG: Record<NewsSource, { color: string; bgColor: string; verified: boolean }> = {
  tnt:     { color: "#E8002D",  bgColor: "rgba(232,0,45,0.18)",   verified: true  },
  espn:    { color: "#E67E22",  bgColor: "rgba(230,126,34,0.18)", verified: true  },
  fanpage: { color: "var(--club-primary)", bgColor: "rgba(var(--club-primary-rgb),0.18)", verified: false },
  custom:  { color: "#a78bfa",  bgColor: "rgba(167,139,250,0.18)", verified: false },
};

const CATEGORY_LABEL: Record<string, string> = {
  resultado: "Resultado", lesao: "Lesão", transferencia: "Transferência",
  renovacao: "Renovação", treino: "Treino", conquista: "Conquista", geral: "Geral",
};
const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  resultado:    { bg: "rgba(52,211,153,0.15)",   color: "#34d399" },
  lesao:        { bg: "rgba(248,113,113,0.15)",  color: "#f87171" },
  transferencia:{ bg: "rgba(96,165,250,0.15)",   color: "#60a5fa" },
  renovacao:    { bg: "rgba(167,139,250,0.15)",  color: "#a78bfa" },
  treino:       { bg: "rgba(251,191,36,0.15)",   color: "#fbbf24" },
  conquista:    { bg: "rgba(250,204,21,0.15)",   color: "#facc15" },
  geral:        { bg: "rgba(148,163,184,0.15)",  color: "#94a3b8" },
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}
function formatTimeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function SourceAvatar({ source, sourceName, size, photoUrl }: { source: NewsSource; sourceName: string; size: number; photoUrl?: string }) {
  const [err, setErr] = useState(false);
  const cfg = SOURCE_CONFIG[source];
  const initial = sourceName.charAt(0).toUpperCase();
  const showPhoto = !!photoUrl && !err;
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 font-black overflow-hidden"
      style={{ width: size, height: size, background: showPhoto ? "transparent" : cfg.bgColor, border: `2px solid ${cfg.color}`, color: cfg.color, fontSize: size * 0.38 }}
    >
      {showPhoto ? <img src={photoUrl} alt={sourceName} onError={() => setErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
    </div>
  );
}

function CommentAvatar({ username, displayName, size }: { username: string; displayName: string; size: number }) {
  const [err, setErr] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();
  if (err) return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold" style={{ width: size, height: size, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", fontSize: size * 0.38 }}>
      {initial}
    </div>
  );
  return <img src={getCommentAvatarUrl(username)} alt={displayName || username} onError={() => setErr(true)} className="rounded-full flex-shrink-0 object-cover" style={{ width: size, height: size }} />;
}

function ReplyItem({ comment }: { comment: NewsComment }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="flex gap-2 mt-2 ml-8">
      <CommentAvatar username={comment.username} displayName={comment.displayName} size={22} />
      <div className="flex-1 min-w-0">
        <span className="text-white/80 text-xs font-bold mr-1.5">{comment.username}</span>
        <span className="text-white/55 text-xs leading-relaxed">{comment.content}</span>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-white/25 text-[10px]">{formatTimeAgo(comment.createdAt)}</span>
          {comment.likes > 0 && (
            <button onClick={() => setLiked(l => !l)} className="flex items-center gap-0.5 text-[10px] transition-colors" style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}>
              <span style={{ fontSize: 9 }}>{liked ? "❤️" : "🤍"}</span>
              <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentRow({ comment }: { comment: NewsComment }) {
  const [liked, setLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const hasReplies = !!(comment.replies?.length);
  return (
    <div className="flex gap-2.5">
      <CommentAvatar username={comment.username} displayName={comment.displayName} size={28} />
      <div className="flex-1 min-w-0">
        <span className="text-white text-xs font-bold mr-1.5">{comment.username}</span>
        <span className="text-white/65 text-xs leading-relaxed">{comment.content}</span>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-white/25 text-xs">{formatTimeAgo(comment.createdAt)}</span>
          <button onClick={() => setLiked(l => !l)} className="flex items-center gap-1 text-xs transition-colors" style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}>
            <span style={{ fontSize: 11 }}>{liked ? "❤️" : "🤍"}</span>
            {comment.likes > 0 && <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>}
          </button>
          {hasReplies && (
            <button onClick={() => setShowReplies(v => !v)} className="text-xs font-semibold transition-colors" style={{ color: "rgba(255,255,255,0.35)" }}>
              {showReplies ? "— ocultar respostas" : `— ver ${comment.replies!.length} ${comment.replies!.length === 1 ? "resposta" : "respostas"}`}
            </button>
          )}
        </div>
        {hasReplies && showReplies && comment.replies!.map(r => <ReplyItem key={r.id} comment={r} />)}
      </div>
    </div>
  );
}

interface ReelsModalProps {
  post: NewsPost;
  portalPhotos?: PortalPhotos;
  customPortals?: CustomPortal[];
  onClose: () => void;
}

export function ReelsModal({ post, portalPhotos, customPortals, onClose }: ReelsModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);

  const customPortal = post.source === "custom" && post.customPortalId
    ? customPortals?.find(p => p.id === post.customPortalId) : undefined;

  const postPhotoUrl = post.source === "custom"
    ? customPortal?.photo
    : (portalPhotos?.[post.source as keyof PortalPhotos] || PORTAL_DEFAULT_PHOTOS[post.source as keyof PortalPhotos]);

  const cfg = SOURCE_CONFIG[post.source] ?? SOURCE_CONFIG.custom;
  const catStyle = CATEGORY_COLOR[post.category] ?? CATEGORY_COLOR.geral;
  const totalLikes = post.likes + (liked ? 1 : 0);
  const hasComments = post.comments.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      videoRef.current?.pause();
    };
  }, [onClose]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }
  }, []);

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[400] flex"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
      } as React.CSSProperties}
    >
      <div
        className="relative flex-1 min-h-0 min-w-0 flex items-stretch sm:items-center sm:justify-center"
        style={{ background: "transparent" }}
      >
        <style>{`.reels-stage { width: 100%; height: 100%; } @media (min-width: 640px) { .reels-stage { aspect-ratio: 9 / 16; width: auto; height: 100%; max-height: 100vh; flex-shrink: 0; } }`}</style>
        <div className="reels-stage relative" style={{ background: "#000" }}>
          <video
            ref={videoRef}
            src={post.videoUrl}
            autoPlay
            loop
            playsInline
            muted={muted}
            className="w-full h-full object-cover sm:object-contain"
            style={{ display: "block" }}
          />

          {/* Mute button — bottom-left to avoid overlap with action buttons */}
          <button
            onClick={handleMuteToggle}
            className="absolute bottom-4 left-4 flex items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-90 z-10"
            style={{ width: 36, height: 36, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          {/* Action buttons — always visible on right side of video */}
          <div
            className="absolute right-3 flex flex-col items-center gap-5 z-10"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <button
              onClick={() => setLiked(l => !l)}
              className="flex flex-col items-center gap-1 transition-all active:scale-90"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <span style={{ fontSize: 22 }}>{liked ? "❤️" : "🤍"}</span>
              </div>
              <span className="text-white text-xs font-bold tabular-nums" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                {formatCount(totalLikes)}
              </span>
            </button>

            <button
              onClick={() => setShowComments(v => !v)}
              className="flex flex-col items-center gap-1 transition-all active:scale-90"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: showComments ? "rgba(var(--club-primary-rgb),0.35)" : "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  border: showComments ? "1px solid rgba(var(--club-primary-rgb),0.5)" : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-white text-xs font-bold tabular-nums" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                {formatCount(post.commentsCount)}
              </span>
            </button>

            <button className="flex flex-col items-center gap-1">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <span className="text-white text-xs font-bold tabular-nums" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                {formatCount(post.sharesCount)}
              </span>
            </button>
          </div>

          {/* Mobile text overlay — hidden on sm+ (sidebar shows this info instead) */}
          <div className="absolute inset-0 pointer-events-none sm:hidden">
            <div
              className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-20 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <SourceAvatar source={post.source} sourceName={post.sourceName} size={32} photoUrl={postPhotoUrl} />
                <span className="text-white text-sm font-bold leading-tight">{post.sourceName}</span>
                {cfg.verified && (
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill={cfg.color}>
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                )}
              </div>
              {post.title && <p className="text-white font-bold text-sm leading-snug mb-1">{post.title}</p>}
              <p className="text-white/70 text-xs leading-relaxed line-clamp-2">{post.content}</p>
            </div>

            {showComments && (
              <div
                className="absolute right-0 top-0 bottom-0 flex flex-col pointer-events-auto"
                style={{
                  width: "72vw",
                  maxWidth: 320,
                  background: "rgba(10,10,18,0.96)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  borderLeft: "1px solid rgba(255,255,255,0.1)",
                } as React.CSSProperties}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-white text-sm font-bold">Comentários</span>
                  <button
                    onClick={() => setShowComments(false)}
                    className="flex items-center justify-center rounded-full w-7 h-7 transition-colors hover:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div
                  className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
                >
                  {hasComments
                    ? post.comments.map(c => <CommentRow key={c.id} comment={c} />)
                    : <p className="text-white/30 text-xs text-center py-8">Nenhum comentário ainda</p>
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 left-4 flex items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-90 z-10"
          style={{ width: 38, height: 38, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
          aria-label="Fechar"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Desktop sidebar — hidden below sm breakpoint */}
      <div
        className="hidden sm:flex flex-col w-[340px] lg:w-[380px] flex-shrink-0"
        style={{
          background: "rgba(12,12,20,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
        } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <SourceAvatar source={post.source} sourceName={post.sourceName} size={42} photoUrl={postPhotoUrl} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white text-sm font-bold leading-tight truncate">{post.sourceName}</span>
              {cfg.verified && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill={cfg.color}>
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium" style={{ color: cfg.color }}>{post.sourceHandle}</span>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/40 text-xs">{formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: catStyle.bg, color: catStyle.color }}
          >
            {CATEGORY_LABEL[post.category] ?? "Geral"}
          </span>
        </div>

        <div
          className="px-4 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex gap-2.5">
            <SourceAvatar source={post.source} sourceName={post.sourceName} size={32} photoUrl={postPhotoUrl} />
            <div className="flex-1 min-w-0">
              <span className="text-white text-xs font-bold mr-1.5">{post.sourceName}</span>
              {post.title && <span className="text-white font-bold text-xs mr-1.5">{post.title}</span>}
              <span className="text-white/70 text-xs leading-relaxed whitespace-pre-line">{post.content}</span>
              <p className="text-white/30 text-xs mt-2">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </div>
        </div>

        {showComments ? (
          <div
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
          >
            {hasComments
              ? post.comments.map(c => <CommentRow key={c.id} comment={c} />)
              : <p className="text-white/30 text-xs text-center py-8">Nenhum comentário ainda</p>
            }
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-4 px-4 py-3.5">
            <button
              onClick={() => setLiked(l => !l)}
              className="flex items-center gap-2 transition-all duration-200 active:scale-90"
              style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.75)" }}
            >
              <span style={{ fontSize: 20 }}>{liked ? "❤️" : "🤍"}</span>
              <span className="text-sm font-bold tabular-nums">{formatCount(totalLikes)}</span>
            </button>

            <button
              onClick={() => setShowComments(v => !v)}
              className="flex items-center gap-2 transition-all duration-200 active:scale-90"
              style={{ color: showComments ? "var(--club-primary)" : "rgba(255,255,255,0.75)" }}
            >
              <svg className="w-5 h-5" fill={showComments ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-bold tabular-nums">{formatCount(post.commentsCount)}</span>
            </button>

            <button
              className="flex items-center gap-2 transition-colors duration-200"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-sm font-bold tabular-nums">{formatCount(post.sharesCount)}</span>
            </button>

            <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>Reels</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
