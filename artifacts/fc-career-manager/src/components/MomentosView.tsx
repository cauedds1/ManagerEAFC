import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  getMomentos,
  addMomento,
  deleteMomento,
  generateMomentoId,
  resizeImageToDataUrl,
  type Momento,
} from "@/lib/momentoStorage";

interface MomentosViewProps {
  careerId: string;
  isReadOnly?: boolean;
}

function formatGameDate(raw: string): string {
  return raw.trim() || "—";
}

function ConfirmDeleteModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onCancel}>
      <div className="glass rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-bold text-base">Excluir momento?</p>
        <p className="text-white/60 text-sm leading-relaxed">
          "<span className="text-white/80">{title}</span>" será removido permanentemente.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-white/60 hover:text-white/90 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailModal({ momento, onClose, onDelete }: { momento: Momento; onClose: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
        <div className="glass rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex-shrink-0">
            <img src={momento.photoDataUrl} alt={momento.title} className="w-full object-cover max-h-[50vh]" />
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
            <h2 className="text-white font-bold text-xl leading-snug">{momento.title}</h2>
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
              Excluir
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={momento.title}
          onConfirm={() => { setConfirmDelete(false); onDelete(); onClose(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>,
    document.body
  );
}

function AddMomentoModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (m: Omit<Momento, "id" | "createdAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; gameDate?: string; photo?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError("Apenas imagens são permitidas.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoError("Imagem deve ter no máximo 20 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setErrors((e) => ({ ...e, photo: undefined }));
    } catch {
      setPhotoError("Não foi possível carregar a imagem.");
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
    if (!title.trim()) errs.title = "Título é obrigatório.";
    if (!gameDate.trim()) errs.gameDate = "Data no jogo é obrigatória.";
    if (!photoDataUrl) errs.photo = "Foto é obrigatória.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ title: title.trim(), description: description.trim(), gameDate: gameDate.trim(), photoDataUrl: photoDataUrl! });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div
        className="glass rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">Novo Momento</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 overflow-y-auto">
          <div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div
              className={`relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer flex items-center justify-center overflow-hidden
                ${errors.photo ? "border-red-500/60" : "border-white/20 hover:border-white/40"}`}
              style={{ minHeight: photoDataUrl ? undefined : "160px" }}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {photoLoading && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  <span className="text-white/50 text-xs">Carregando…</span>
                </div>
              )}
              {!photoLoading && !photoDataUrl && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/40 text-sm">Clique ou arraste uma foto</span>
                  <span className="text-white/25 text-xs">JPG, PNG, WEBP · até 20 MB</span>
                </div>
              )}
              {!photoLoading && photoDataUrl && (
                <>
                  <img src={photoDataUrl} alt="preview" className="w-full object-cover rounded-xl max-h-56" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl" style={{ background: "rgba(0,0,0,0.45)" }}>
                    <span className="text-white text-xs font-semibold">Trocar foto</span>
                  </div>
                </>
              )}
            </div>
            {(photoError || errors.photo) && (
              <p className="text-red-400 text-xs mt-1">{photoError ?? errors.photo}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">Título <span className="text-red-400">*</span></label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((er) => ({ ...er, title: undefined })); }}
              placeholder="Ex: Primeiro título pelo clube"
              maxLength={100}
              className={`w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors
                ${errors.title ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-white/25"}`}
            />
            {errors.title && <p className="text-red-400 text-xs">{errors.title}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">Data no jogo <span className="text-red-400">*</span></label>
            <input
              value={gameDate}
              onChange={(e) => { setGameDate(e.target.value); if (errors.gameDate) setErrors((er) => ({ ...er, gameDate: undefined })); }}
              placeholder="Ex: 15/05/2027"
              maxLength={30}
              className={`w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors
                ${errors.gameDate ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-white/25"}`}
            />
            {errors.gameDate && <p className="text-red-400 text-xs">{errors.gameDate}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">Descrição <span className="text-white/30 font-normal normal-case">(opcional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conte o que aconteceu nesse momento…"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-white/10 bg-white/5 focus:border-white/25 transition-colors resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all text-white"
            style={{ background: "var(--club-primary, #3b82f6)" }}
          >
            Salvar Momento
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MomentoCard({ momento, onClick }: { momento: Momento; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group glass glass-hover rounded-2xl overflow-hidden text-left w-full transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={momento.photoDataUrl} alt={momento.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }} />
        <span className="absolute bottom-2 left-2.5 text-[11px] font-bold text-white/80">
          🗓 {formatGameDate(momento.gameDate)}
        </span>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <p className="text-white font-bold text-sm leading-snug line-clamp-2">{momento.title}</p>
        {momento.description && (
          <p className="text-white/45 text-xs mt-1 leading-relaxed line-clamp-2">{momento.description}</p>
        )}
      </div>
    </button>
  );
}

export function MomentosView({ careerId, isReadOnly }: MomentosViewProps) {
  const [momentos, setMomentos] = useState<Momento[]>(() => getMomentos(careerId));
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMomento, setSelectedMomento] = useState<Momento | null>(null);

  const refresh = () => setMomentos(getMomentos(careerId));

  const handleSave = (data: Omit<Momento, "id" | "createdAt">) => {
    const m: Momento = { ...data, id: generateMomentoId(), createdAt: new Date().toISOString() };
    addMomento(careerId, m);
    refresh();
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    deleteMomento(careerId, id);
    refresh();
    setSelectedMomento(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-xl">Momentos</h2>
          <p className="text-white/40 text-sm mt-0.5">Fotos e memórias da sua carreira</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: "var(--club-primary, #3b82f6)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Momento
          </button>
        )}
      </div>

      {momentos.length === 0 ? (
        <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white/60 font-semibold text-sm">Nenhum momento registrado</p>
            <p className="text-white/30 text-xs mt-1">
              {isReadOnly ? "Esta temporada não possui momentos." : "Adicione fotos de conquistas, jogos épicos e outros instantes especiais."}
            </p>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: "var(--club-primary, #3b82f6)" }}
            >
              Adicionar primeiro momento
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {momentos.map((m) => (
            <MomentoCard key={m.id} momento={m} onClick={() => setSelectedMomento(m)} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddMomentoModal onClose={() => setShowAdd(false)} onSave={handleSave} />
      )}

      {selectedMomento && (
        <DetailModal
          momento={selectedMomento}
          onClose={() => setSelectedMomento(null)}
          onDelete={() => handleDelete(selectedMomento.id)}
        />
      )}
    </div>
  );
}
