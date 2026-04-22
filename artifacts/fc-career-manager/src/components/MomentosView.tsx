import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getMomentos,
  addMomento,
  deleteMomento,
  generateMomentoId,
  resizeImageToDataUrl,
  deleteVideoFromR2,
  type Momento,
} from "@/lib/momentoStorage";
import { getUserPlan, getPlanLimits, type FrontendPlanLimits } from "@/lib/userPlan";
import type { SquadPlayer } from "@/lib/squadCache";
import { useLang } from "@/hooks/useLang";
import { SectionHelp } from "./SectionHelp";
import { MOMENTOS } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

interface MomentosViewProps {
  seasonId: string;
  allSeasonIds?: string[];
  isReadOnly?: boolean;
  allPlayers?: SquadPlayer[];
  highlightMomentoId?: string;
  onClearHighlight?: () => void;
}

function formatGameDate(raw: string): string {
  return raw.trim() || "—";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PlayerInitials({ name, size }: { name: string; size: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <span
      className="flex items-center justify-center rounded-full text-white font-black shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, size * 0.38),
        background: "rgba(var(--club-primary-rgb),0.32)",
        border: "1.5px solid rgba(var(--club-primary-rgb),0.45)",
      }}
    >
      {initials}
    </span>
  );
}

function PlayerAvatarStrip({ playerIds, allPlayers }: { playerIds?: number[]; allPlayers?: SquadPlayer[] }) {
  if (!playerIds || playerIds.length === 0 || !allPlayers) return null;
  const players = playerIds.slice(0, 3).map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean) as SquadPlayer[];
  if (players.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {players.map((p) => (
        <PlayerInitials key={p.id} name={p.name} size={20} />
      ))}
      {playerIds.length > 3 && (
        <span className="text-white/45 text-[10px] font-bold ml-0.5">+{playerIds.length - 3}</span>
      )}
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  onConfirm,
  onCancel,
  lang,
}: {
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  lang: Lang;
}) {
  const t = MOMENTOS[lang];
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !deleting) onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, deleting]);

  const handleConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm();
    } catch {
      setDeleteError(t.errDeleteVideoFailed);
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={() => { if (!deleting) onCancel(); }}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4"
        style={{ background: "rgb(13,13,20)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-base">{t.confirmDeleteTitle}</p>
        <p className="text-white/60 text-sm leading-relaxed">
          "<span className="text-white/80">{title}</span>" {t.confirmDeleteBody}
        </p>
        {deleteError && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{deleteError}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/60 hover:text-white/90 transition-colors disabled:opacity-40"
          >
            {t.confirmDeleteCancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {deleting && <div className="w-3.5 h-3.5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />}
            {deleting ? t.confirmDeleteDeleting : t.confirmDeleteBtn}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailModal({
  momento,
  onClose,
  onDelete,
  lang,
}: {
  momento: Momento;
  onClose: () => void;
  onDelete: () => Promise<void>;
  lang: Lang;
}) {
  const t = MOMENTOS[lang];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isVideo = momento.mediaType === "video";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
        <div
          className="rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
          style={{ background: "rgb(13,13,20)", border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex-shrink-0">
            {isVideo && momento.videoUrl ? (
              <video
                src={momento.videoUrl}
                controls
                className="w-full object-cover max-h-[55vh] bg-black"
                playsInline
              />
            ) : (
              <img src={momento.photoDataUrl} alt={momento.title} className="w-full object-cover max-h-[50vh]" />
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
              style={{ background: "rgba(0,0,0,0.55)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-3 left-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white/90" style={{ background: "rgba(0,0,0,0.6)" }}>
                🗓 {formatGameDate(momento.gameDate)}
              </span>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-2 overflow-y-auto">
            <div className="flex items-center gap-2 flex-wrap">
              {isVideo && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(124,92,252,0.18)", color: "#a78bfa" }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {t.videoBadge}
                </span>
              )}
              <h2 className="text-white font-bold text-xl leading-snug">{momento.title}</h2>
            </div>
            {momento.description && (
              <p className="text-white/65 text-sm leading-relaxed whitespace-pre-wrap">{momento.description}</p>
            )}
          </div>

          <div className="px-5 pb-5 flex justify-end">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t.detailDeleteBtn}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={momento.title}
          lang={lang}
          onConfirm={async () => {
            await onDelete();
            setConfirmDelete(false);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>,
    document.body
  );
}

type UploadState = "idle" | "uploading" | "done" | "error";

interface VideoUploadResult {
  url: string;
  key: string;
}

function VideoUploadSection({
  planLimits,
  videoCount,
  onVideoReady,
  lang,
}: {
  planLimits: FrontendPlanLimits;
  videoCount: number;
  onVideoReady: (result: VideoUploadResult | null) => void;
  lang: Lang;
}) {
  const t = MOMENTOS[lang];
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const maxSizeMb = planLimits.maxVideoMomentoSizeMb;
  const maxVideos = planLimits.maxVideoMomentos;
  const isAtLimit = videoCount >= maxVideos;

  const handleFile = useCallback(async (file: File) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowed.includes(file.type)) {
      setUploadError(t.errVideoFormat);
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > maxSizeMb) {
      setUploadError(t.errVideoSize.replace("{mb}", String(maxSizeMb)).replace("{size}", sizeMb.toFixed(1)));
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    setUploadState("uploading");
    setUploadProgress(0);
    onVideoReady(null);

    try {
      const token = localStorage.getItem("fc_auth_token");

      const result = await new Promise<{ url: string; key: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as { url: string; key: string });
            } catch {
              reject(new Error(t.errVideoInvalidResponse));
            }
          } else {
            let errMsg = `HTTP ${xhr.status}`;
            try { errMsg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? errMsg; } catch { /* noop */ }
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error(t.errVideoNetwork));
        xhr.open("POST", "/api/storage/uploads/video?folder=momentos");
        xhr.setRequestHeader("Content-Type", file.type);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(file);
      });

      setUploadState("done");
      setUploadProgress(100);
      onVideoReady(result);
    } catch (err) {
      setUploadState("error");
      setUploadError(err instanceof Error ? err.message : t.errVideoUploadFailed);
      onVideoReady(null);
    }
  }, [maxSizeMb, onVideoReady, t]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    if (xhrRef.current && uploadState === "uploading") xhrRef.current.abort();
    setUploadState("idle");
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    onVideoReady(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const counterColor = isAtLimit ? "#f87171" : videoCount / maxVideos >= 0.8 ? "#f59e0b" : "#34d399";
  const counterPct = Math.min(100, (videoCount / maxVideos) * 100);

  const CounterBar = () => (
    <div className="flex flex-col gap-1.5 mb-3">
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs font-semibold">{t.videosUsed}</span>
        <span className="text-sm font-black tabular-nums" style={{ color: counterColor }}>{videoCount}/{maxVideos}</span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${counterPct}%`, background: counterColor }}
        />
      </div>
    </div>
  );

  if (isAtLimit) {
    return (
      <div className="flex flex-col gap-3">
        <CounterBar />
        <div className="rounded-xl border border-amber-500/30 p-4 flex flex-col items-center gap-2 text-center" style={{ background: "rgba(245,158,11,0.06)" }}>
          <svg className="w-5 h-5 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-amber-300/80 text-sm font-semibold">{t.videoLimitReached.replace("{n}", String(maxVideos))}</p>
          <p className="text-white/40 text-xs">{t.videoLimitHint}</p>
        </div>
      </div>
    );
  }

  if (uploadState === "done" && selectedFile) {
    return (
      <div className="flex flex-col gap-2">
        <CounterBar />
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-300 text-sm font-semibold truncate">{selectedFile.name}</p>
            <p className="text-white/40 text-xs">{formatFileSize(selectedFile.size)} · {t.uploadReadyToSave}</p>
          </div>
          <button onClick={handleReset} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (uploadState === "uploading" && selectedFile) {
    return (
      <div className="flex flex-col gap-2">
        <CounterBar />
        <div className="rounded-xl border border-white/10 bg-white/4 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,92,252,0.15)" }}>
            <div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-semibold truncate">{selectedFile.name}</p>
            <p className="text-white/40 text-xs">{formatFileSize(selectedFile.size)}</p>
          </div>
          <span className="text-purple-300 text-sm font-bold flex-shrink-0">{uploadProgress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%`, background: "var(--club-primary, #7c5cfc)" }}
          />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CounterBar />
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div
        className="relative w-full rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 py-10"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <svg className="w-9 h-9 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span className="text-white/40 text-sm">{t.dropVideo}</span>
        <span className="text-white/25 text-xs">{t.dropVideoHint.replace("{mb}", String(maxSizeMb))}</span>
      </div>
      {uploadError && <p className="text-red-400 text-xs mt-1.5">{uploadError}</p>}
    </div>
  );
}

type MediaTab = "photo" | "video";

function AddMomentoModal({
  onClose,
  onSave,
  planLimits,
  videoCount,
  allPlayers,
  lang,
}: {
  onClose: () => void;
  onSave: (m: Omit<Momento, "id" | "createdAt">) => void;
  planLimits: FrontendPlanLimits;
  videoCount: number;
  allPlayers?: SquadPlayer[];
  lang: Lang;
}) {
  const t = MOMENTOS[lang];
  const [mediaTab, setMediaTab] = useState<MediaTab>("photo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [videoUpload, setVideoUpload] = useState<VideoUploadResult | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; gameDate?: string; media?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const playerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPlayerDropdown) return;
    const handler = (e: MouseEvent) => {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlayerDropdown]);

  const availablePlayers = (allPlayers ?? []).filter(
    (p) => !selectedPlayerIds.includes(p.id) && p.name.toLowerCase().includes(playerSearch.toLowerCase())
  );
  const selectedPlayers = (allPlayers ?? []).filter((p) => selectedPlayerIds.includes(p.id));

  const canUseVideo = planLimits.maxVideoMomentos > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError(t.errImagesOnly);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoError(t.errImageTooLarge);
      return;
    }
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setErrors((e) => ({ ...e, media: undefined }));
    } catch {
      setPhotoError(t.errImageLoad);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = t.errTitleRequired;
    if (!gameDate.trim()) errs.gameDate = t.errGameDateRequired;
    if (mediaTab === "photo" && !photoDataUrl) errs.media = t.errPhotoRequired;
    if (mediaTab === "video" && !videoUpload) errs.media = t.errVideoWaiting;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const taggedPlayers = selectedPlayerIds.length > 0 ? selectedPlayerIds : undefined;
    if (mediaTab === "video" && videoUpload) {
      onSave({
        title: title.trim(),
        description: description.trim(),
        gameDate: gameDate.trim(),
        photoDataUrl: "",
        mediaType: "video",
        videoUrl: videoUpload.url,
        videoKey: videoUpload.key,
        playerIds: taggedPlayers,
      });
    } else {
      onSave({
        title: title.trim(),
        description: description.trim(),
        gameDate: gameDate.trim(),
        photoDataUrl: photoDataUrl!,
        mediaType: "image",
        playerIds: taggedPlayers,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div
        className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-hidden"
        style={{
          background: "rgb(13,13,20)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">{t.addMomentoTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 overflow-y-auto flex-1 min-h-0">
          {/* Media type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 self-start">
            <button
              onClick={() => setMediaTab("photo")}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: mediaTab === "photo" ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.04)",
                color: mediaTab === "photo" ? "var(--club-primary, #7c5cfc)" : "rgba(255,255,255,0.4)",
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t.tabPhoto}
            </button>
            <button
              onClick={() => setMediaTab("video")}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: mediaTab === "video" ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.04)",
                color: mediaTab === "video" ? "var(--club-primary, #7c5cfc)" : "rgba(255,255,255,0.4)",
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {t.tabVideo}
              {!canUseVideo ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md ml-0.5" style={{ background: "rgba(245,158,11,0.22)", color: "#fbbf24" }}>
                  {t.proUltraBadge}
                </span>
              ) : (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md ml-0.5 tabular-nums"
                  style={{
                    background: videoCount >= planLimits.maxVideoMomentos
                      ? "rgba(239,68,68,0.2)"
                      : "rgba(16,185,129,0.15)",
                    color: videoCount >= planLimits.maxVideoMomentos
                      ? "#f87171"
                      : "#34d399",
                  }}
                >
                  {videoCount}/{planLimits.maxVideoMomentos}
                </span>
              )}
            </button>
          </div>

          {/* Photo section */}
          {mediaTab === "photo" && (
            <div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div
                className={`relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer flex items-center justify-center overflow-hidden
                  ${errors.media ? "border-red-500/60" : "border-white/20 hover:border-white/40"}`}
                style={{ minHeight: photoDataUrl ? undefined : "160px" }}
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {photoLoading && (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                    <span className="text-white/50 text-xs">{t.photoLoading}</span>
                  </div>
                )}
                {!photoLoading && !photoDataUrl && (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white/40 text-sm">{t.dropPhoto}</span>
                    <span className="text-white/25 text-xs">{t.dropPhotoHint}</span>
                  </div>
                )}
                {!photoLoading && photoDataUrl && (
                  <>
                    <img src={photoDataUrl} alt="preview" className="w-full object-cover rounded-xl max-h-56" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl" style={{ background: "rgba(0,0,0,0.45)" }}>
                      <span className="text-white text-xs font-semibold">{t.changePhoto}</span>
                    </div>
                  </>
                )}
              </div>
              {(photoError || errors.media) && (
                <p className="text-red-400 text-xs mt-1">{photoError ?? errors.media}</p>
              )}
            </div>
          )}

          {/* Video section */}
          {mediaTab === "video" && (
            <div>
              {!canUseVideo ? (
                <div className="rounded-xl border border-amber-500/25 p-5 flex flex-col items-center gap-3 text-center" style={{ background: "rgba(245,158,11,0.05)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/80 font-semibold text-sm">{t.videoProOnly}</p>
                    <p className="text-white/40 text-xs mt-1">{t.videoProOnlyHint}</p>
                  </div>
                </div>
              ) : (
                <VideoUploadSection
                  planLimits={planLimits}
                  videoCount={videoCount}
                  lang={lang}
                  onVideoReady={(result) => {
                    setVideoUpload(result);
                    if (result) setErrors((e) => ({ ...e, media: undefined }));
                  }}
                />
              )}
              {errors.media && canUseVideo && videoCount < planLimits.maxVideoMomentos && (
                <p className="text-red-400 text-xs mt-1">{errors.media}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">{t.labelTitle} <span className="text-red-400">*</span></label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((er) => ({ ...er, title: undefined })); }}
              placeholder={t.titlePlaceholder}
              maxLength={100}
              className={`w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors
                ${errors.title ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-white/25"}`}
            />
            {errors.title && <p className="text-red-400 text-xs">{errors.title}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">{t.labelGameDate} <span className="text-red-400">*</span></label>
            <input
              value={gameDate}
              onChange={(e) => { setGameDate(e.target.value); if (errors.gameDate) setErrors((er) => ({ ...er, gameDate: undefined })); }}
              placeholder={t.gameDatePlaceholder}
              maxLength={30}
              className={`w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors
                ${errors.gameDate ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-white/25"}`}
            />
            {errors.gameDate && <p className="text-red-400 text-xs">{errors.gameDate}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">{t.labelDescription} <span className="text-white/30 font-normal normal-case">{t.optional}</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-white/10 bg-white/5 focus:border-white/25 transition-colors resize-none"
            />
          </div>

          {(allPlayers ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">
                {t.labelPlayers} <span className="text-white/30 font-normal normal-case">{t.optional}</span>
              </label>
              {selectedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlayers.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-semibold text-white"
                      style={{ background: "rgba(var(--club-primary-rgb),0.18)", border: "1px solid rgba(var(--club-primary-rgb),0.25)" }}
                    >
                      <PlayerInitials name={p.name} size={18} />
                      {p.name.split(" ")[0]}
                      <button
                        type="button"
                        onClick={() => setSelectedPlayerIds((ids) => ids.filter((id) => id !== p.id))}
                        className="w-4 h-4 flex items-center justify-center rounded text-white/50 hover:text-white transition-colors ml-0.5"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div ref={playerDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setShowPlayerDropdown((v) => !v); setPlayerSearch(""); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm border border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white/70 transition-colors"
                >
                  <span>{t.addPlayer}</span>
                  <svg className={`w-4 h-4 transition-transform ${showPlayerDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPlayerDropdown && (
                  <div className="mt-1 rounded-xl border border-white/10 overflow-hidden" style={{ background: "#0f0c1e" }}>
                    <div className="p-2 border-b border-white/10">
                      <input
                        autoFocus
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        placeholder={t.searchPlayer}
                        className="w-full rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 outline-none border border-white/10 focus:border-white/25 transition-colors"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
                      {availablePlayers.length === 0 ? (
                        <p className="text-white/30 text-xs text-center py-4">{t.noPlayersFound}</p>
                      ) : (
                        availablePlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPlayerIds((ids) => [...ids, p.id]);
                              setPlayerSearch("");
                              setShowPlayerDropdown(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-white transition-colors"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            <PlayerInitials name={p.name} size={24} />
                            <span className="flex-1 min-w-0 truncate">{p.name}</span>
                            {p.position && <span className="text-white/30 text-xs shrink-0">{p.position}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all text-white"
            style={{ background: "var(--club-primary, #3b82f6)" }}
          >
            {t.saveMomento}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function VideoCard({ momento, onOpenDetail, allPlayers, highlight, lang }: { momento: Momento; onOpenDetail: () => void; allPlayers?: SquadPlayer[]; highlight?: boolean; lang: Lang }) {
  const t = MOMENTOS[lang];
  const [playing, setPlaying] = useState(false);

  return (
    <div
      id={`momento-card-${momento.id}`}
      className="glass glass-hover rounded-2xl overflow-hidden w-full transition-all duration-200 hover:scale-[1.02]"
      style={highlight ? { boxShadow: "0 0 0 2px var(--club-primary, #7c5cfc), 0 0 20px rgba(var(--club-primary-rgb),0.35)" } : undefined}
    >
      <div className="relative aspect-video overflow-hidden bg-black/40">
        {playing ? (
          <div onClick={(e) => e.stopPropagation()}>
            <video
              autoPlay
              controls
              playsInline
              src={momento.videoUrl}
              className="w-full h-full object-contain bg-black"
            />
          </div>
        ) : (
          <>
            <video
              src={`${momento.videoUrl ?? ""}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={() => setPlaying(true)}
              style={{ background: "rgba(0,0,0,0.25)" }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110"
                style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
              >
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail(); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
              style={{ background: "rgba(0,0,0,0.55)" }}
              title={t.viewDetails}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }} />
        <span className="absolute bottom-2 left-2.5 text-[11px] font-bold text-white/80 pointer-events-none">
          🗓 {formatGameDate(momento.gameDate)}
        </span>
      </div>
      <div className="px-3 pt-2.5 pb-3 cursor-pointer" onClick={onOpenDetail}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(124,92,252,0.18)", color: "#a78bfa" }}>
            {t.videoBadgeCard}
          </span>
          <PlayerAvatarStrip playerIds={momento.playerIds} allPlayers={allPlayers} />
        </div>
        <p className="text-white font-bold text-sm leading-snug line-clamp-2">{momento.title}</p>
        {momento.description && (
          <p className="text-white/45 text-xs mt-1 leading-relaxed line-clamp-2">{momento.description}</p>
        )}
      </div>
    </div>
  );
}

function ImageCard({ momento, onClick, allPlayers, highlight }: { momento: Momento; onClick: () => void; allPlayers?: SquadPlayer[]; highlight?: boolean }) {
  return (
    <button
      id={`momento-card-${momento.id}`}
      onClick={onClick}
      className="group glass glass-hover rounded-2xl overflow-hidden text-left w-full transition-all duration-200 hover:scale-[1.02]"
      style={highlight ? { boxShadow: "0 0 0 2px var(--club-primary, #7c5cfc), 0 0 20px rgba(var(--club-primary-rgb),0.35)" } : undefined}
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={momento.photoDataUrl} alt={momento.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }} />
        <span className="absolute bottom-2 left-2.5 text-[11px] font-bold text-white/80">
          🗓 {formatGameDate(momento.gameDate)}
        </span>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <PlayerAvatarStrip playerIds={momento.playerIds} allPlayers={allPlayers} />
        </div>
        <p className="text-white font-bold text-sm leading-snug line-clamp-2">{momento.title}</p>
        {momento.description && (
          <p className="text-white/45 text-xs mt-1 leading-relaxed line-clamp-2">{momento.description}</p>
        )}
      </div>
    </button>
  );
}

type Tagged = Momento & { _sid: string };

export function MomentosView({ seasonId, allSeasonIds, isReadOnly, allPlayers, highlightMomentoId, onClearHighlight }: MomentosViewProps) {
  const [lang] = useLang();
  const t = MOMENTOS[lang];

  const [currentMomentos, setCurrentMomentos] = useState<Momento[]>(() => getMomentos(seasonId));
  const [scope, setScope] = useState<"atual" | "todas">("atual");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMomento, setSelectedMomento] = useState<Tagged | null>(null);

  const plan = getUserPlan();
  const planLimits = getPlanLimits(plan);

  const hasMultipleSeasons = (allSeasonIds?.length ?? 0) > 1;

  useEffect(() => {
    setCurrentMomentos(getMomentos(seasonId));
    setShowAdd(false);
    setSelectedMomento(null);
  }, [seasonId]);

  const refresh = () => setCurrentMomentos(getMomentos(seasonId));

  const momentos = useMemo<Tagged[]>(() => {
    if (scope === "atual" || !allSeasonIds) {
      return currentMomentos.map((m) => ({ ...m, _sid: seasonId }));
    }
    return allSeasonIds
      .flatMap((sid) => getMomentos(sid).map((m) => ({ ...m, _sid: sid })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [scope, allSeasonIds, currentMomentos, seasonId]);

  const videoCount = useMemo(() => {
    const all = allSeasonIds
      ? allSeasonIds.flatMap((sid) => getMomentos(sid))
      : currentMomentos;
    return all.filter((m) => m.mediaType === "video").length;
  }, [allSeasonIds, currentMomentos]);

  useEffect(() => {
    if (!highlightMomentoId) return undefined;
    const el = document.getElementById(`momento-card-${highlightMomentoId}`);
    if (!el) return undefined;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => { onClearHighlight?.(); }, 3000);
    return () => clearTimeout(timer);
  }, [highlightMomentoId, onClearHighlight, momentos]);

  const handleSave = (data: Omit<Momento, "id" | "createdAt">) => {
    const m: Momento = { ...data, id: generateMomentoId(), createdAt: new Date().toISOString() };
    addMomento(seasonId, m);
    refresh();
    setShowAdd(false);
  };

  const handleDelete = async (tagged: Tagged): Promise<void> => {
    if (tagged.mediaType === "video" && tagged.videoKey) {
      const success = await deleteVideoFromR2(tagged.videoKey);
      if (!success) {
        throw new Error(t.errDeleteVideoStorage);
      }
    }
    deleteMomento(tagged._sid, tagged.id);
    refresh();
    setSelectedMomento(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-xl">{t.heading}</h2>
          <p className="text-white/40 text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionHelp section="momentos" />
          {hasMultipleSeasons && (
            <div className="flex rounded-xl overflow-hidden border border-white/10">
              {(["atual", "todas"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: scope === s ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.04)",
                    color: scope === s ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {s === "atual" ? t.scopeCurrent : t.scopeAll}
                </button>
              ))}
            </div>
          )}
          {!isReadOnly && scope === "atual" && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: "var(--club-primary, #3b82f6)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t.addMomentoBtn}
            </button>
          )}
        </div>
      </div>

      {momentos.length === 0 ? (
        <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white/60 font-semibold text-sm">{t.emptyTitle}</p>
            <p className="text-white/30 text-xs mt-1">
              {scope === "todas"
                ? t.emptyAllSeasons
                : isReadOnly
                ? t.emptyReadOnly
                : t.emptyDefault}
            </p>
          </div>
          {!isReadOnly && scope === "atual" && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: "var(--club-primary, #3b82f6)" }}
            >
              {t.addFirstMomento}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {momentos.map((m) =>
            m.mediaType === "video" ? (
              <VideoCard
                key={m.id}
                momento={m}
                onOpenDetail={() => setSelectedMomento(m)}
                allPlayers={allPlayers}
                highlight={highlightMomentoId === m.id}
                lang={lang}
              />
            ) : (
              <ImageCard
                key={m.id}
                momento={m}
                onClick={() => setSelectedMomento(m)}
                allPlayers={allPlayers}
                highlight={highlightMomentoId === m.id}
              />
            )
          )}
        </div>
      )}

      {showAdd && (
        <AddMomentoModal
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          planLimits={planLimits}
          videoCount={videoCount}
          allPlayers={allPlayers}
          lang={lang}
        />
      )}

      {selectedMomento && (
        <DetailModal
          momento={selectedMomento}
          lang={lang}
          onClose={() => setSelectedMomento(null)}
          onDelete={() => handleDelete(selectedMomento)}
        />
      )}
    </div>
  );
}
