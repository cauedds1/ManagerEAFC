import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { NewsPost, NewsComment, NewsSource } from "@/types/noticias";
import type { PortalPhotos } from "@/lib/portalPhotosStorage";
import { PORTAL_DEFAULT_PHOTOS } from "@/lib/portalPhotosStorage";
import type { CustomPortal } from "@/lib/customPortalStorage";
import { getCommentAvatarUrl } from "@/lib/commentAvatar";

const SOURCE_CONFIG: Record<NewsSource, { color: string; bgColor: string; verified: boolean; emoji: string }> = {
  tnt: {
    color: "#E8002D",
    bgColor: "rgba(232, 0, 45, 0.15)",
    verified: true,
    emoji: "📺",
  },
  espn: {
    color: "#E67E22",
    bgColor: "rgba(230, 126, 34, 0.15)",
    verified: true,
    emoji: "🏆",
  },
  fanpage: {
    color: "var(--club-primary)",
    bgColor: "rgba(var(--club-primary-rgb), 0.15)",
    verified: false,
    emoji: "⚽",
  },
  custom: {
    color: "#a78bfa",
    bgColor: "rgba(167, 139, 250, 0.15)",
    verified: false,
    emoji: "✍️",
  },
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

function SourceAvatar({
  source,
  sourceName,
  size = 40,
  photoUrl,
}: {
  source: NewsSource;
  sourceName: string;
  size?: number;
  photoUrl?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const cfg = SOURCE_CONFIG[source];
  const initial = sourceName.charAt(0).toUpperCase();
  const showPhoto = !!photoUrl && !imgError;

  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 font-black overflow-hidden"
      style={{
        width: size,
        height: size,
        background: showPhoto ? "transparent" : cfg.bgColor,
        border: `2px solid ${cfg.color}`,
        color: cfg.color,
        fontSize: size * 0.38,
      }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={sourceName}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initial
      )}
    </div>
  );
}

function CommentAvatar({ username, displayName, size }: { username: string; displayName: string; size: number }) {
  const [err, setErr] = useState(false);
  const initial = (displayName || username).charAt(0).toUpperCase();
  if (err) {
    return (
      <div
        className="rounded-full flex-shrink-0 flex items-center justify-center text-white/60 font-bold"
        style={{ width: size, height: size, background: "rgba(255,255,255,0.07)", fontSize: size * 0.38 }}
      >
        {initial}
      </div>
    );
  }
  return (
    <img
      src={getCommentAvatarUrl(username)}
      alt={displayName || username}
      onError={() => setErr(true)}
      className="rounded-full flex-shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function ReplyComment({ comment }: { comment: NewsComment }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="flex gap-2.5 mt-2.5 ml-8">
      <CommentAvatar username={comment.username} displayName={comment.displayName} size={24} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-white/80 text-xs font-bold">{comment.username}</span>
          <span className="text-white/35 text-xs leading-relaxed">{comment.content}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-white/25 text-xs">{formatTimeAgo(comment.createdAt)}</span>
          {comment.likes > 0 && (
            <button
              onClick={() => setLiked((l) => !l)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}
            >
              <span style={{ fontSize: 11 }}>{liked ? "❤️" : "🤍"}</span>
              <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: NewsComment }) {
  const [liked, setLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className="flex gap-2.5">
      <CommentAvatar username={comment.username} displayName={comment.displayName} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-white text-xs font-bold">{comment.username}</span>
          <span className="text-white/60 text-xs leading-relaxed">{comment.content}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-white/25 text-xs">{formatTimeAgo(comment.createdAt)}</span>
          <button
            onClick={() => setLiked((l) => !l)}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.25)" }}
          >
            <span style={{ fontSize: 11 }}>{liked ? "❤️" : "🤍"}</span>
            {comment.likes > 0 && <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>}
          </button>
          {hasReplies && (
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="text-xs font-semibold transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              {showReplies
                ? "— ocultar respostas"
                : `— ver ${comment.replies!.length} ${comment.replies!.length === 1 ? "resposta" : "respostas"}`}
            </button>
          )}
        </div>
        {hasReplies && showReplies && (
          <div className="mt-1">
            {comment.replies!.map((reply) => (
              <ReplyComment key={reply.id} comment={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  resultado: "Resultado",
  lesao: "Lesão",
  transferencia: "Transferência",
  renovacao: "Renovação",
  treino: "Treino",
  conquista: "Conquista",
  geral: "Geral",
};

const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  resultado: { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
  lesao: { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
  transferencia: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  renovacao: { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  treino: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  conquista: { bg: "rgba(250,204,21,0.15)", color: "#facc15" },
  geral: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
};

interface NoticiaPostProps {
  post: NewsPost;
  portalPhotos?: PortalPhotos;
  customPortals?: CustomPortal[];
  onUpdateImage?: (postId: string, imageUrl: string | null) => void;
  onUpdateImageFit?: (postId: string, fit: "cover" | "contain") => void;
  onDelete?: (postId: string) => void;
  onRefresh?: (postId: string) => void;
  isRefreshing?: boolean;
}

export function NoticiaPost({ post, portalPhotos, customPortals, onUpdateImage, onUpdateImageFit, onDelete, onRefresh, isRefreshing }: NoticiaPostProps) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, closeMenu]);

  const handlePickImage = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setMenuOpen(false);
    onUpdateImage?.(post.id, null);
  };

  const handleRefresh = () => {
    setMenuOpen(false);
    onRefresh?.(post.id);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm("Excluir esta manchete? Essa ação não pode ser desfeita.")) {
      onDelete?.(post.id);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setLocalImageUrl(blobUrl);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/storage/uploads/file?folder=noticias`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      const { url } = (await res.json()) as { url: string };
      if (!url) throw new Error("no url");
      onUpdateImage?.(post.id, url);
      URL.revokeObjectURL(blobUrl);
      setLocalImageUrl(null);
    } catch {
      setLocalImageUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const customPortal = post.source === "custom" && post.customPortalId
    ? customPortals?.find((p) => p.id === post.customPortalId)
    : undefined;

  const baseCfg = SOURCE_CONFIG[post.source] ?? SOURCE_CONFIG.custom;
  const cfg = baseCfg;
  const catStyle = CATEGORY_COLOR[post.category] ?? CATEGORY_COLOR.geral;
  const totalLikes = post.likes + (liked ? 1 : 0);

  const lines = post.content.split("\n");

  const postPhotoUrl = post.source === "custom"
    ? customPortal?.photo
    : (portalPhotos?.[post.source as keyof PortalPhotos] || PORTAL_DEFAULT_PHOTOS[post.source as keyof PortalPhotos]);

  const displayImageUrl = localImageUrl ?? post.imageUrl ?? null;
  const hasEditActions = !!onUpdateImage || !!onDelete || !!onRefresh;

  const lightboxPortal = lightboxOpen && displayImageUrl
    ? createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.93)" }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={displayImageUrl.startsWith("http") || displayImageUrl.startsWith("blob:") ? displayImageUrl : `/api/storage${displayImageUrl}`}
            alt="Foto completa"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            style={{ maxWidth: "92vw", maxHeight: "92vh" }}
          />
        </div>,
        document.body
      )
    : null;

  return (
    <>
    <article
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hidden file input for image editing */}
      {onUpdateImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Pencil edit button */}
      {hasEditActions && (
        <div
          ref={menuRef}
          className="absolute z-20 transition-opacity duration-150"
          style={{ bottom: 10, right: 10, opacity: hovered || menuOpen ? 1 : 0, pointerEvents: hovered || menuOpen ? "auto" : "none" }}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={uploading || isRefreshing}
            title="Editar notícia"
            className="flex items-center justify-center rounded-lg transition-all duration-150"
            style={{
              width: 28,
              height: 28,
              background: "rgba(0,0,0,0.55)",
              color: uploading || isRefreshing ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {uploading || isRefreshing ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 rounded-xl overflow-hidden shadow-2xl"
              style={{ bottom: 36, minWidth: 180, background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {onRefresh && post.matchId && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full text-left text-sm px-4 py-2.5 transition-colors duration-100 hover:bg-white/[0.06] disabled:opacity-50"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  {isRefreshing ? "Atualizando..." : "Atualizar notícia"}
                </button>
              )}
              {onUpdateImage && (
                <button
                  onClick={handlePickImage}
                  className="w-full text-left text-sm px-4 py-2.5 transition-colors duration-100 hover:bg-white/[0.06]"
                  style={{ color: "rgba(255,255,255,0.8)", borderTop: onRefresh && post.matchId ? "1px solid rgba(255,255,255,0.06)" : undefined }}
                >
                  {displayImageUrl ? "Trocar imagem" : "Adicionar imagem"}
                </button>
              )}
              {displayImageUrl && onUpdateImageFit && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Ajuste da imagem
                  </p>
                  <div className="flex gap-1.5 px-3 pb-2.5">
                    {(["cover", "contain"] as const).map((fit) => {
                      const active = (post.imageFit ?? "cover") === fit;
                      return (
                        <button
                          key={fit}
                          onClick={() => { onUpdateImageFit(post.id, fit); setMenuOpen(false); }}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all duration-150"
                          style={{
                            background: active ? "rgba(var(--club-primary-rgb),0.22)" : "rgba(255,255,255,0.06)",
                            color: active ? "var(--club-primary)" : "rgba(255,255,255,0.45)",
                            border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.45)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          {fit === "cover" ? "Preencher" : "Completo"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {displayImageUrl && (
                <button
                  onClick={handleRemoveImage}
                  className="w-full text-left text-sm px-4 py-2.5 transition-colors duration-100 hover:bg-white/[0.06]"
                  style={{ color: "#f87171", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Remover imagem
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="w-full text-left text-sm px-4 py-2.5 transition-colors duration-100 hover:bg-white/[0.06]"
                  style={{ color: "#f87171", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Excluir manchete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <SourceAvatar source={post.source} sourceName={post.sourceName} size={42} photoUrl={postPhotoUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-sm font-bold leading-tight">{post.sourceName}</span>
            {cfg.verified && (
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill={cfg.color}>
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-medium" style={{ color: cfg.color }}>
              {post.sourceHandle}
            </span>
            <span className="text-white/20 text-xs">·</span>
            <span className="text-white/30 text-xs">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {post.postTag === "rumor" && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>
              🔄 Rumor
            </span>
          )}
          {post.postTag === "leak" && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
              🔓 Bastidores
            </span>
          )}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: catStyle.bg, color: catStyle.color }}
          >
            {CATEGORY_LABEL[post.category] ?? "Geral"}
          </span>
        </div>
      </div>

      {/* Post image */}
      {displayImageUrl && (
        <div
          className="overflow-hidden relative"
          style={{ maxHeight: post.imageFit === "contain" ? undefined : 400 }}
        >
          <img
            src={displayImageUrl.startsWith("http") || displayImageUrl.startsWith("blob:") ? displayImageUrl : `/api/storage${displayImageUrl}`}
            alt="Post"
            onClick={() => setLightboxOpen(true)}
            className={`w-full cursor-zoom-in ${post.imageFit === "contain" ? "object-contain" : "object-cover"}`}
            style={{
              maxHeight: post.imageFit === "contain" ? undefined : 400,
              display: "block",
              background: post.imageFit === "contain" ? "rgba(0,0,0,0.4)" : undefined,
            }}
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4" style={{ paddingTop: displayImageUrl ? 12 : 0 }}>
        {post.title && (
          <p className="text-white font-black text-base leading-snug mb-2">{post.title}</p>
        )}
        <div className="text-white/80 text-sm leading-relaxed whitespace-pre-line">
          {lines.map((line, i) => {
            const isBold = /^[A-ZÁÉÍÓÚÃÕÇ\s!🔥🚑📺🏆⚽📊💰📋🎥📸🧠]+$/.test(line.trim()) && line.trim().length > 0 && line.trim().length < 80;
            return (
              <span key={i}>
                <span
                  className={isBold ? "text-white font-bold" : ""}
                  style={isBold ? { display: "block" } : {}}
                >
                  {line}
                </span>
                {!isBold && i < lines.length - 1 && "\n"}
              </span>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />

      {/* Engagement bar */}
      <div className="flex items-center px-4 py-3 gap-5">
        <button
          onClick={() => setLiked((l) => !l)}
          className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
          style={{ color: liked ? "#f87171" : "rgba(255,255,255,0.45)" }}
        >
          <span style={{ fontSize: 16 }}>{liked ? "❤️" : "🤍"}</span>
          <span className="text-xs font-semibold tabular-nums">{formatCount(totalLikes)}</span>
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 transition-colors duration-200"
          style={{ color: showComments ? "var(--club-primary)" : "rgba(255,255,255,0.45)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-semibold tabular-nums">{formatCount(post.commentsCount)}</span>
        </button>

        <button
          className="flex items-center gap-1.5 transition-colors duration-200"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-xs font-semibold tabular-nums">{formatCount(post.sharesCount)}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && post.comments.length > 0 && (
        <div
          className="flex flex-col gap-4 px-4 pt-2 pb-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-white/25 text-xs font-semibold uppercase tracking-wider pt-1">
            Comentários
          </p>
          {post.comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </article>

    {lightboxPortal}
    </>
  );
}
