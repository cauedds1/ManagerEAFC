import { useState, useEffect, useMemo } from "react";
import { Career } from "@/types/career";
import { deleteCareer } from "@/lib/careerStorage";
import { getClubColors, ClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME } from "@/lib/footballApiMap";
import { hexToRgb, SYSTEM_COLORS } from "@/lib/themeManager";

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

function resolveCareerColors(clubName: string): { primary: string; primaryRgb: string; gradient: string } {
  let colors: ClubColors | null = getClubColors(clubName);
  if (!colors) {
    const fc26Name = APIFOOTBALL_TO_FC26_NAME[clubName];
    if (fc26Name) colors = getClubColors(fc26Name);
  }
  if (!colors) colors = SYSTEM_COLORS;
  const [r, g, b] = hexToRgb(colors.primary);
  return {
    primary: colors.primary,
    primaryRgb: `${r},${g},${b}`,
    gradient: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
  };
}

function ClubLogo({ logo, name, rgb }: { logo: string; name: string; rgb: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.12)` }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`w-10 h-10 object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-lg font-black text-white/40">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function CoachPhoto({ photo, name, rgb }: { photo?: string; name: string; rgb: string }) {
  const [err, setErr] = useState(false);

  if (photo && !err) {
    return (
      <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
    );
  }

  const initials = name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center font-black text-xs text-white/60"
      style={{ background: `rgba(${rgb},0.1)` }}>
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
  const cc = useMemo(() => resolveCareerColors(career.clubName), [career.clubName]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setTimeout(() => onDelete(), 300);
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
        className="w-full text-left rounded-2xl overflow-hidden"
        style={{
          opacity: deleting ? 0 : 1,
          transform: deleting ? "scale(0.95)" : "scale(1)",
          transition: "opacity 300ms ease, transform 300ms ease, background 200ms, border-color 200ms",
          background: `rgba(${cc.primaryRgb},0.06)`,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: `rgba(${cc.primaryRgb},0.1)`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="h-0.5 w-full" style={{ background: cc.gradient }} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <ClubLogo logo={career.clubLogo} name={career.clubName} rgb={cc.primaryRgb} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-white font-black text-lg leading-tight truncate">
                  {career.clubName}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: `rgba(${cc.primaryRgb},0.1)`, color: cc.primary }}>
                  {career.season}
                </span>
              </div>
              <p className="text-white/40 text-sm truncate">{career.clubLeague}</p>
              {career.clubCountry && <p className="text-white/25 text-xs mt-0.5">{career.clubCountry}</p>}
            </div>
          </div>

          <div className="my-4" style={{ height: "1px", background: `rgba(${cc.primaryRgb},0.1)` }} />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: `1.5px solid rgba(${cc.primaryRgb},0.2)` }}>
              <CoachPhoto photo={career.coach.photo} name={career.coach.name} rgb={cc.primaryRgb} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{career.coach.nationalityFlag}</span>
                <p className="text-white font-semibold text-sm truncate">{career.coach.name}</p>
              </div>
              <p className="text-white/30 text-xs mt-0.5">{career.coach.nationality} · {career.coach.age} anos</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white/20 text-xs">criado em</p>
              <p className="text-white/35 text-xs">{formatDate(career.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid rgba(${cc.primaryRgb},0.08)` }}>
          <span className="text-white/30 text-xs font-medium group-hover:text-white/60 transition-colors">
            Clique para continuar a carreira
          </span>
          <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

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
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-up">
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center animate-float"
        style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", boxShadow: "0 0 40px rgba(var(--club-primary-rgb),0.1)" }}>
        <svg className="w-10 h-10" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-white font-black text-2xl mb-2">Comece sua jornada</h3>
        <p className="text-white/35 text-sm leading-relaxed max-w-xs">
          Crie seu primeiro perfil de tecnico, escolha um clube e construa um legado no EA FC 26
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
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
    <div className="relative min-h-screen flex flex-col">
      <div className="relative pt-14 pb-10 px-5 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 animate-float"
          style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", boxShadow: "0 0 40px rgba(var(--club-primary-rgb),0.1)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--club-primary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--club-primary)" }}>
          EA FC 26 · Modo Carreira
        </p>
        <h1 className="text-4xl font-black text-white tracking-tight mb-3">
          {localCareers.length > 0 ? "Suas Carreiras" : "FC Career Manager"}
        </h1>
        <p className="text-white/35 text-sm max-w-sm mx-auto leading-relaxed">
          {localCareers.length > 0
            ? "Continue de onde parou ou comece uma nova aventura"
            : "Gerencie sua carreira no modo tecnico do EA FC 26"}
        </p>
      </div>

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
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 glass glass-hover"
                style={{ borderStyle: "dashed", color: "rgba(255,255,255,0.5)" }}
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
