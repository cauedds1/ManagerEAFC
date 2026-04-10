import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface ImageCropModalProps {
  imageSrc: string;
  fileName: string;
  onConfirm: (croppedBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

type AspectOption = { label: string; value: number | undefined };

const ASPECT_OPTIONS: AspectOption[] = [
  { label: "16:9", value: 16 / 9 },
  { label: "4:3",  value: 4 / 3 },
  { label: "1:1",  value: 1 },
  { label: "Livre", value: undefined },
];

export function ImageCropModal({ imageSrc, onConfirm, onCancel }: ImageCropModalProps) {
  const [crop, setCrop]         = useState({ x: 0, y: 0 });
  const [zoom, setZoom]         = useState(1);
  const [aspect, setAspect]     = useState<number | undefined>(16 / 9);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [loading, setLoading]   = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setPixelCrop(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!pixelCrop) return;
    setLoading(true);
    try {
      const { getCroppedBlob } = await import("@/lib/cropImage");
      const blob = await getCroppedBlob(imageSrc, pixelCrop);
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(blob, previewUrl);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(0,0,0,0.97)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancelar
        </button>

        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Enquadrar foto</p>

        <button
          onClick={handleConfirm}
          disabled={loading || !pixelCrop}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--club-gradient)" }}
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {loading ? "Cortando..." : "Confirmar"}
        </button>
      </div>

      {/* Crop area */}
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: {
              border: "2px solid rgba(var(--club-primary-rgb),0.9)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            },
          }}
        />
      </div>

      {/* Controls */}
      <div
        className="flex-shrink-0 flex flex-col gap-3 px-4 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.6)" }}
      >
        {/* Aspect ratio pills */}
        <div className="flex items-center gap-2 justify-center">
          <span className="text-white/30 text-xs font-semibold mr-1">Proporção</span>
          {ASPECT_OPTIONS.map((opt) => {
            const active = aspect === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => setAspect(opt.value)}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150"
                style={{
                  background: active ? "rgba(var(--club-primary-rgb),0.25)" : "rgba(255,255,255,0.07)",
                  color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.5)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1 rounded-full cursor-pointer appearance-none"
            style={{ accentColor: "var(--club-primary)" }}
          />
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
          </svg>
        </div>

        <p className="text-center text-white/20 text-xs">Arraste para reposicionar · Pinça ou slider para zoom</p>
      </div>
    </div>
  );
}
