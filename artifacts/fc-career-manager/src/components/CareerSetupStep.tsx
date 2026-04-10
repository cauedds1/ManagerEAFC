import { useState, useCallback } from "react";
import { ClubEntry } from "@/types/club";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";

interface ClubTitle {
  name: string;
  count: number;
}

interface CareerSetupStepProps {
  club: ClubEntry;
  season: string;
  clubInfo?: { description?: string; titles?: ClubTitle[] };
  onConfirm: (projeto: string, competitions: string[]) => void;
  onBack: () => void;
  confirming?: boolean;
}

const PROJETO_EXAMPLES = [
  "Vencer a Champions em 3 temporadas",
  "Reconstruir o clube com jovens talentos",
  "Conquistar o campeonato nacional",
  "Elevar o clube ao topo europeu",
  "Desenvolver jogadores para vendas lucrativas",
];

function getLeagueSuggestions(league: string): string[] {
  const l = league.toLowerCase();
  const base: string[] = [];

  if (l.includes("premier")) base.push("Premier League", "Copa da FA", "Copa da Liga");
  else if (l.includes("championship")) base.push("Championship", "Copa da FA");
  else if (l.includes("la liga") || l.includes("española")) base.push("La Liga", "Copa del Rey");
  else if (l.includes("bundesliga")) base.push("Bundesliga", "DFB-Pokal");
  else if (l.includes("serie a") && !l.includes("brasileiro")) base.push("Serie A", "Coppa Italia");
  else if (l.includes("ligue 1")) base.push("Ligue 1", "Coupe de France");
  else if (l.includes("brasileiro") || l.includes("brazil")) base.push("Campeonato Brasileiro", "Copa do Brasil");
  else if (l.includes("eredivisie")) base.push("Eredivisie", "Copa KNVB");
  else if (l.includes("primeira")) base.push("Primeira Liga", "Taça de Portugal");
  else base.push("Campeonato Nacional", "Copa Nacional");

  return [...base, "Liga dos Campeões", "Europa League", "Conference League"];
}

function CompetitionChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: "rgba(var(--club-primary-rgb),0.15)",
        border: "1px solid rgba(var(--club-primary-rgb),0.3)",
        color: "var(--club-primary)",
      }}
    >
      {name}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors hover:bg-white/20 -mr-0.5"
        style={{ color: "var(--club-primary)" }}
      >
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

function SuggestionChip({ name, onAdd, added }: { name: string; onAdd: () => void; added: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={added}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-default"
      style={{
        background: added ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: added ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.45)",
      }}
    >
      {added ? (
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" d="M6 2v8M2 6h8" />
        </svg>
      )}
      {name}
    </button>
  );
}

export function CareerSetupStep({
  club,
  season,
  clubInfo,
  onConfirm,
  onBack,
  confirming,
}: CareerSetupStepProps) {
  const [projeto, setProjeto] = useState("");
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [newComp, setNewComp] = useState("");
  const [generatingProjeto, setGeneratingProjeto] = useState(false);
  const [projetoError, setProjetoError] = useState("");

  const suggestions = getLeagueSuggestions(club.league);

  const addCompetition = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (competitions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    setCompetitions((prev) => [...prev, trimmed]);
    setNewComp("");
  }, [competitions]);

  const removeCompetition = useCallback((idx: number) => {
    setCompetitions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAddInput = () => {
    if (newComp.trim()) addCompetition(newComp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddInput(); }
  };

  const handleGenerateProjeto = async () => {
    setGeneratingProjeto(true);
    setProjetoError("");
    try {
      const res = await fetch("/api/generate-projeto", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
        body: JSON.stringify({
          clubName: club.name,
          clubLeague: club.league,
          clubCountry: club.country,
          clubDescription: clubInfo?.description,
          clubTitles: clubInfo?.titles,
        }),
      });
      if (!res.ok) throw new Error("Erro ao gerar");
      const data = await res.json() as { projeto: string };
      if (data.projeto) setProjeto(data.projeto);
      else throw new Error("Resposta vazia");
    } catch {
      setProjetoError("Não foi possível gerar. Verifique sua chave OpenAI.");
    } finally {
      setGeneratingProjeto(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="text-center mb-1">
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--club-primary)" }}>
          Etapa 4 de 4 · Configurar Carreira
        </p>
        <h2 className="text-2xl font-black text-white">Configure sua carreira</h2>
        <p className="text-white/40 text-sm">Defina o projeto e as competições da temporada</p>
      </div>

      {/* Club mini-header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl glass"
        style={{ border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
      >
        {club.logo && (
          <img src={club.logo} alt={club.name} className="w-7 h-7 object-contain flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">{club.name}</p>
          <p className="text-white/35 text-xs">{club.league} · {season}</p>
        </div>
      </div>

      {/* Projeto */}
      <div className="rounded-2xl p-4 glass">
        <div className="flex items-start gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(var(--club-primary-rgb),0.15)" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="var(--club-primary)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm">Projeto de Carreira</h3>
            <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
              O projeto que o clube apresenta ao técnico. A diretoria vai cobrar e reagir com base neste projeto — os torcedores não sabem.
            </p>
          </div>
        </div>

        <textarea
          value={projeto}
          onChange={(e) => setProjeto(e.target.value)}
          placeholder="Descreva o projeto do clube...&#10;Ex: Nosso objetivo é reconstruir o elenco com jovens talentos e conquistar a Premier League em 4 temporadas."
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-sm text-white resize-none transition-all outline-none placeholder-white/20"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            lineHeight: 1.6,
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(var(--club-primary-rgb),0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />

        {/* Gerar com IA + quick-fill suggestions */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateProjeto}
              disabled={generatingProjeto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "rgba(var(--club-primary-rgb),0.15)",
                border: "1px solid rgba(var(--club-primary-rgb),0.3)",
                color: "var(--club-primary)",
              }}
            >
              {generatingProjeto ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Gerar com IA
                </>
              )}
            </button>
            {projetoError && (
              <p className="text-red-400/70 text-xs">{projetoError}</p>
            )}
          </div>

          <div>
            <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-1">Sugestões manuais</p>
            <div className="flex flex-wrap gap-1.5">
              {PROJETO_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setProjeto(ex)}
                  className="text-xs px-2.5 py-1 rounded-full transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competições */}
      <div className="rounded-2xl p-4 glass">
        <div className="flex items-start gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(var(--club-primary-rgb),0.15)" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="var(--club-primary)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Competições da Temporada</h3>
            <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
              Quais torneios você vai disputar? Eles vão aparecer ao registrar uma partida.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newComp}
            onChange={(e) => setNewComp(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome da competição..."
            className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder-white/20 transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(var(--club-primary-rgb),0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <button
            onClick={handleAddInput}
            disabled={!newComp.trim()}
            className="px-3.5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
            style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)" }}
          >
            + Adicionar
          </button>
        </div>

        {competitions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {competitions.map((c, i) => (
              <CompetitionChip key={i} name={c} onRemove={() => removeCompetition(i)} />
            ))}
          </div>
        )}

        <div>
          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Sugestões para {club.league}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <SuggestionChip
                key={s}
                name={s}
                onAdd={() => addCompetition(s)}
                added={competitions.some((c) => c.toLowerCase() === s.toLowerCase())}
              />
            ))}
          </div>
        </div>

        {competitions.length === 0 && (
          <p className="text-white/15 text-xs mt-2 text-center">
            Nenhuma competição adicionada — você pode pular esta etapa
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={confirming}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200 disabled:opacity-40 glass glass-hover"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          onClick={() => onConfirm(projeto.trim(), competitions)}
          disabled={confirming}
          className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
        >
          {confirming ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Iniciando carreira...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Confirmar e Iniciar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
