import { useState, useEffect, useRef, useMemo } from "react";
import type { Career } from "@/types/career";
import type { NewsPost, NewsSource, NewsCategory } from "@/types/noticias";
import { getPosts, savePosts, addPost, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";
import { seedPosts } from "@/lib/noticiaSeed";
import { NoticiaPost } from "./NoticiaPost";
import { getPortalPhotos, PORTAL_PHOTOS_EVENT, type PortalPhotos } from "@/lib/portalPhotosStorage";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropModal } from "./ImageCropModal";
import type { SquadPlayer } from "@/lib/squadCache";
import type { MatchRecord } from "@/types/match";
import { buildPlayerPerformanceContext, buildPlayerContextString } from "@/lib/playerContext";
import { stepPlayerMood } from "@/lib/playerPerformanceEngine";
import { getMembers, addNotification } from "@/lib/diretoriaStorage";
import { getAllPlayerStats } from "@/lib/playerStatsStorage";

interface NoticiasViewProps {
  career: Career;
  allPlayers?: SquadPlayer[];
  matches?: MatchRecord[];
}

const NEGATIVE_KEYWORDS = [
  "terrível", "horrível", "péssimo", "péssima", "desastroso", "desastrosa",
  "falhou", "falha", "desperdiçou", "desperdiça", "errou", "perdeu",
  "gol contra", "pênalti perdido", "pênalti desperdiçado",
  "decepcionante", "decepciona", "fraco", "fraca", "ruim",
  "vaiado", "vaiada", "criticado", "criticada", "contestado", "contestada",
  "culpa", "culpado", "culpada", "responsável pelo",
];

function allIndicesOf(text: string, term: string): number[] {
  const indices: number[] = [];
  let start = 0;
  while (start < text.length) {
    const idx = text.indexOf(term, start);
    if (idx === -1) break;
    indices.push(idx);
    start = idx + 1;
  }
  return indices;
}

function scanPostForCriticism(
  content: string,
  comments: NewsPost["comments"],
  players: SquadPlayer[],
): number[] {
  const critiqued: number[] = [];
  const fullText = [content, ...comments.map((c) => c.content)].join(" ").toLowerCase();
  for (const player of players) {
    const nameParts = player.name.toLowerCase().split(" ");
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    const nameIndices: number[] = [
      ...allIndicesOf(fullText, lastName),
      ...(firstName.length > 3 ? allIndicesOf(fullText, firstName) : []),
    ];
    if (nameIndices.length === 0) continue;
    let found = false;
    for (const kw of NEGATIVE_KEYWORDS) {
      const kwIndices = allIndicesOf(fullText, kw);
      for (const kwIdx of kwIndices) {
        for (const nameIdx of nameIndices) {
          if (Math.abs(nameIdx - kwIdx) < 150) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (found) critiqued.push(player.id);
  }
  return [...new Set(critiqued)];
}

const SOURCE_LABELS: Record<NewsSource, string> = {
  tnt: "TNT Sports",
  espn: "ESPN",
  fanpage: "FanPage",
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

type AddMode = "auto" | "manual";

interface AiPreview {
  source: string;
  sourceHandle: string;
  sourceName: string;
  category: string;
  title?: string;
  content: string;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  comments: Array<{
    username: string;
    displayName: string;
    content: string;
    likes: number;
    personality?: string;
    replies?: Array<unknown>;
  }>;
}

function SourceButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150"
      style={{
        background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
        color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
        border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {label}
    </button>
  );
}

function CategoryButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150"
      style={{
        background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
        color: active ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
        border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {label}
    </button>
  );
}

function AddPostModal({
  career,
  playerContextStr,
  onClose,
  onSave,
}: {
  career: Career;
  playerContextStr?: string;
  onClose: () => void;
  onSave: (post: NewsPost) => void;
}) {
  const [mode, setMode] = useState<AddMode>("auto");

  const [aiDesc, setAiDesc] = useState("");
  const [aiSource, setAiSource] = useState<NewsSource | "auto">("auto");
  const [aiCategory, setAiCategory] = useState<NewsCategory | "auto">("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [manSource, setManSource] = useState<NewsSource>("fanpage");
  const [manCategory, setManCategory] = useState<NewsCategory>("geral");
  const [manTitle, setManTitle] = useState("");
  const [manContent, setManContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    previewUrl: imagePreviewUrl,
    objectPath: imageObjectPath,
    isUploading: isUploadingImage,
    error: imageError,
    pendingFile: imagePendingFile,
    inputRef: imageInputRef,
    openPicker: openImagePicker,
    handleFileSelect: handleImageSelect,
    confirmCrop: confirmImageCrop,
    cancelCrop: cancelImageCrop,
    reset: handleImageRemove,
  } = useImageUpload();

  useEffect(() => {
    if (mode === "manual") textareaRef.current?.focus();
  }, [mode]);

  const slug = career.clubName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const shortClub = career.clubName.split(" ").slice(0, 2).join(" ");

  const manSourceHandle =
    manSource === "tnt" ? "@tntsports" : manSource === "espn" ? "@espnbrasil" : `@${slug}oficial`;
  const manSourceName =
    manSource === "tnt" ? "TNT Sports" : manSource === "espn" ? "ESPN Brasil" : `${shortClub} Oficial`;

  const handleGenerate = async () => {
    if (!aiDesc.trim()) return;
    setIsGenerating(true);
    setAiError(null);
    setAiPreview(null);
    try {
      const userKey = getOpenAIKey();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userKey) headers["x-openai-key"] = userKey;

      const res = await fetch("/api/noticias/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          description: aiDesc.trim(),
          clubName: career.clubName,
          source: aiSource !== "auto" ? aiSource : undefined,
          category: aiCategory !== "auto" ? aiCategory : undefined,
          playersContext: playerContextStr || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        setAiError((err as { error?: string }).error ?? "Erro ao gerar notícia");
        return;
      }
      const data = (await res.json()) as AiPreview;
      setAiPreview(data);
    } catch (e) {
      setAiError("Falha na conexão com o servidor");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAi = () => {
    if (!aiPreview) return;
    const post: NewsPost = {
      id: generatePostId(),
      careerId: career.id,
      source: (aiPreview.source as NewsSource) ?? "fanpage",
      sourceHandle: aiPreview.sourceHandle,
      sourceName: aiPreview.sourceName,
      ...(aiPreview.title?.trim() ? { title: aiPreview.title.trim() } : {}),
      content: aiPreview.content,
      ...(imageObjectPath ? { imageUrl: imageObjectPath } : {}),
      likes: aiPreview.likes,
      commentsCount: aiPreview.commentsCount,
      sharesCount: aiPreview.sharesCount,
      comments: aiPreview.comments.map((c) => ({
        id: generateCommentId(),
        username: c.username,
        displayName: c.displayName,
        content: c.content,
        likes: c.likes,
        personality: (c.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
        replies: Array.isArray(c.replies)
          ? c.replies.map((r: unknown) => {
              const rc = r as typeof c;
              return {
                id: generateCommentId(),
                username: rc.username,
                displayName: rc.displayName,
                content: rc.content,
                likes: rc.likes,
                personality: (rc.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
                createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
              };
            })
          : [],
        createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
      })),
      createdAt: Date.now(),
      category: (aiPreview.category as NewsCategory) ?? "geral",
    };
    onSave(post);
    onClose();
  };

  const handlePublishManual = () => {
    if (!manContent.trim()) return;
    const post: NewsPost = {
      id: generatePostId(),
      careerId: career.id,
      source: manSource,
      sourceHandle: manSourceHandle,
      sourceName: manSourceName,
      ...(manTitle.trim() ? { title: manTitle.trim() } : {}),
      content: manContent.trim(),
      ...(imageObjectPath ? { imageUrl: imageObjectPath } : {}),
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
      category: manCategory,
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
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(18, 14, 31, 0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "92dvh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h3 className="text-white font-bold text-base">Nova Notícia</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div
          className="flex gap-1 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => setMode("auto")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              background: mode === "auto" ? "rgba(var(--club-primary-rgb),0.18)" : "transparent",
              color: mode === "auto" ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
              border: `1px solid ${mode === "auto" ? "rgba(var(--club-primary-rgb),0.35)" : "transparent"}`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Automático (IA)
          </button>
          <button
            onClick={() => setMode("manual")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              background: mode === "manual" ? "rgba(255,255,255,0.08)" : "transparent",
              color: mode === "manual" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
              border: `1px solid ${mode === "manual" ? "rgba(255,255,255,0.12)" : "transparent"}`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Manual
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
          {mode === "auto" ? (
            <div className="p-5 flex flex-col gap-4">
              {/* Description */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Descreva a notícia
                </label>
                <textarea
                  value={aiDesc}
                  onChange={(e) => { setAiDesc(e.target.value); setAiPreview(null); setAiError(null); }}
                  placeholder={`Ex: Jogador estrela se lesionou no treino e vai ficar 3 semanas fora. Detalhe que foi uma lesão muscular na coxa esquerda durante o treino de hoje de manhã.`}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none resize-none placeholder:text-white/20 leading-relaxed"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minHeight: 100,
                  }}
                />
              </div>

              {/* Source */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Portal
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setAiSource("auto")}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5"
                    style={{
                      background: aiSource === "auto" ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                      color: aiSource === "auto" ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${aiSource === "auto" ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Automático
                  </button>
                  {(["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => (
                    <SourceButton
                      key={s}
                      label={SOURCE_LABELS[s]}
                      active={aiSource === s}
                      onClick={() => setAiSource(s)}
                    />
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Categoria <span className="text-white/25 normal-case font-normal">(opcional)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setAiCategory("auto")}
                    className="py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1"
                    style={{
                      background: aiCategory === "auto" ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                      color: aiCategory === "auto" ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                      border: `1px solid ${aiCategory === "auto" ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    IA escolhe
                  </button>
                  {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((c) => (
                    <CategoryButton
                      key={c}
                      label={CATEGORY_LABELS[c]}
                      active={aiCategory === c}
                      onClick={() => setAiCategory(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Image picker */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Foto <span className="text-white/25 normal-case font-normal">(opcional)</span>
                </label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                />
                {imagePreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
                    <img src={imagePreviewUrl} alt="Preview" className="w-full object-cover" style={{ maxHeight: 200 }} />
                    {isUploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                        <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                    {!isUploadingImage && imageObjectPath && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400 text-xs font-semibold">Enviada</span>
                      </div>
                    )}
                    <button
                      onClick={handleImageRemove}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openImagePicker}
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    Adicionar foto ao post
                  </button>
                )}
                {imageError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{imageError}</p>
                )}
              </div>

              {/* Generate button */}
              {!aiPreview && (
                <button
                  onClick={handleGenerate}
                  disabled={!aiDesc.trim() || isGenerating}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "var(--club-gradient)" }}
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Gerando com IA...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      Gerar com IA
                    </>
                  )}
                </button>
              )}

              {/* Error */}
              {aiError && (
                <div
                  className="rounded-xl px-4 py-3 text-xs"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(252,165,165,0.9)" }}
                >
                  {aiError}
                </div>
              )}

              {/* Preview */}
              {aiPreview && (
                <div
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
                    >
                      {aiPreview.sourceName}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                    >
                      {CATEGORY_LABELS[(aiPreview.category as NewsCategory)] ?? aiPreview.category}
                    </span>
                    <span className="ml-auto text-white/25 text-xs">{aiPreview.comments.length} comentários gerados</span>
                  </div>
                  {aiPreview.title && (
                    <p className="text-white font-bold text-sm leading-snug">{aiPreview.title}</p>
                  )}
                  <p
                    className="text-white/70 text-xs leading-relaxed"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties}
                  >
                    {aiPreview.content}
                  </p>
                  <div className="flex gap-3 text-white/30 text-xs">
                    <span>❤️ {aiPreview.likes.toLocaleString("pt-BR")}</span>
                    <span>💬 {aiPreview.commentsCount}</span>
                    <span>↗️ {aiPreview.sharesCount}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handlePublishAi}
                      disabled={isUploadingImage}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--club-gradient)" }}
                    >
                      {isUploadingImage ? "Enviando foto..." : "Publicar notícia"}
                    </button>
                    <button
                      onClick={() => { setAiPreview(null); handleGenerate(); }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      Regenerar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-4">
              {/* Source picker */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Portal
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => (
                    <SourceButton
                      key={s}
                      label={SOURCE_LABELS[s]}
                      active={manSource === s}
                      onClick={() => setManSource(s)}
                    />
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
                    <CategoryButton
                      key={c}
                      label={CATEGORY_LABELS[c]}
                      active={manCategory === c}
                      onClick={() => setManCategory(c)}
                    />
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
                  value={manTitle}
                  onChange={(e) => setManTitle(e.target.value)}
                  placeholder="Ex: LESIONADO 🚑"
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
                  value={manContent}
                  onChange={(e) => setManContent(e.target.value)}
                  placeholder={`Escreva a notícia no estilo Instagram...\n\nEx: "LESIONADO 🚑\n\n${career.clubName} confirma lesão muscular..."`}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none resize-none placeholder:text-white/20 leading-relaxed"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minHeight: 160,
                  }}
                />
                <p className="text-white/20 text-xs mt-1.5">
                  Fonte: <span style={{ color: "rgba(var(--club-primary-rgb),0.6)" }}>{manSourceHandle}</span>
                </p>
              </div>

              {/* Image picker (manual mode) */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Foto <span className="text-white/25 normal-case font-normal">(opcional)</span>
                </label>
                {imagePreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
                    <img src={imagePreviewUrl} alt="Preview" className="w-full object-cover" style={{ maxHeight: 200 }} />
                    {isUploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                        <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                    {!isUploadingImage && imageObjectPath && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400 text-xs font-semibold">Enviada</span>
                      </div>
                    )}
                    <button
                      onClick={handleImageRemove}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openImagePicker}
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    Adicionar foto ao post
                  </button>
                )}
                {imageError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{imageError}</p>
                )}
              </div>

              <button
                onClick={handlePublishManual}
                disabled={!manContent.trim() || isUploadingImage}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--club-gradient)" }}
              >
                {isUploadingImage ? "Enviando foto..." : "Publicar notícia"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image crop modal — rendered on top of the post modal */}
      {imagePendingFile && (
        <ImageCropModal
          imageSrc={imagePendingFile.localUrl}
          fileName={imagePendingFile.file.name}
          onConfirm={confirmImageCrop}
          onCancel={cancelImageCrop}
        />
      )}
    </div>
  );
}

const SOURCE_SIDEBAR_COLOR: Record<NewsSource, { color: string; bg: string }> = {
  tnt:     { color: "#E8002D", bg: "rgba(232,0,45,0.15)" },
  espn:    { color: "#E67E22", bg: "rgba(230,126,34,0.15)" },
  fanpage: { color: "var(--club-primary)", bg: "rgba(var(--club-primary-rgb),0.15)" },
};


export function NoticiasView({ career, allPlayers = [], matches: _matches = [] }: NoticiasViewProps) {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSource, setFilterSource] = useState<NewsSource | "all">("all");
  const [filterCategory, setFilterCategory] = useState<NewsCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [portalPhotos, setPortalPhotos] = useState<PortalPhotos>(() => getPortalPhotos());

  useEffect(() => {
    const refresh = () => setPortalPhotos(getPortalPhotos());
    window.addEventListener(PORTAL_PHOTOS_EVENT, refresh);
    return () => window.removeEventListener(PORTAL_PHOTOS_EVENT, refresh);
  }, []);

  useEffect(() => {
    let stored = getPosts(career.id);
    if (stored.length === 0) {
      stored = seedPosts(career);
      savePosts(career.id, stored);
    }
    setPosts(stored);
  }, [career.id]);

  const playerContextStr = useMemo(() => {
    if (allPlayers.length === 0) return "";
    const items = buildPlayerPerformanceContext(career.id, allPlayers);
    return buildPlayerContextString(items);
  }, [career.id, allPlayers]);

  const handleSavePost = (post: NewsPost) => {
    addPost(career.id, post);
    setPosts((prev) => [post, ...prev]);
    if (allPlayers.length > 0 && (post.content || post.comments?.length)) {
      const criticised = scanPostForCriticism(post.content, post.comments ?? [], allPlayers);
      const allStats = getAllPlayerStats(career.id);
      const members = getMembers(career.id);
      const auxTecnico = members.find(
        (m) =>
          m.roleLabel.toLowerCase().includes("auxiliar") ||
          m.roleLabel.toLowerCase().includes("técnico") ||
          m.roleLabel.toLowerCase().includes("tecnico"),
      );
      const presidente = members.find((m) =>
        m.roleLabel.toLowerCase().includes("presidente"),
      );
      for (const playerId of criticised) {
        stepPlayerMood(career.id, playerId, -1);
        const stats = allStats[playerId];
        const player = allPlayers.find((p) => p.id === playerId);
        if (!stats || !player) continue;
        const isKeyPlayer =
          stats.fanMoral === "idolo" ||
          (stats.goals ?? 0) + (stats.assists ?? 0) >= 10 ||
          (stats.matchesAsStarter ?? 0) >= 10;
        if (isKeyPlayer) {
          const notifMember = auxTecnico ?? presidente;
          if (notifMember) {
            addNotification(career.id, {
              memberId: notifMember.id,
              preview: `${player.name.split(" ")[0]} está sendo criticado publicamente — precisamos conversar sobre isso.`,
              triggeredAt: Date.now(),
            });
          }
        }
      }
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = posts.filter((p) => {
    if (filterSource !== "all" && p.source !== filterSource) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (normalizedQuery) {
      const haystack = [p.title ?? "", p.content].join(" ").toLowerCase();
      const words = normalizedQuery.split(/\s+/).filter(Boolean);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
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

  const srcLabel = filterSource !== "all" ? SOURCE_LABELS[filterSource] : "";
  const catLabel = filterCategory !== "all" ? CATEGORY_LABELS[filterCategory] : "";
  const emptyLabel = (() => {
    if (normalizedQuery)
      return `Nenhuma publicação encontrada para "${searchQuery.trim()}"`;
    if (filterSource !== "all" && filterCategory !== "all")
      return `Nenhuma publicação de ${srcLabel} na categoria ${catLabel}`;
    if (filterSource !== "all") return `Nenhuma publicação de ${srcLabel} ainda`;
    if (filterCategory !== "all") return `Nenhuma publicação na categoria ${catLabel}`;
    return "Clique em \"Nova notícia\" para publicar a primeira";
  })();

  return (
    <>
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

      {/* Search bar */}
      {posts.length > 0 && (
        <div className="relative mb-4">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "rgba(255,255,255,0.25)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              caretColor: "var(--club-primary)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(var(--club-primary-rgb),0.4)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.35)" }}
              aria-label="Limpar busca"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

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
                <NoticiaPost key={post.id} post={post} portalPhotos={portalPhotos} />
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
                          {SOURCE_LABELS[id]}
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

    </div>

    {showAddModal && (
      <AddPostModal
        career={career}
        playerContextStr={playerContextStr || undefined}
        onClose={() => setShowAddModal(false)}
        onSave={handleSavePost}
      />
    )}
    </>
  );
}
