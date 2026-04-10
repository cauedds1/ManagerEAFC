import { useState, useEffect, useRef } from "react";
import type { Career } from "@/types/career";
import type { NewsPost, NewsSource, NewsCategory } from "@/types/noticias";
import { getPosts, savePosts, addPost, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { seedPosts } from "@/lib/noticiaSeed";
import { NoticiaPost } from "./NoticiaPost";

interface NoticiasViewProps {
  career: Career;
}

const SOURCE_LABELS: Record<NewsSource, string> = {
  tnt: "TNT Sports",
  espn: "ESPN Brasil",
  fanpage: "FanPage do Clube",
};

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  resultado: "Resultado",
  lesao: "Lesão",
  transferencia: "Transferência",
  renovacao: "Renovação",
  treino: "Treino",
  conquista: "Conquista",
  geral: "Geral",
};

function AddPostModal({
  career,
  onClose,
  onSave,
}: {
  career: Career;
  onClose: () => void;
  onSave: (post: NewsPost) => void;
}) {
  const [source, setSource] = useState<NewsSource>("fanpage");
  const [category, setCategory] = useState<NewsCategory>("geral");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const shortClub = career.clubName.split(" ").slice(0, 2).join(" ");
  const slug = career.clubName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

  const sourceHandle =
    source === "tnt"
      ? "@tntsports"
      : source === "espn"
      ? "@espnbrasil"
      : `@${slug}oficial`;

  const sourceName =
    source === "tnt"
      ? "TNT Sports"
      : source === "espn"
      ? "ESPN Brasil"
      : `${shortClub} Oficial`;

  const handleSave = () => {
    if (!content.trim()) return;
    const post: NewsPost = {
      id: generatePostId(),
      careerId: career.id,
      source,
      sourceHandle,
      sourceName,
      ...(title.trim() ? { title: title.trim() } : {}),
      content: content.trim(),
      likes: Math.floor(Math.random() * 5000) + 500,
      commentsCount: Math.floor(Math.random() * 300) + 20,
      sharesCount: Math.floor(Math.random() * 1000) + 100,
      comments: [
        {
          id: generateCommentId(),
          username: "@torcedordigital",
          displayName: "Torcedor Digital",
          content: "Que notícia! 🔥🔥",
          likes: 34,
          personality: "otimista",
          createdAt: Date.now() - 60_000,
        },
      ],
      createdAt: Date.now(),
      category,
    };
    onSave(post);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "rgba(18, 14, 31, 0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h3 className="text-white font-bold text-base">Nova Notícia</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Source picker */}
          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
              Portal
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: source === s ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                    color: source === s ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${source === s ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Category picker */}
          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
              Categoria
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{
                    background: category === c ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                    color: category === c ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                    border: `1px solid ${category === c ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Title (optional) */}
          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
              Título <span className="text-white/25 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ex: LESIONADO 🚑`}
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
              Legenda
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Escreva a notícia no estilo Instagram...\n\nEx: "LESIONADO 🚑\n\n${career.clubName} confirma lesão muscular..."`}
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none resize-none placeholder:text-white/20 leading-relaxed"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: 160,
              }}
            />
            <p className="text-white/20 text-xs mt-1.5">
              Fonte: <span style={{ color: "rgba(var(--club-primary-rgb),0.6)" }}>{sourceHandle}</span>
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--club-gradient)" }}
          >
            Publicar notícia
          </button>
        </div>
      </div>
    </div>
  );
}

const SOURCE_SIDEBAR_COLOR: Record<NewsSource, { color: string; bg: string }> = {
  tnt:     { color: "#E8002D", bg: "rgba(232,0,45,0.15)" },
  espn:    { color: "#E67E22", bg: "rgba(230,126,34,0.15)" },
  fanpage: { color: "var(--club-primary)", bg: "rgba(var(--club-primary-rgb),0.15)" },
};

const SOURCE_SIDEBAR_LABEL: Record<NewsSource, string> = {
  tnt:     "TNT Sports",
  espn:    "ESPN",
  fanpage: "FanPage",
};

export function NoticiasView({ career }: NoticiasViewProps) {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSource, setFilterSource] = useState<NewsSource | "all">("all");
  const [filterCategory, setFilterCategory] = useState<NewsCategory | "all">("all");

  useEffect(() => {
    let stored = getPosts(career.id);
    if (stored.length === 0) {
      stored = seedPosts(career);
      savePosts(career.id, stored);
    }
    setPosts(stored);
  }, [career.id]);

  const handleSavePost = (post: NewsPost) => {
    addPost(career.id, post);
    setPosts((prev) => [post, ...prev]);
  };

  const filtered = posts.filter((p) => {
    if (filterSource !== "all" && p.source !== filterSource) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  });

  const sourceFilters: { id: NewsSource | "all"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "fanpage", label: "FanPage" },
    { id: "tnt", label: "TNT Sports" },
    { id: "espn", label: "ESPN" },
  ];

  const sourceCounts = (["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => ({
    id: s,
    count: posts.filter((p) => p.source === s).length,
  }));
  const maxSourceCount = Math.max(1, ...sourceCounts.map((s) => s.count));

  const categoryCounts = (Object.keys(CATEGORY_LABELS) as NewsCategory[])
    .map((c) => ({ id: c, count: posts.filter((p) => p.category === c).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const emptyLabel = (() => {
    if (filterSource !== "all" && filterCategory !== "all")
      return `Nenhuma publicação de ${SOURCE_LABELS[filterSource as NewsSource]} na categoria ${CATEGORY_LABELS[filterCategory as NewsCategory]}`;
    if (filterSource !== "all")
      return `Nenhuma publicação de ${SOURCE_LABELS[filterSource as NewsSource]} ainda`;
    if (filterCategory !== "all")
      return `Nenhuma publicação na categoria ${CATEGORY_LABELS[filterCategory as NewsCategory]}`;
    return "Clique em \"Nova notícia\" para publicar a primeira";
  })();

  return (
    <div className="animate-fade-up">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">Notícias</h2>
          {posts.length > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums"
              style={{
                background: "rgba(var(--club-primary-rgb),0.15)",
                color: "var(--club-primary)",
              }}
            >
              {posts.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--club-gradient)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova notícia
        </button>
      </div>

      {/* Source filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {sourceFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterSource(f.id)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background:
                filterSource === f.id
                  ? "rgba(var(--club-primary-rgb),0.2)"
                  : "rgba(255,255,255,0.05)",
              color:
                filterSource === f.id
                  ? "var(--club-primary)"
                  : "rgba(255,255,255,0.35)",
              border: `1px solid ${
                filterSource === f.id
                  ? "rgba(var(--club-primary-rgb),0.35)"
                  : "rgba(255,255,255,0.07)"
              }`,
            }}
          >
            {f.label}
          </button>
        ))}
        {filterCategory !== "all" && (
          <button
            onClick={() => setFilterCategory("all")}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {CATEGORY_LABELS[filterCategory]}
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Feed + Sidebar layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">

        {/* Feed column */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.08)" }}
              >
                📰
              </div>
              <div>
                <p className="text-white/35 font-semibold text-sm">Nenhuma notícia ainda</p>
                <p className="text-white/20 text-xs mt-1 max-w-xs">{emptyLabel}</p>
              </div>
              {filterSource === "all" && filterCategory === "all" && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "var(--club-gradient)" }}
                >
                  + Primeira notícia
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:max-w-[560px]">
              {filtered.map((post) => (
                <NoticiaPost key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — only on lg+ when there are posts */}
        {posts.length > 0 && (
          <div className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0">

            {/* Por fonte */}
            <div
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-white/35 text-xs font-bold uppercase tracking-wider">Por fonte</p>
              <div className="flex flex-col gap-2.5">
                {sourceCounts.map(({ id, count }) => {
                  const cfg = SOURCE_SIDEBAR_COLOR[id];
                  const active = filterSource === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setFilterSource(active ? "all" : id)}
                      className="flex flex-col gap-1.5 text-left transition-all duration-150 rounded-xl p-2.5 -mx-1"
                      style={{
                        background: active ? cfg.bg : "transparent",
                        outline: "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: active ? cfg.color : "rgba(255,255,255,0.5)" }}
                        >
                          {SOURCE_SIDEBAR_LABEL[id]}
                        </span>
                        <span
                          className="text-xs font-bold tabular-nums"
                          style={{ color: active ? cfg.color : "rgba(255,255,255,0.3)" }}
                        >
                          {count}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(count / maxSourceCount) * 100}%`,
                            background: active ? cfg.color : "rgba(255,255,255,0.15)",
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Por categoria */}
            {categoryCounts.length > 0 && (
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-white/35 text-xs font-bold uppercase tracking-wider">Por categoria</p>
                <div className="flex flex-col gap-1">
                  {categoryCounts.map(({ id, count }) => {
                    const active = filterCategory === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setFilterCategory(active ? "all" : id)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 text-left"
                        style={{
                          background: active
                            ? "rgba(var(--club-primary-rgb),0.14)"
                            : "transparent",
                        }}
                      >
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: active ? "var(--club-primary)" : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {CATEGORY_LABELS[id]}
                        </span>
                        <span
                          className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                          style={{
                            background: active
                              ? "rgba(var(--club-primary-rgb),0.2)"
                              : "rgba(255,255,255,0.07)",
                            color: active ? "var(--club-primary)" : "rgba(255,255,255,0.3)",
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {showAddModal && (
        <AddPostModal
          career={career}
          onClose={() => setShowAddModal(false)}
          onSave={handleSavePost}
        />
      )}
    </div>
  );
}
