import { useState, useEffect } from "react";
import type { CommunityPost, CommunityComment } from "@/types/community";
import { getComments, addComment, deleteComment, updateComment, reportContent } from "@/lib/community";
import { FanCommentsList } from "./FanCommentsList";
import type { NewsComment } from "@/types/noticias";

interface Props {
  post: CommunityPost;
  lang: "pt" | "en";
  viewerUserId?: number;
  onClose: () => void;
}

const T = {
  pt: { title: "Comentários", placeholder: "Comentar como...", send: "Enviar", pin: "Fixar", unpin: "Desafixar", delete: "Excluir", report: "Denunciar", reasonPrompt: "Motivo:", confirmDelete: "Excluir comentário?", empty: "Seja o primeiro a comentar.", community: "Comunidade" },
  en: { title: "Comments", placeholder: "Comment as...", send: "Send", pin: "Pin", unpin: "Unpin", delete: "Delete", report: "Report", reasonPrompt: "Reason:", confirmDelete: "Delete comment?", empty: "Be the first to comment.", community: "Community" },
};

export function CommentsModal({ post, lang, viewerUserId, onClose }: Props) {
  const t = T[lang];
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    try { setComments(await getComments(post.id)); } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [post.id]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await addComment(post.id, text.trim()); setText(""); await refresh(); }
    catch (e) { window.alert((e as Error).message); }
    finally { setSending(false); }
  };

  const isPostOwner = viewerUserId === post.userId;
  const fanComments = Array.isArray((post.content as { comments?: unknown }).comments)
    ? ((post.content as { comments: NewsComment[] }).comments)
    : [];

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: "rgba(14,12,24,0.98)", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <h3 className="text-white font-bold">{t.title} ({comments.length})</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {fanComments.length > 0 && (
            <FanCommentsList comments={fanComments} lang={lang} />
          )}
          {fanComments.length > 0 && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 pt-3 border-t border-white/5">{t.community}</div>
          )}
          {loading ? (
            <div className="text-white/40 text-sm text-center py-8">…</div>
          ) : comments.length === 0 ? (
            <div className="text-white/40 text-sm text-center py-8">{t.empty}</div>
          ) : (
            comments.map((c) => {
              const isOwn = c.userId === viewerUserId;
              return (
                <div key={c.id} className="flex gap-3 items-start" style={{ background: c.isPinned ? "rgba(251,191,36,0.06)" : "transparent", padding: c.isPinned ? "10px" : "0", borderRadius: 8 }}>
                  {c.clubLogo && <img src={c.clubLogo} alt="" className="w-9 h-9 rounded-full object-contain flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)" }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-white font-bold">{c.coachName || c.username}</span>
                      <span className="text-white/35">@{c.username ?? "anon"}</span>
                      {c.isPinned && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>📌</span>}
                    </div>
                    <p className="text-white/85 text-sm mt-0.5 break-words whitespace-pre-wrap">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-white/35">
                      {isPostOwner && (
                        <button onClick={async () => { await updateComment(c.id, { isPinned: !c.isPinned }); await refresh(); }} className="hover:text-white/70">{c.isPinned ? t.unpin : t.pin}</button>
                      )}
                      {(isOwn || isPostOwner) && (
                        <button onClick={async () => { if (window.confirm(t.confirmDelete)) { await deleteComment(c.id); await refresh(); } }} className="hover:text-red-400">{t.delete}</button>
                      )}
                      {!isOwn && (
                        <button onClick={async () => { const r = window.prompt(t.reasonPrompt); if (r) { await reportContent("comment", String(c.id), r); window.alert("✓"); } }} className="hover:text-white/70">{t.report}</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-3 border-t border-white/8 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={t.placeholder}
            maxLength={280}
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: "var(--club-gradient, linear-gradient(135deg,#8b5cf6,#6366f1))" }}>
            {sending ? "…" : t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
