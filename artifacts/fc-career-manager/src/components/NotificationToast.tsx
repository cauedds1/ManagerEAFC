import { useEffect, useRef } from "react";
import { playNotificationSound } from "@/lib/notificationSound";

export interface ToastItem {
  id: string;
  type: "diretoria" | "noticias";
  title: string;
  preview: string;
}

interface NotificationToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 6000;

function SingleToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    playNotificationSound(toast.type);
    timerRef.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  const isDiretoria = toast.type === "diretoria";

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg pointer-events-auto"
      style={{
        background: "rgba(18,20,28,0.97)",
        border: isDiretoria
          ? "1px solid rgba(var(--club-primary-rgb),0.35)"
          : "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
        minWidth: "260px",
        maxWidth: "320px",
        animation: "slideInRight 0.25s ease-out",
      }}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          background: isDiretoria
            ? "rgba(var(--club-primary-rgb),0.18)"
            : "rgba(255,255,255,0.06)",
        }}
      >
        {isDiretoria ? (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "var(--club-primary)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-white/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold truncate"
          style={{ color: isDiretoria ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}
        >
          {toast.title}
        </p>
        <p className="text-xs text-white/50 mt-0.5 line-clamp-2 leading-snug">
          {toast.preview}
        </p>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-white/25 hover:text-white/60 transition-colors mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div
        className="fixed bottom-[84px] sm:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: "340px" }}
      >
        {toasts.slice(-3).map((t) => (
          <SingleToast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}
