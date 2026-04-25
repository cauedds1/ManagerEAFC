import { useState } from "react";
import { getAiHeaders } from "@/lib/apiStorage";

interface PendingNotification {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  requiresResponse: boolean;
}

interface NotificationPopupProps {
  notification: PendingNotification;
  onDismiss: () => void;
}

export function NotificationPopup({ notification, onDismiss }: NotificationPopupProps) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  async function markRead(responseText?: string): Promise<boolean> {
    try {
      const headers = getAiHeaders();
      const res = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "POST",
        headers,
        body: JSON.stringify({ response: responseText ?? "" }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleClose() {
    setClosing(true);
    setCloseError("");
    const ok = await markRead();
    setClosing(false);
    if (!ok) {
      setCloseError("Erro ao registrar leitura. Tente novamente.");
      return;
    }
    onDismiss();
  }

  async function handleSubmit() {
    if (!response.trim()) return;
    setSubmitting(true);
    setCloseError("");
    const ok = await markRead(response.trim());
    setSubmitting(false);
    if (!ok) {
      setCloseError("Erro ao enviar resposta. Tente novamente.");
      return;
    }
    onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "hsl(222 20% 11%)",
          border: "1px solid rgba(139,92,246,0.3)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)",
          maxHeight: "90vh",
        }}
      >
        {/* Image */}
        {notification.imageUrl && !imgError && (
          <div className="w-full overflow-hidden flex-shrink-0" style={{ maxHeight: "220px" }}>
            <img
              src={notification.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-4 p-6 overflow-y-auto">
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(139,92,246,0.15)",
                color: "#a78bfa",
                border: "1px solid rgba(139,92,246,0.25)",
              }}
            >
              📢 Aviso do Admin
            </span>
          </div>

          {/* Title */}
          <h2 className="text-white font-bold text-xl leading-tight">{notification.title}</h2>

          {/* Body */}
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{notification.body}</p>

          {/* Response textarea */}
          {notification.requiresResponse && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Sua resposta
              </label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Escreva sua mensagem aqui..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-white text-sm resize-none focus:outline-none placeholder:text-white/25"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>
          )}

          {/* Error message */}
          {closeError && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#fca5a5",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              {closeError}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              disabled={submitting || closing}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: submitting || closing ? "not-allowed" : "pointer",
              }}
            >
              {closing ? "Fechando..." : "Fechar"}
            </button>
            {notification.requiresResponse && (
              <button
                onClick={handleSubmit}
                disabled={submitting || closing || !response.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background:
                    submitting || closing || !response.trim()
                      ? "rgba(139,92,246,0.15)"
                      : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                  color: submitting || closing || !response.trim() ? "rgba(255,255,255,0.3)" : "white",
                  cursor: submitting || closing || !response.trim() ? "not-allowed" : "pointer",
                  boxShadow:
                    submitting || closing || !response.trim() ? "none" : "0 4px 16px rgba(139,92,246,0.35)",
                }}
              >
                {submitting ? "Enviando..." : "Enviar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function fetchPendingNotification(): Promise<{
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  requiresResponse: boolean;
} | null> {
  try {
    const headers = getAiHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch("/api/notifications/pending", { headers });
    if (res.status === 204 || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
