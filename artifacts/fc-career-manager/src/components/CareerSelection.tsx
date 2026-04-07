import { useState, useEffect } from "react";
import { Career } from "@/types/career";
import { deleteCareer } from "@/lib/careerStorage";

interface CareerSelectionProps {
  careers: Career[];
  onSelectCareer: (career: Career) => void;
  onCreateNew: () => void;
  onCareersChange: (careers: Career[]) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function ClubLogo({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`w-12 h-12 object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-xl font-black text-white/40">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function CoachPhoto({ photo, name }: { photo?: string; name: string }) {
  const [err, setErr] = useState(false);

  if (photo && !err) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setErr(true)}
      />
    );
  }

  const initials = name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="w-full h-full flex items-center justify-center font-black text-sm text-white/60"
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))" }}
    >
      {initials}
    </div>
  );
}

function CareerCard({
  career,
  onSelect,
  onDelete,
  index,
}: {
  career: Career;
  onSelect: () => void;
  onDelete: () => void;
  index: number;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setTimeout(() => {
      onDelete();
    }, 300);
  };

  return (
    <div
      className="relative group animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 80, 400)}ms`, animationFillMode: "both" }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        onClick={onSelect}
        disabled={deleting}
        className="w-full text-left transition-all duration-200 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: deleting ? 0 : 1,
          transform: deleting ? "scale(0.95)" : "scale(1)",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
        onMouseEnter={(e) => {
          if (!deleting) {
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (!deleting) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, var(--club-primary, #6366f1)60, transparent)" }}
        />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <ClubLogo logo={career.clubLogo} name={career.clubName} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-white font-black text-lg leading-tight truncate">
                  {career.clubName}
                </h3>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                >
                  {career.season}
                </span>
              </div>
              <p className="text-white/40 text-sm truncate">{career.clubLeague}</p>
              {career.clubCountry && (
                <p className="text-white/25 text-xs mt-0.5">{career.clubCountry}</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div
            className="my-4"
            style={{ height: "1px", background: "rgba(255,255,255,0.06)" }}
          />

          {/* Coach info */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: "1.5px solid rgba(255,255,255,0.15)" }}
            >
              <CoachPhoto photo={career.coach.photo} name={career.coach.name} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{career.coach.nationalityFlag}</span>
                <p className="text-white font-semibold text-sm truncate">{career.coach.name}</p>
              </div>
              <p className="text-white/30 text-xs mt-0.5">
                {career.coach.nationality} · {career.coach.age} anos
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white/20 text-xs">criado em</p>
              <p className="text-white/35 text-xs">{formatDate(career.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Hover CTA */}
        <div
          className="px-5 py-3 flex items-center justify-between transition-all duration-200"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-white/30 text-xs font-medium group-hover:text-white/60 transition-colors">
            Clique para continuar a carreira
          </span>
          <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-white/0 group-hover:text-white/40 hover:!text-red-400 hover:bg-red-500/10 transition-all duration-200"
        title="Excluir carreira"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-white font-black text-2xl mb-2">Comece sua jornada</h3>
        <p className="text-white/35 text-sm leading-relaxed max-w-xs">
          Crie seu primeiro perfil de técnico, escolha um clube e construa um legado no EA FC 26
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 active:scale-98"
        style={{ background: "var(--club-primary, #6366f1)" }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Criar primeira carreira
      </button>
    </div>
  );
}

export function CareerSelection({ careers, onSelectCareer, onCreateNew, onCareersChange }: CareerSelectionProps) {
  const [localCareers, setLocalCareers] = useState(careers);

  useEffect(() => {
    setLocalCareers(careers);
  }, [careers]);

  const handleDelete = (id: string) => {
    deleteCareer(id);
    const updated = localCareers.filter((c) => c.id !== id);
    setLocalCareers(updated);
    onCareersChange(updated);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--app-bg, #0a0a0a)" }}
    >
      {/* Ambient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, var(--club-primary, #6366f1)08, transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="relative pt-14 pb-10 px-5 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <svg className="w-7 h-7 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
        </div>
        <p
          className="text-xs font-bold tracking-widest uppercase mb-3"
          style={{ color: "var(--club-primary, #6366f1)" }}
        >
          EA FC 26 · Modo Carreira
        </p>
        <h1 className="text-4xl font-black text-white tracking-tight mb-3">
          {localCareers.length > 0 ? "Suas Carreiras" : "FC Career Manager"}
        </h1>
        <p className="text-white/35 text-sm max-w-sm mx-auto leading-relaxed">
          {localCareers.length > 0
            ? "Continue de onde parou ou comece uma nova aventura"
            : "Gerencie sua carreira no modo técnico do EA FC 26"}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-10">
        <div className="max-w-xl mx-auto">
          {localCareers.length === 0 ? (
            <EmptyState onCreate={onCreateNew} />
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-6">
                {localCareers.map((career, i) => (
                  <CareerCard
                    key={career.id}
                    career={career}
                    onSelect={() => onSelectCareer(career)}
                    onDelete={() => handleDelete(career.id)}
                    index={i}
                  />
                ))}
              </div>

              <button
                onClick={onCreateNew}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-98"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px dashed rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.5)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nova Carreira
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
