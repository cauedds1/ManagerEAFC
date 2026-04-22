import { useState, useEffect, useRef, useMemo } from "react";
import { NOTICIAS } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { useLang } from "@/hooks/useLang";
import { createPortal } from "react-dom";
import type { Career } from "@/types/career";
import type { NewsPost, NewsSource, NewsCategory } from "@/types/noticias";
import { getPosts, savePosts, addPost, updatePost, removePost, generatePostId, generateCommentId, deleteMediaFromR2 } from "@/lib/noticiaStorage";
import { getAiHeaders } from "@/lib/apiStorage";
import { seedPosts } from "@/lib/noticiaSeed";
import { NoticiaPost } from "./NoticiaPost";
import { fetchPortalPhotos, PORTAL_PHOTOS_EVENT, type PortalPhotos } from "@/lib/portalPhotosStorage";
import {
  fetchPortals,
  CUSTOM_PORTALS_EVENT,
  type CustomPortal,
} from "@/lib/customPortalStorage";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropModal } from "./ImageCropModal";
import type { SquadPlayer } from "@/lib/squadCache";
import type { MatchRecord } from "@/types/match";
import { getMatchResult, GOAL_TYPE_LABELS, LOCATION_LABELS } from "@/types/match";
import { getMatches as getMatchesForStorage } from "@/lib/matchStorage";
import { buildPlayerPerformanceContext, buildPlayerContextString, buildSquadOvrContext } from "@/lib/playerContext";
import { buildTeamFormContext } from "@/lib/autoNewsService";
import { stepPlayerMood } from "@/lib/playerPerformanceEngine";
import { getMembers, addNotification } from "@/lib/diretoriaStorage";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getLeaguePosition } from "@/lib/leagueStorage";
import { getTransfers } from "@/lib/transferStorage";
import { getFanMood, getFanMoodLabel } from "@/lib/fanMoodStorage";
import { getPlanLimits } from "@/lib/userPlan";

import type { Season } from "@/types/career";

interface NoticiasViewProps {
  career: Career;
  seasonId: string;
  allPlayers?: SquadPlayer[];
  matches?: MatchRecord[];
  pastSeasons?: Season[];
  isReadOnly?: boolean;
  onGenerateBackground: (params: BgGenParams) => void;
  userPlan?: "free" | "pro" | "ultra";
  aiUsageToday?: number;
  aiUsageLimit?: number;
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
  custom: "Portal Customizado",
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

export const FC_NOTICIA_GENERATED_EVENT = "fc:noticia-generated";
export interface NoticiaGeneratedDetail {
  post: NewsPost;
  seasonId: string;
}

export interface AiPreview {
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

export interface BgGenParams {
  description: string;
  source?: string;
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoKey?: string;
  customPortal?: { id: string; name: string; description?: string; tone?: string };
  attachedMatchContext?: string;
  playerContextStr?: string;
  squadOvrContext?: string;
  teamFormContext?: string;
  historicalContext?: string;
  lastMatchPlayerContext?: string;
  recentPostsContext?: { title?: string; category: string; headline: string }[];
  seasonId: string;
  careerId: string;
  lang?: Lang;
}

const LOCATION_LABELS_AI: Record<string, string> = {
  casa: "Jogo em casa (mandante — estádio do próprio clube)",
  fora: "Jogo fora de casa (visitante — estádio do adversário)",
  neutro: "Campo neutro",
};

function buildMatchContextString(match: MatchRecord, allPlayers: SquadPlayer[]): string {
  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  const result = getMatchResult(match.myScore, match.opponentScore);
  const resultLabel = result === "vitoria" ? "Vitória" : result === "derrota" ? "Derrota" : "Empate";
  const locationLabel = LOCATION_LABELS_AI[match.location] ?? LOCATION_LABELS[match.location] ?? match.location;

  const lines: string[] = [
    `Resultado: ${resultLabel} ${match.myScore}x${match.opponentScore} vs ${match.opponent}`,
    `Local: ${locationLabel}`,
    `Data: ${match.date} | Torneio: ${match.tournament}${match.stage ? ` — ${match.stage}` : ""}`,
  ];

  const goalLines: string[] = [];
  const cardLines: string[] = [];
  const injuryLines: string[] = [];

  for (const [pidStr, ps] of Object.entries(match.playerStats)) {
    const pid = Number(pidStr);
    const player = playerById.get(pid);
    if (!player) continue;
    for (const g of ps.goals) {
      const typeLabel = g.goalType ? (GOAL_TYPE_LABELS[g.goalType] ?? g.goalType) : "Gol normal";
      const assist = g.assistPlayerId ? playerById.get(g.assistPlayerId)?.name : undefined;
      goalLines.push(`  ⚽ ${player.name} (${g.minute}') — ${typeLabel}${assist ? `, assist: ${assist}` : ""}`);
    }
    if (ps.ownGoal) goalLines.push(`  🔴 ${player.name} — Gol contra${ps.ownGoalMinute ? ` (${ps.ownGoalMinute}')` : ""}`);
    if (ps.missedPenalty) goalLines.push(`  ❌ ${player.name} — Pênalti perdido${ps.missedPenaltyMinute ? ` (${ps.missedPenaltyMinute}')` : ""}`);
    if (ps.redCard) cardLines.push(`  🟥 ${player.name} — Cartão vermelho${ps.redCardMinute ? ` (${ps.redCardMinute}')` : ""}`);
    else if (ps.yellowCard2) cardLines.push(`  🟨🟨 ${player.name} — 2º amarelo${ps.yellowCard2Minute ? ` (${ps.yellowCard2Minute}')` : ""}`);
    else if (ps.yellowCard) cardLines.push(`  🟨 ${player.name} — Cartão amarelo${ps.yellowCardMinute ? ` (${ps.yellowCardMinute}')` : ""}`);
    if (ps.injured) injuryLines.push(`  🏥 ${player.name} — Lesionado${ps.injuryMinute ? ` (${ps.injuryMinute}')` : ""}`);
  }

  if (goalLines.length) lines.push("Gols e eventos:", ...goalLines);
  if (match.opponentGoals?.length) {
    const oppLines = match.opponentGoals.map((g) => `  ⚽ ${g.playerName ?? "Jogador adversário"} (${g.minute}')`);
    lines.push("Gols do adversário:", ...oppLines);
  }
  if (match.motmPlayerId) {
    const motm = playerById.get(match.motmPlayerId);
    if (motm) lines.push(`⭐ Destaque (MOTM): ${motm.name}`);
  }
  if (cardLines.length) lines.push("Cartões:", ...cardLines);
  if (injuryLines.length) lines.push("Lesões:", ...injuryLines);

  const ratedPlayers = Object.entries(match.playerStats)
    .map(([pidStr, ps]) => ({ pid: Number(pidStr), ps }))
    .filter(({ ps }) => ps.rating > 0)
    .sort((a, b) => b.ps.rating - a.ps.rating)
    .slice(0, 9);

  if (ratedPlayers.length) {
    const ratingLines = ratedPlayers.map(({ pid, ps }) => {
      const player = playerById.get(pid);
      if (!player) return null;
      const goals = ps.goals.length;
      const assists = Object.values(match.playerStats).reduce(
        (acc, s) => acc + s.goals.filter((g) => g.assistPlayerId === pid).length, 0,
      );
      return `  ${player.name}: ${ps.rating.toFixed(1)}${goals > 0 ? ` | ${goals} gol(s)` : ""}${assists > 0 ? ` | ${assists} assist(s)` : ""}`;
    }).filter(Boolean);
    lines.push("Notas dos jogadores (do melhor para o pior registrado):", ...(ratingLines as string[]));
  }

  const ms = match.matchStats;
  const statsItems = [
    ms.myShots > 0 ? `Finalizações: ${ms.myShots}` : null,
    ms.possessionPct > 0 ? `Posse: ${ms.possessionPct}%` : null,
    (ms.penaltyGoals ?? 0) > 0 ? `Gols de pênalti: ${ms.penaltyGoals}` : null,
  ].filter(Boolean);
  if (statsItems.length) lines.push(`Estatísticas da partida: ${statsItems.join(" | ")}`);

  if (match.observations?.trim()) lines.push(`Observações do treinador: "${match.observations.trim()}"`);

  return lines.join("\n");
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
  squadOvrContext,
  teamFormContext,
  historicalContext,
  lastMatchPlayerContext,
  recentPosts,
  customPortals,
  matches,
  allPlayers,
  seasonId,
  careerId,
  userPlan,
  onClose,
  onSave,
  onGenerateBackground,
  aiUsageToday,
  aiUsageLimit,
  lang = "pt",
}: {
  career: Career;
  playerContextStr?: string;
  squadOvrContext?: string;
  teamFormContext?: string;
  historicalContext?: string;
  lastMatchPlayerContext?: string;
  recentPosts?: NewsPost[];
  customPortals?: CustomPortal[];
  matches?: MatchRecord[];
  allPlayers?: SquadPlayer[];
  seasonId: string;
  careerId: string;
  userPlan?: "free" | "pro" | "ultra";
  onClose: () => void;
  onSave: (post: NewsPost) => void;
  onGenerateBackground: (params: BgGenParams) => void;
  aiUsageToday?: number;
  aiUsageLimit?: number;
  lang?: Lang;
}) {
  const tModal = NOTICIAS[lang];
  const [mode, setMode] = useState<AddMode>("auto");

  const [aiDesc, setAiDesc] = useState("");
  const [aiSource, setAiSource] = useState<string>("auto");
  const [aiCategory, setAiCategory] = useState<NewsCategory | "auto">("auto");
  const [attachedMatchId, setAttachedMatchId] = useState<string | null>(null);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  const [manSource, setManSource] = useState<NewsSource>("fanpage");
  const [manCategory, setManCategory] = useState<NewsCategory>("geral");
  const [manTitle, setManTitle] = useState("");
  const [manContent, setManContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    previewUrl: imagePreviewUrl,
    objectPath: imageObjectPath,
    objectKey: imageObjectKey,
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

  type VideoUploadState = "idle" | "uploading" | "done" | "error";
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [videoUploadState, setVideoUploadState] = useState<VideoUploadState>("idle");
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const planLimits = getPlanLimits(userPlan ?? "free");
  const canUploadVideo = planLimits.videoNewsEnabled;

  const handleVideoSelect = async (file: File) => {
    const MAX_MB = 500;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      setVideoUploadError(tModal.videoUnsupportedFormat);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setVideoUploadError(tModal.videoFileTooLarge.replace("{max}", String(MAX_MB)));
      return;
    }
    setVideoUploadState("uploading");
    setVideoUploadProgress(0);
    setVideoUploadError(null);
    try {
      const token = localStorage.getItem("fc_auth_token");

      const result = await new Promise<{ url: string; key: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setVideoUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as { url: string; key: string });
            } catch {
              reject(new Error(tModal.videoServerError));
            }
          } else {
            let errMsg = `Erro ${xhr.status}`;
            try { errMsg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? errMsg; } catch { /* noop */ }
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error(tModal.videoNetworkError));
        xhr.open("POST", "/api/storage/uploads/video?folder=noticias-video");
        xhr.setRequestHeader("Content-Type", file.type);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(file);
      });

      setVideoUrl(result.url);
      setVideoKey(result.key);
      setVideoUploadState("done");
    } catch (err) {
      setVideoUploadState("error");
      setVideoUploadError(err instanceof Error ? err.message : tModal.videoUploadFailed);
    }
  };

  const handleVideoRemove = () => {
    setVideoUrl(null);
    setVideoKey(null);
    setVideoUploadState("idle");
    setVideoUploadProgress(0);
    setVideoUploadError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  useEffect(() => {
    if (mode === "manual") textareaRef.current?.focus();
  }, [mode]);

  const slug = career.clubName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const shortClub = career.clubName.split(" ").slice(0, 2).join(" ");

  const manSourceHandle =
    manSource === "tnt" ? "@tntsports" : manSource === "espn" ? (lang === "en" ? "@espn" : "@espnbrasil") : `@${slug}oficial`;
  const manSourceName =
    manSource === "tnt" ? "TNT Sports" : manSource === "espn" ? (lang === "en" ? "ESPN" : "ESPN Brasil") : `${shortClub} Oficial`;

  const selectedCustomPortal = aiSource !== "auto" && aiSource !== "tnt" && aiSource !== "espn" && aiSource !== "fanpage"
    ? customPortals?.find((p) => p.id === aiSource)
    : undefined;

  const attachedMatch = attachedMatchId ? (matches ?? []).find((m) => m.id === attachedMatchId) : null;

  const handleBgGenerate = () => {
    if (!aiDesc.trim()) return;
    const isCustom = !!selectedCustomPortal;
    const matchCtx = attachedMatch && allPlayers
      ? buildMatchContextString(attachedMatch, allPlayers)
      : undefined;
    const recentPostsCtx = recentPosts?.slice(0, 6).map((p) => ({
      title: p.title,
      category: p.category,
      headline: p.content.split("\n").find((l) => l.trim().length > 10)?.trim().slice(0, 120) ?? p.content.slice(0, 120),
    }));
    onGenerateBackground({
      description: aiDesc.trim(),
      source: !isCustom && aiSource !== "auto" ? aiSource : undefined,
      category: aiCategory !== "auto" ? aiCategory : undefined,
      imageUrl: imageObjectPath || undefined,
      videoUrl: videoUrl || undefined,
      videoKey: videoKey ?? undefined,
      customPortal: isCustom ? {
        id: selectedCustomPortal.id,
        name: selectedCustomPortal.name,
        description: selectedCustomPortal.description,
        tone: selectedCustomPortal.tone,
      } : undefined,
      attachedMatchContext: matchCtx,
      playerContextStr: playerContextStr || undefined,
      squadOvrContext: squadOvrContext || undefined,
      teamFormContext: teamFormContext || undefined,
      historicalContext: historicalContext || undefined,
      lastMatchPlayerContext: lastMatchPlayerContext || undefined,
      recentPostsContext: recentPostsCtx,
      seasonId,
      careerId,
      lang,
    });
    onClose();
  };

  const isSubmittingRef = useRef(false);

  const handlePublishManual = () => {
    if (isSubmittingRef.current || !manContent.trim()) return;
    isSubmittingRef.current = true;
    const post: NewsPost = {
      id: generatePostId(),
      careerId: career.id,
      source: manSource,
      sourceHandle: manSourceHandle,
      sourceName: manSourceName,
      ...(manTitle.trim() ? { title: manTitle.trim() } : {}),
      content: manContent.trim(),
      ...(imageObjectPath ? { imageUrl: imageObjectPath, imageKey: imageObjectKey ?? undefined } : {}),
      ...(videoUrl ? { videoUrl, videoKey: videoKey ?? undefined } : {}),
      likes: Math.floor(Math.random() * 5000) + 500,
      commentsCount: Math.floor(Math.random() * 300) + 20,
      sharesCount: Math.floor(Math.random() * 1000) + 100,
      comments: [
        {
          id: generateCommentId(),
          username: "@torcedordigital",
          displayName: tModal.fanDisplayName,
          content: tModal.fanDefaultComment,
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
          <h3 className="text-white font-bold text-base">{tModal.modalTitle}</h3>
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
            {tModal.modeAuto}
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
            {tModal.modeManual}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
          {mode === "auto" ? (
            <div className="p-5 flex flex-col gap-4">
              {/* Description */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelDescription}
                </label>
                <textarea
                  value={aiDesc}
                  onChange={(e) => { setAiDesc(e.target.value); }}
                  placeholder={tModal.descPlaceholder}
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
                  {tModal.labelPortal}
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setAiSource("auto")}
                    className="py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5"
                    style={{
                      background: aiSource === "auto" ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                      color: aiSource === "auto" ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${aiSource === "auto" ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    {tModal.btnAutoPortal}
                  </button>
                  {(["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => (
                    <SourceButton
                      key={s}
                      label={SOURCE_LABELS[s]}
                      active={aiSource === s}
                      onClick={() => setAiSource(s)}
                    />
                  ))}
                  {(customPortals ?? []).map((cp) => (
                    <SourceButton
                      key={cp.id}
                      label={cp.name}
                      active={aiSource === cp.id}
                      onClick={() => setAiSource(cp.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelCategory} <span className="text-white/25 normal-case font-normal">{tModal.labelCategoryOptional}</span>
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
                    {tModal.btnAiCategory}
                  </button>
                  {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((c) => (
                    <CategoryButton
                      key={c}
                      label={tModal[`cat${c.charAt(0).toUpperCase() + c.slice(1)}` as keyof typeof tModal] as string ?? CATEGORY_LABELS[c]}
                      active={aiCategory === c}
                      onClick={() => setAiCategory(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Attached match */}
              {(matches ?? []).length > 0 && (
                <div>
                  <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                    {tModal.labelAttachMatch} <span className="text-white/25 normal-case font-normal">{tModal.labelAttachMatchOptional}</span>
                  </label>
                  {attachedMatch ? (
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
                    >
                      <span className="text-base flex-shrink-0">
                        {getMatchResult(attachedMatch.myScore, attachedMatch.opponentScore) === "vitoria" ? "🟢" : getMatchResult(attachedMatch.myScore, attachedMatch.opponentScore) === "derrota" ? "🔴" : "⚪"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/85 text-xs font-semibold truncate">
                          {attachedMatch.myScore}x{attachedMatch.opponentScore} vs {attachedMatch.opponent}
                        </div>
                        <div className="text-white/35 text-[10px] truncate">
                          {attachedMatch.tournament}{attachedMatch.stage ? ` — ${attachedMatch.stage}` : ""} · {attachedMatch.date}
                        </div>
                      </div>
                      <button
                        onClick={() => setAttachedMatchId(null)}
                        className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                        title={tModal.removeMatch}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setShowMatchPicker((v) => !v)}
                        className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px dashed rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {tModal.btnAttachMatch}
                      </button>
                      {showMatchPicker && (
                        <div
                          className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
                          style={{
                            background: "rgba(20,16,36,0.98)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {[...(matches ?? [])].sort((a, b) => b.createdAt - a.createdAt).map((m) => {
                            const res = getMatchResult(m.myScore, m.opponentScore);
                            const icon = res === "vitoria" ? "🟢" : res === "derrota" ? "🔴" : "⚪";
                            return (
                              <button
                                key={m.id}
                                onClick={() => { setAttachedMatchId(m.id); setShowMatchPicker(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                              >
                                <span className="text-sm flex-shrink-0">{icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white/80 text-xs font-semibold truncate">
                                    {m.myScore}x{m.opponentScore} vs {m.opponent}
                                  </div>
                                  <div className="text-white/30 text-[10px] truncate">
                                    {m.tournament}{m.stage ? ` — ${m.stage}` : ""} · {m.date}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Image picker */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelPhoto} <span className="text-white/25 normal-case font-normal">{tModal.labelPhotoOptional}</span>
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
                        <span className="text-green-400 text-xs font-semibold">{tModal.imageUploaded}</span>
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
                    {tModal.photoAddToPost}
                  </button>
                )}
                {imageError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{imageError}</p>
                )}
              </div>

              {/* Video picker (auto mode) */}
              <div>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoSelect(f); }}
                />
                {!canUploadVideo ? (
                  <div
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                    style={{ background: "rgba(245,158,11,0.05)", border: "1px dashed rgba(245,158,11,0.25)", color: "rgba(245,158,11,0.55)", cursor: "not-allowed" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {tModal.videoUnlockUltra}
                  </div>
                ) : videoUploadState === "idle" && !videoUrl ? (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {tModal.videoAddOptional}
                  </button>
                ) : videoUploadState === "done" && videoUrl ? (
                    <div className="rounded-xl border border-emerald-500/30 p-3 flex items-center gap-3" style={{ background: "rgba(16,185,129,0.06)" }}>
                      <video
                        src={`${videoUrl}#t=0.1`}
                        className="w-14 h-10 rounded-lg object-cover flex-shrink-0"
                        preload="metadata"
                        muted
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-emerald-300 text-xs font-semibold">{tModal.videoReady}</p>
                        <p className="text-white/40 text-xs truncate">{videoUrl.split("/").pop()}</p>
                      </div>
                      <button
                        onClick={handleVideoRemove}
                        className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : videoUploadState === "uploading" ? (
                    <div className="rounded-xl border border-white/10 p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">{tModal.videoUploading}</span>
                        <span className="text-purple-300 text-xs font-bold">{videoUploadProgress}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${videoUploadProgress}%`, background: "var(--club-primary, #7c5cfc)" }} />
                      </div>
                    </div>
                ) : null}
                {videoUploadError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{videoUploadError}</p>
                )}
              </div>

              {/* AI usage counter */}
              {aiUsageLimit !== undefined && aiUsageLimit !== Infinity && (() => {
                const used = aiUsageToday ?? 0;
                const remaining = Math.max(0, aiUsageLimit - used);
                const isAtLimit = used >= aiUsageLimit;
                const pct = Math.min(100, (used / aiUsageLimit) * 100);
                return (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs" style={{ color: isAtLimit ? "#f87171" : "rgba(255,255,255,0.4)" }}>
                        {isAtLimit
                          ? tModal.aiLimitReached
                          : tModal.aiRemaining.replace("{remaining}", String(remaining)).replace("{total}", String(aiUsageLimit))}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: isAtLimit ? "#f87171" : "rgba(255,255,255,0.35)" }}>
                        {used}/{aiUsageLimit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: isAtLimit ? "#f87171" : "var(--club-primary)" }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Generate button or limit CTA */}
              {aiUsageLimit !== undefined && (aiUsageToday ?? 0) >= aiUsageLimit ? (
                <div className="flex flex-col gap-2">
                  <div className="w-full py-3 rounded-xl text-xs font-semibold text-center" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                    {tModal.aiLimitReachedFull}
                  </div>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem("fc_auth_token");
                      if (!token) return;
                      try {
                        const priceRes = await fetch("/api/stripe/products-with-plan", { headers: { Authorization: `Bearer ${token}` } });
                        if (!priceRes.ok) return;
                        const prices = await priceRes.json() as Array<{ planTier: string; priceId: string; currency: string }>;
                        const targetCurrency = (lang ?? "pt") === "pt" ? "brl" : "usd";
                        const exactMatch = prices.find(p => p.planTier === "pro" && p.currency === targetCurrency);
                        if (!exactMatch && targetCurrency === "usd") {
                          console.warn("[NoticiasView] No USD price found for pro, falling back to BRL");
                        }
                        const match = exactMatch ?? prices.find(p => p.planTier === "pro");
                        if (!match?.priceId) return;
                        const checkoutRes = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ priceId: match.priceId }),
                        });
                        if (!checkoutRes.ok) return;
                        const { url } = await checkoutRes.json() as { url?: string };
                        if (url) window.location.href = url;
                      } catch {}
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: "rgba(124,92,252,0.12)", border: "1px solid rgba(124,92,252,0.25)", color: "#a78bfa" }}
                  >
                    {tModal.upgradeCtaBtn}
                  </button>
                </div>
              ) : (
              <button
                onClick={handleBgGenerate}
                disabled={!aiDesc.trim() || isUploadingImage}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "var(--club-gradient)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {isUploadingImage ? `${tModal.btnGenerate}...` : tModal.btnGenerate}
              </button>
              )}
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-4">
              {/* Source picker */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelPortal}
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
                  {tModal.labelCategory}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((c) => (
                    <CategoryButton
                      key={c}
                      label={tModal[`cat${c.charAt(0).toUpperCase() + c.slice(1)}` as keyof typeof tModal] as string ?? CATEGORY_LABELS[c]}
                      active={manCategory === c}
                      onClick={() => setManCategory(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Title (optional) */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelTitle} <span className="text-white/25 normal-case font-normal">{tModal.labelTitleOptional}</span>
                </label>
                <input
                  type="text"
                  value={manTitle}
                  onChange={(e) => setManTitle(e.target.value)}
                  placeholder={tModal.manTitlePlaceholder}
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
                  {tModal.labelContent}
                </label>
                <textarea
                  ref={textareaRef}
                  value={manContent}
                  onChange={(e) => setManContent(e.target.value)}
                  placeholder={tModal.manContentPlaceholder.replace("{club}", career.clubName)}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none resize-none placeholder:text-white/20 leading-relaxed"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minHeight: 160,
                  }}
                />
                <p className="text-white/20 text-xs mt-1.5">
                  {tModal.labelSourcePrefix} <span style={{ color: "rgba(var(--club-primary-rgb),0.6)" }}>{manSourceHandle}</span>
                </p>
              </div>

              {/* Image picker (manual mode) */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {tModal.labelPhoto} <span className="text-white/25 normal-case font-normal">{tModal.labelPhotoOptional}</span>
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
                        <span className="text-green-400 text-xs font-semibold">{tModal.imageUploaded}</span>
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
                    {tModal.menuAddImage}
                  </button>
                )}
                {imageError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{imageError}</p>
                )}
              </div>

              {/* Video picker (manual mode) */}
              <div>
                <label className="text-white/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-2">
                  {tModal.labelVideo} <span className="text-white/25 normal-case font-normal">{tModal.labelPhotoOptional}</span>
                  {!canUploadVideo && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      {tModal.videoOnlyUltra}
                    </span>
                  )}
                </label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoSelect(f); }}
                />
                {!canUploadVideo ? (
                  <div
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                    style={{ background: "rgba(245,158,11,0.05)", border: "1px dashed rgba(245,158,11,0.25)", color: "rgba(245,158,11,0.55)", cursor: "not-allowed" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {tModal.videoUnlockUltra}
                  </div>
                ) : videoUploadState === "done" && videoUrl ? (
                  <div
                    className="relative rounded-xl overflow-hidden"
                    style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <video
                      src={`${videoUrl}#t=0.1`}
                      muted
                      preload="metadata"
                      className="w-full object-cover rounded-xl"
                      style={{ maxHeight: 160, display: "block" }}
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400 text-xs font-semibold">{tModal.videoUploaded}</span>
                    </div>
                    <button
                      onClick={handleVideoRemove}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : videoUploadState === "uploading" ? (
                  <div
                    className="w-full py-4 px-4 rounded-xl flex flex-col gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-xs">{tModal.videoUploading}</span>
                      <span className="text-white/40 text-xs font-semibold">{videoUploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${videoUploadProgress}%`, background: "var(--club-primary)" }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {tModal.videoAddToPost}
                  </button>
                )}
                {videoUploadError && (
                  <p className="text-red-400/80 text-xs mt-1.5">{videoUploadError}</p>
                )}
              </div>

              <button
                onClick={handlePublishManual}
                disabled={!manContent.trim() || isUploadingImage || videoUploadState === "uploading"}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--club-gradient)" }}
              >
                {isUploadingImage ? tModal.photoUploading : videoUploadState === "uploading" ? tModal.videoUploading : tModal.btnPublish}
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

const SOURCE_SIDEBAR_COLOR: Record<string, { color: string; bg: string }> = {
  tnt:     { color: "#E8002D",            bg: "rgba(232,0,45,0.15)" },
  espn:    { color: "#E67E22",            bg: "rgba(230,126,34,0.15)" },
  fanpage: { color: "var(--club-primary)", bg: "rgba(var(--club-primary-rgb),0.15)" },
  custom:  { color: "#a78bfa",            bg: "rgba(167,139,250,0.15)" },
};
const CUSTOM_SIDEBAR_COLOR = { color: "#a78bfa", bg: "rgba(167,139,250,0.15)" };


export function NoticiasView({ career, seasonId, allPlayers = [], matches: _matches = [], pastSeasons = [], isReadOnly, onGenerateBackground, userPlan, aiUsageToday, aiUsageLimit }: NoticiasViewProps) {
  const [lang] = useLang();
  const t = NOTICIAS[lang];

  const getCategoryLabels = (): Record<NewsCategory, string> => ({
    resultado: t.catResultado,
    lesao: t.catLesao,
    transferencia: t.catTransferencia,
    renovacao: t.catRenovacao,
    treino: t.catTreino,
    conquista: t.catConquista,
    geral: t.catGeral,
  });
  const getSourceLabels = (): Record<NewsSource, string> => ({
    tnt: "TNT Sports",
    espn: "ESPN",
    fanpage: "FanPage",
    custom: t.srcCustomPortal,
  });

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<NewsCategory | "all">("all");
  const [filterOnlyWithImages, setFilterOnlyWithImages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [portalPhotos, setPortalPhotos] = useState<PortalPhotos>({});
  const [customPortals, setCustomPortals] = useState<CustomPortal[]>([]);
  const [refreshingPostId, setRefreshingPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchPortalPhotos(career.id).then(setPortalPhotos);
    const refresh = () => { fetchPortalPhotos(career.id).then(setPortalPhotos); };
    window.addEventListener(PORTAL_PHOTOS_EVENT, refresh);
    return () => window.removeEventListener(PORTAL_PHOTOS_EVENT, refresh);
  }, [career.id]);

  useEffect(() => {
    fetchPortals(career.id).then(setCustomPortals);
    const refresh = () => { fetchPortals(career.id).then(setCustomPortals); };
    window.addEventListener(CUSTOM_PORTALS_EVENT, refresh);
    return () => window.removeEventListener(CUSTOM_PORTALS_EVENT, refresh);
  }, [career.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { post, seasonId: genSeasonId } = (e as CustomEvent<NoticiaGeneratedDetail>).detail;
      if (genSeasonId !== seasonId) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
      if (allPlayers.length > 0 && (post.content || post.comments?.length)) {
        const criticised = scanPostForCriticism(post.content, post.comments ?? [], allPlayers);
        const allStats = getAllPlayerStats(seasonId);
        const members = getMembers(career.id);
        const auxTecnico = members.find(
          (m) =>
            m.roleLabel.toLowerCase().includes("auxiliar") ||
            m.roleLabel.toLowerCase().includes("técnico") ||
            m.roleLabel.toLowerCase().includes("tecnico"),
        );
        const presidente = members.find((m) => m.roleLabel.toLowerCase().includes("presidente"));
        for (const playerId of criticised) {
          stepPlayerMood(seasonId, playerId, -1);
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
    window.addEventListener(FC_NOTICIA_GENERATED_EVENT, handler);
    return () => window.removeEventListener(FC_NOTICIA_GENERATED_EVENT, handler);
  }, [seasonId, allPlayers, career.id]);

  useEffect(() => {
    let stored = getPosts(seasonId);
    const isFirstSeed = stored.length === 0;
    if (isFirstSeed) {
      stored = seedPosts(career);
      savePosts(seasonId, stored);
    }
    setPosts(stored);

    const welcomeKey = `fc-welcome-done-${seasonId}`;
    const welcomePendingKey = `fc-welcome-pending-${seasonId}`;
    const alreadyDone = !!localStorage.getItem(welcomeKey);
    const alreadyPending = !!localStorage.getItem(welcomePendingKey);
    const isFirstCareerSeason = pastSeasons.length === 0;
    if (isFirstSeed && isFirstCareerSeason && !alreadyDone && !alreadyPending) {
      localStorage.setItem(welcomePendingKey, "1");
      fetch("/api/noticias/generate-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachName: career.coach.name,
          coachAge: career.coach.age,
          coachNationality: career.coach.nationality,
          clubName: career.clubName,
          clubLeague: career.clubLeague || undefined,
          clubDescription: career.clubDescription || undefined,
          projeto: career.projeto || undefined,
          lang: localStorage.getItem("fc_lang") || "pt",
        }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          localStorage.removeItem(welcomePendingKey);
          if (!data || typeof data.content !== "string" || !data.content.trim()) return;
          const current = getPosts(seasonId);
          const hasWelcome = current.some((p) => p.source === "espn" && p.category === "geral" && p.createdAt > Date.now() - 60_000);
          if (hasWelcome) { localStorage.setItem(welcomeKey, "1"); return; }
          const welcomePost: NewsPost = {
            id: generatePostId(),
            careerId: career.id,
            source: (data.source as NewsSource) ?? "espn",
            sourceHandle: data.sourceHandle ?? "@espnbrasil",
            sourceName: data.sourceName ?? "ESPN Brasil",
            ...(data.title?.trim() ? { title: data.title.trim() } : {}),
            content: data.content as string,
            likes: Number(data.likes) || 8000,
            commentsCount: Number(data.commentsCount) || 400,
            sharesCount: Number(data.sharesCount) || 1200,
            comments: Array.isArray(data.comments)
              ? (data.comments as Array<{
                  username: string;
                  displayName: string;
                  content: string;
                  likes: number;
                  personality?: string;
                  replies?: Array<unknown>;
                }>).map((c) => ({
                  id: generateCommentId(),
                  username: c.username,
                  displayName: c.displayName,
                  content: c.content,
                  likes: c.likes,
                  personality: (c.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
                  replies: Array.isArray(c.replies)
                    ? (c.replies as Array<Record<string, unknown>>).map((r) => ({
                        id: generateCommentId(),
                        username: r.username as string,
                        displayName: r.displayName as string,
                        content: r.content as string,
                        likes: Number(r.likes) || 10,
                        personality: (r.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
                        createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
                      }))
                    : [],
                  createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
                }))
              : [],
            createdAt: Date.now(),
            category: (data.category as NewsPost["category"]) ?? "geral",
          };
          localStorage.setItem(welcomeKey, "1");
          const freshPosts = getPosts(seasonId);
          const updated = [welcomePost, ...freshPosts];
          savePosts(seasonId, updated);
          setPosts(updated);
        })
        .catch(() => { localStorage.removeItem(welcomePendingKey); });
    }
  }, [seasonId]);

  const playerContextStr = useMemo(() => {
    if (allPlayers.length === 0) return "";
    const items = buildPlayerPerformanceContext(seasonId, allPlayers, career.id);
    return buildPlayerContextString(items);
  }, [seasonId, allPlayers, career.id]);

  const squadOvrContext = useMemo(() => {
    if (allPlayers.length === 0) return "";
    const overrides = getAllPlayerOverrides(career.id);
    return buildSquadOvrContext(allPlayers, overrides);
  }, [allPlayers, career.id]);

  const teamFormContext = useMemo(() => {
    if (_matches.length === 0) return "";
    return buildTeamFormContext(_matches);
  }, [_matches]);

  const lastMatchPlayerContext = useMemo(() => {
    if (_matches.length === 0 || allPlayers.length === 0) return "";
    const lastMatch = _matches[_matches.length - 1];
    if (!lastMatch.playerStats || Object.keys(lastMatch.playerStats).length === 0) return "";

    const allStats = getAllPlayerStats(seasonId);

    // Count assists per player from all goals in this match
    const assistCounts: Record<number, number> = {};
    for (const mStat of Object.values(lastMatch.playerStats)) {
      for (const goal of mStat.goals ?? []) {
        if (goal.assistPlayerId) {
          assistCounts[goal.assistPlayerId] = (assistCounts[goal.assistPlayerId] ?? 0) + 1;
        }
      }
    }

    const lines: string[] = [];

    for (const [playerIdStr, matchStat] of Object.entries(lastMatch.playerStats)) {
      const playerId = Number(playerIdStr);
      const player = allPlayers.find((p) => p.id === playerId);
      if (!player) continue;

      const matchRating = matchStat.rating;
      if (!matchRating || matchRating <= 0) continue;

      const pos = player.positionPtBr ?? player.position ?? "?";
      const goals = (matchStat.goals ?? []).length;
      const assists = assistCounts[playerId] ?? 0;
      const isMOTM = lastMatch.motmPlayerId === playerId;
      const isSub = matchStat.startedOnBench;
      const injured = matchStat.injured;
      const redCard = matchStat.redCard;
      const ownGoal = matchStat.ownGoal;

      const seasonStats = allStats[playerId];
      const ratings = seasonStats?.recentRatings ?? [];
      // recentRatings already includes this match (last entry) — compare vs prior history
      const prevRatings = ratings.slice(0, -1);
      const seasonAvg = prevRatings.length >= 3
        ? Math.round((prevRatings.reduce((a, b) => a + b, 0) / prevRatings.length) * 10) / 10
        : null;

      const parts: string[] = [];
      if (goals > 0) parts.push(`${goals} gol(s)`);
      if (assists > 0) parts.push(`${assists} assist.`);
      if (ownGoal) parts.push("gol contra");
      if (redCard) parts.push("expulso");
      if (injured) parts.push("saiu lesionado");
      if (isMOTM) parts.push("MOTM ⭐");
      const statsStr = parts.length > 0 ? ` | ${parts.join(", ")}` : "";
      const subLabel = isSub ? " (sub)" : "";

      let expectationTag = "";
      if (seasonAvg !== null) {
        const delta = matchRating - seasonAvg;
        // Classify the delta relative to the player's own baseline
        if (delta <= -2.0 && seasonAvg >= 7.8) {
          expectationTag = "DECEPÇÃO: estrela de alto nível muito abaixo do seu padrão — torcida pode cobrar";
        } else if (delta <= -1.5 && seasonAvg >= 7.0) {
          expectationTag = "ABAIXO DO ESPERADO: jogador acima da média que rendeu menos do que de costume";
        } else if (delta <= -1.2 && seasonAvg >= 6.5) {
          expectationTag = "levemente abaixo do padrão habitual";
        } else if (delta >= 2.0 && seasonAvg < 6.5) {
          expectationTag = "SURPRESA GRANDE: jogador de nível baixo/médio com atuação extraordinária — torcida surpreendida";
        } else if (delta >= 1.5 && seasonAvg < 7.0) {
          expectationTag = "SURPRESA POSITIVA: acima do que se esperava deste jogador";
        } else if (delta >= 1.5 && seasonAvg >= 7.0) {
          expectationTag = "atuação de alto nível, consistente com padrão de jogador experiente";
        } else if (matchRating >= 8.5) {
          expectationTag = "atuação excepcional, dentro do esperado para um jogador deste nível";
        } else if (matchRating < 6.0) {
          expectationTag = "atuação fraca, mas dentro do padrão deste jogador";
        } else {
          expectationTag = "dentro do esperado";
        }
        lines.push(
          `• ${player.name} (${pos})${subLabel}: nota ${matchRating.toFixed(1)} | média anterior ${seasonAvg.toFixed(1)} → ${expectationTag}${statsStr}`
        );
      } else {
        // Not enough history — only include if rating is very notable
        if (matchRating >= 8.0 || matchRating <= 5.5 || isMOTM || goals > 0) {
          const notableStr = matchRating >= 8.5 ? "atuação de alto nível"
            : matchRating <= 5.5 ? "atuação fraca"
            : matchRating >= 7.5 ? "boa atuação"
            : "atuação regular";
          lines.push(`• ${player.name} (${pos})${subLabel}: nota ${matchRating.toFixed(1)} — ${notableStr}${statsStr}`);
        }
      }
    }

    if (lines.length === 0) return "";

    const result = lastMatch.myScore > lastMatch.opponentScore ? "vitória"
      : lastMatch.myScore < lastMatch.opponentScore ? "derrota"
      : "empate";

    return [
      `Atuações individuais — última partida vs ${lastMatch.opponent} (${result} ${lastMatch.myScore}-${lastMatch.opponentScore}, ${lastMatch.tournament}):`,
      ...lines,
    ].join("\n");
  }, [_matches, allPlayers, seasonId]);

  const historicalContext = useMemo(() => {
    if (pastSeasons.length === 0) return undefined;
    const lines = pastSeasons.map((s) => {
      const parts: string[] = [`Temporada ${s.label}:`];
      const ms = getMatchesForStorage(s.id);
      if (ms.length > 0) {
        const wins = ms.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "vitoria").length;
        const draws = ms.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "empate").length;
        const losses = ms.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "derrota").length;
        parts.push(`${wins}V ${draws}E ${losses}D (${ms.length} partidas)`);
      }
      const league = getLeaguePosition(s.id);
      if (league) {
        parts.push(`${league.position}º/${league.totalTeams} na liga (${league.points} pts)`);
      }
      const statsArr = Object.values(getAllPlayerStats(s.id));
      if (statsArr.length > 0) {
        const topScorer = [...statsArr].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
        if (topScorer && (topScorer.goals ?? 0) > 0) {
          parts.push(`Artilheiro: ${topScorer.playerName} (${topScorer.goals} gols)`);
        }
        const topAssists = [...statsArr].sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0];
        if (topAssists && (topAssists.assists ?? 0) > 0 && topAssists.playerName !== topScorer?.playerName) {
          parts.push(`Maior assistente: ${topAssists.playerName} (${topAssists.assists} ass.)`);
        }
      }
      const transfers = getTransfers(s.id);
      const bigBuys = transfers
        .filter((t) => (!t.type || t.type === "compra") && t.fee > 0)
        .sort((a, b) => b.fee - a.fee)
        .slice(0, 2);
      const bigSales = transfers
        .filter((t) => t.type === "venda" && t.fee > 0)
        .sort((a, b) => b.fee - a.fee)
        .slice(0, 1);
      if (bigBuys.length > 0) {
        const names = bigBuys.map((t) => `${t.playerName} (€${(t.fee / 1e6).toFixed(1)}M)`).join(", ");
        parts.push(`Contratações: ${names}`);
      }
      if (bigSales.length > 0) {
        const names = bigSales.map((t) => `${t.playerName} (€${(t.fee / 1e6).toFixed(1)}M)`).join(", ");
        parts.push(`Vendas: ${names}`);
      }
      return parts.join(" | ");
    });
    return `Histórico de temporadas anteriores do clube:\n${lines.join("\n")}`;
  }, [pastSeasons]);

  const handleUpdateImage = (postId: string, imageUrl: string | null, imageKey?: string | null) => {
    const post = posts.find((p) => p.id === postId);
    if (post?.imageKey) {
      deleteMediaFromR2(post.imageKey);
    }
    updatePost(seasonId, postId, { imageUrl: imageUrl ?? undefined, imageKey: imageKey ?? undefined });
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, imageUrl: imageUrl ?? undefined, imageKey: imageKey ?? undefined } : p));
  };

  const handleUpdateImageFit = (postId: string, fit: "cover" | "contain") => {
    updatePost(seasonId, postId, { imageFit: fit });
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, imageFit: fit } : p));
  };

  const handleDeletePost = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (post?.videoKey || post?.imageKey) {
      await deleteMediaFromR2(post.imageKey, post.videoKey);
    }
    removePost(seasonId, postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleRefreshPost = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.matchId || refreshingPostId) return;
    const match = _matches.find((m) => m.id === post.matchId);
    if (!match) {
      window.alert(NOTICIAS[localStorage.getItem("fc_lang") as Lang || "pt"]?.alertMatchNotFound);
      return;
    }
    setRefreshingPostId(postId);
    try {
      const matchCtx = buildMatchContextString(match, allPlayers);
      const recentPostsCtx = posts
        .filter((p) => p.id !== postId)
        .slice(0, 6)
        .map((p) => ({
          title: p.title,
          category: p.category,
          headline: p.content.split("\n").find((l) => l.trim().length > 10)?.trim().slice(0, 120) ?? p.content.slice(0, 120),
        }));
      const customPortal = post.source === "custom" && post.customPortalId
        ? customPortals.find((p) => p.id === post.customPortalId)
        : undefined;
      const fanMoodScore = getFanMood(seasonId);
      const fanMoodInfo = getFanMoodLabel(fanMoodScore);
      const headers = getAiHeaders();
      const res = await fetch("/api/noticias/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          description: [
            "Atualize/refaça esta mesma notícia usando os dados atuais e corrigidos da partida vinculada.",
            "Se o placar, resultado, gols, pênaltis, expulsões ou destaques mudaram, corrija a narrativa inteira.",
            "Mantenha o mesmo tipo de publicação e o mesmo portal da notícia original, mas gere texto e comentários novos coerentes com a partida atualizada.",
            `Notícia original: ${post.title ? `${post.title} — ` : ""}${post.content}`,
          ].join("\n"),
          clubName: career.clubName,
          season: career.season,
          source: post.source !== "custom" ? post.source : undefined,
          category: post.category,
          clubLeague: career.clubLeague || undefined,
          clubDescription: career.clubDescription || undefined,
          projeto: career.projeto || undefined,
          playersContext: playerContextStr || undefined,
          squadOvrContext: squadOvrContext || undefined,
          teamFormContext: buildTeamFormContext(_matches, match) || undefined,
          historicalContext: historicalContext || undefined,
          attachedMatchContext: matchCtx,
          fanMoodScore,
          fanMoodLabel: `${fanMoodInfo.emoji} ${fanMoodInfo.label}`,
          recentPostsContext: recentPostsCtx.length > 0 ? recentPostsCtx : undefined,
          customPortal: customPortal ? {
            id: customPortal.id,
            name: customPortal.name,
            description: customPortal.description,
            tone: customPortal.tone,
          } : undefined,
          lang: localStorage.getItem("fc_lang") || "pt",
        }),
      });
      if (!res.ok) throw new Error(NOTICIAS[localStorage.getItem("fc_lang") as Lang || "pt"].errorRefreshPost);
      const data = await res.json() as AiPreview & { customPortalId?: string };
      const refreshed: NewsPost = {
        ...post,
        source: (data.source as NewsSource) ?? post.source,
        sourceHandle: data.sourceHandle ?? post.sourceHandle,
        sourceName: data.sourceName ?? post.sourceName,
        title: data.title?.trim() || undefined,
        content: data.content,
        likes: Number(data.likes) || post.likes,
        commentsCount: Number(data.commentsCount) || post.commentsCount,
        sharesCount: Number(data.sharesCount) || post.sharesCount,
        comments: (data.comments ?? []).map((c) => ({
          id: generateCommentId(),
          username: c.username,
          displayName: c.displayName,
          content: c.content,
          likes: Number(c.likes) || 0,
          personality: c.personality as NewsPost["comments"][number]["personality"],
          replies: Array.isArray(c.replies)
            ? (c.replies as Array<Record<string, unknown>>).map((r) => ({
                id: generateCommentId(),
                username: String(r.username ?? "@torcedor"),
                displayName: String(r.displayName ?? "Torcedor"),
                content: String(r.content ?? ""),
                likes: Number(r.likes) || 0,
                personality: r.personality as NewsPost["comments"][number]["personality"],
                replies: [],
                createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
              }))
            : [],
          createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
        })),
        category: (data.category as NewsPost["category"]) ?? post.category,
        createdAt: Date.now(),
        customPortalId: customPortal?.id ?? post.customPortalId,
      };
      updatePost(seasonId, postId, refreshed);
      setPosts((prev) => prev.map((p) => p.id === postId ? refreshed : p));
    } catch {
      window.alert(NOTICIAS[localStorage.getItem("fc_lang") as Lang || "pt"].alertRefreshFailed);
    } finally {
      setRefreshingPostId(null);
    }
  };

  const handleSavePost = (post: NewsPost) => {
    const existing = getPosts(seasonId);
    if (existing.some((p) => p.id === post.id)) return;
    addPost(seasonId, post);
    setPosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      return [post, ...prev];
    });
    if (allPlayers.length > 0 && (post.content || post.comments?.length)) {
      const criticised = scanPostForCriticism(post.content, post.comments ?? [], allPlayers);
      const allStats = getAllPlayerStats(seasonId);
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
        stepPlayerMood(seasonId, playerId, -1);
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
    if (filterSource !== "all") {
      const isCustomFilter = filterSource.startsWith("custom-");
      if (isCustomFilter) {
        if (p.customPortalId !== filterSource) return false;
      } else {
        if (p.source !== filterSource) return false;
      }
    }
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterOnlyWithImages && !p.imageUrl) return false;
    if (normalizedQuery) {
      const haystack = [p.title ?? "", p.content].join(" ").toLowerCase();
      const words = normalizedQuery.split(/\s+/).filter(Boolean);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });

  const catLabels = getCategoryLabels();
  const srcLabels = getSourceLabels();

  const sourceFilters: { id: string; label: string }[] = [
    { id: "all",     label: t.filterAll },
    { id: "fanpage", label: "FanPage" },
    { id: "tnt",     label: "TNT Sports" },
    { id: "espn",    label: "ESPN" },
    ...customPortals.map((cp) => ({ id: cp.id, label: cp.name })),
  ];

  const sourceCounts = [
    ...( ["fanpage", "tnt", "espn"] as NewsSource[]).map((s) => ({
      id: s,
      label: srcLabels[s],
      count: posts.filter((p) => p.source === s).length,
    })),
    ...customPortals.map((cp) => ({
      id: cp.id,
      label: cp.name,
      count: posts.filter((p) => p.customPortalId === cp.id).length,
    })),
  ];
  const maxSourceCount = Math.max(1, ...sourceCounts.map((s) => s.count));

  const categoryCounts = (Object.keys(CATEGORY_LABELS) as NewsCategory[])
    .map((c) => ({ id: c, count: posts.filter((p) => p.category === c).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const srcLabel = filterSource !== "all"
    ? (srcLabels[filterSource as NewsSource] ?? customPortals.find((p) => p.id === filterSource)?.name ?? filterSource)
    : "";
  const catLabel = filterCategory !== "all" ? (catLabels[filterCategory] ?? "") : "";
  const withImagesCount = posts.filter((p) => !!p.imageUrl).length;
  const emptyLabel = (() => {
    if (normalizedQuery)
      return `${t.emptySearch} "${searchQuery.trim()}"`;
    if (filterOnlyWithImages) return t.emptyImages;
    if (filterSource !== "all" && filterCategory !== "all")
      return t.emptySrcCat.replace("{src}", srcLabel).replace("{cat}", catLabel);
    if (filterSource !== "all") return t.emptySrc.replace("{src}", srcLabel);
    if (filterCategory !== "all") return t.emptyCat.replace("{cat}", catLabel);
    return t.emptyDefault;
  })();

  return (
    <>
    <div className="animate-fade-up">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">{t.heading}</h2>
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
        {!isReadOnly && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--club-gradient)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t.btnNewPost}
          </button>
        )}
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
            placeholder={t.searchPlaceholder}
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
              aria-label={t.clearSearch}
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
            {catLabels[filterCategory]}
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
                <p className="text-white/35 font-semibold text-sm">{t.emptyNoNews}</p>
                <p className="text-white/20 text-xs mt-1 max-w-xs">{emptyLabel}</p>
              </div>
              {!isReadOnly && filterSource === "all" && filterCategory === "all" && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "var(--club-gradient)" }}
                >
                  + {t.firstPostBtn}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:max-w-[560px]">
              {filtered.map((post) => (
                <NoticiaPost
                  key={post.id}
                  post={post}
                  portalPhotos={portalPhotos}
                  customPortals={customPortals}
                  onUpdateImage={isReadOnly ? undefined : handleUpdateImage}
                  onUpdateImageFit={isReadOnly ? undefined : handleUpdateImageFit}
                  onDelete={isReadOnly ? undefined : handleDeletePost}
                  onRefresh={isReadOnly ? undefined : handleRefreshPost}
                  isRefreshing={refreshingPostId === post.id}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — only on lg+ when there are posts */}
        {posts.length > 0 && (
          <div className="flex flex-col gap-4 w-64 flex-shrink-0">

            {/* Por fonte */}
            <div
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-white/35 text-xs font-bold uppercase tracking-wider">{t.sidebarBySource}</p>
              <div className="flex flex-col gap-2.5">
                {sourceCounts.map(({ id, label, count }) => {
                  const cfg = SOURCE_SIDEBAR_COLOR[id] ?? CUSTOM_SIDEBAR_COLOR;
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
                          {label}
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
                <p className="text-white/35 text-xs font-bold uppercase tracking-wider">{t.sidebarByCategory}</p>
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
                          {catLabels[id as NewsCategory] ?? CATEGORY_LABELS[id as NewsCategory]}
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

            {/* Com imagens */}
            {withImagesCount > 0 && (
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-white/35 text-xs font-bold uppercase tracking-wider">{t.filterSectionContent}</p>
                <button
                  onClick={() => setFilterOnlyWithImages((v) => !v)}
                  className="flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 text-left w-full"
                  style={{
                    background: filterOnlyWithImages
                      ? "rgba(var(--club-primary-rgb),0.14)"
                      : "transparent",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: filterOnlyWithImages ? "var(--club-primary)" : "rgba(255,255,255,0.4)" }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: filterOnlyWithImages ? "var(--club-primary)" : "rgba(255,255,255,0.45)" }}
                    >
                      {t.filterWithImages}
                    </span>
                  </span>
                  <span
                    className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                    style={{
                      background: filterOnlyWithImages
                        ? "rgba(var(--club-primary-rgb),0.2)"
                        : "rgba(255,255,255,0.07)",
                      color: filterOnlyWithImages ? "var(--club-primary)" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {withImagesCount}
                  </span>
                </button>
              </div>
            )}

          </div>
        )}
      </div>

    </div>

    {showAddModal && !isReadOnly && createPortal(
      <AddPostModal
        career={career}
        playerContextStr={playerContextStr || undefined}
        squadOvrContext={squadOvrContext || undefined}
        teamFormContext={teamFormContext || undefined}
        historicalContext={historicalContext}
        lastMatchPlayerContext={lastMatchPlayerContext || undefined}
        recentPosts={posts.slice(0, 6)}
        customPortals={customPortals}
        matches={_matches}
        allPlayers={allPlayers}
        seasonId={seasonId}
        careerId={career.id}
        userPlan={userPlan ?? "free"}
        onClose={() => setShowAddModal(false)}
        onSave={handleSavePost}
        onGenerateBackground={onGenerateBackground}
        aiUsageToday={aiUsageToday}
        aiUsageLimit={aiUsageLimit}
        lang={lang}
      />,
      document.body
    )}

    </>
  );
}
