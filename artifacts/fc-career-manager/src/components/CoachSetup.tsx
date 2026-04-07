import { useState, useRef } from "react";
import { CoachProfile } from "@/types/career";
import { COUNTRIES } from "@/lib/countryList";

interface CoachSetupProps {
  onNext: (coach: CoachProfile) => void;
  initial?: CoachProfile | null;
}

export function CoachSetup({ onNext, initial }: CoachSetupProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(initial?.age ? String(initial.age) : "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "Brasil");
  const [nationalityFlag, setNationalityFlag] = useState(initial?.nationalityFlag ?? "🇧🇷");
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; age?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const errs: { name?: string; age?: string } = {};
    if (!name.trim()) errs.name = "Informe o nome do técnico";
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 18 || ageNum > 80) {
      errs.age = "Informe uma idade válida (18–80)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onNext({
      name: name.trim(),
      nationality,
      nationalityFlag,
      age: parseInt(age, 10),
      photo,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-8">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "var(--club-primary, #6366f1)" }}
        >
          Etapa 1 de 3
        </p>
        <h2 className="text-3xl font-black text-white mb-2">Seu Técnico</h2>
        <p className="text-white/40 text-sm">
          Crie o perfil do treinador que vai comandar o clube
        </p>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {/* Photo upload */}
        <div className="flex justify-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center group transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: photo ? "3px solid var(--club-primary, #6366f1)" : "2px dashed rgba(255,255,255,0.2)",
              }}
            >
              {photo ? (
                <img src={photo} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-7 h-7 text-white/25 group-hover:text-white/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="text-white/20 text-xs group-hover:text-white/40 transition-colors">Foto</span>
                </div>
              )}
              <div
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(undefined)}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-2">
            Nome completo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
            placeholder="Ex.: José Mourinho"
            className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 focus:outline-none transition-all duration-200 text-base"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${errors.name ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
            }}
            onFocus={(e) => { if (!errors.name) e.currentTarget.style.borderColor = "var(--club-primary, #6366f1)80"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = errors.name ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"; }}
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
        </div>

        {/* Nationality + Age in a row */}
        <div className="flex gap-3">
          {/* Nationality */}
          <div className="flex-1 relative">
            <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-2">
              Nacionalidade
            </label>
            <button
              type="button"
              onClick={() => setShowCountryList((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-2xl">{nationalityFlag}</span>
              <span className="text-white text-sm font-medium truncate flex-1">{nationality}</span>
              <svg className={`w-4 h-4 text-white/30 transition-transform ${showCountryList ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCountryList && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 shadow-2xl"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <input
                    autoFocus
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full px-3 py-1.5 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredCountries.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setNationality(c.name);
                        setNationalityFlag(c.flag);
                        setShowCountryList(false);
                        setCountrySearch("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/08 transition-colors"
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className={`text-sm ${nationality === c.name ? "text-white font-semibold" : "text-white/70"}`}>
                        {c.name}
                      </span>
                      {nationality === c.name && (
                        <svg className="w-4 h-4 ml-auto" style={{ color: "var(--club-primary, #6366f1)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-4">Nenhum país encontrado</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Age */}
          <div style={{ width: 120 }}>
            <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-2">
              Idade
            </label>
            <input
              type="number"
              min={18}
              max={80}
              value={age}
              onChange={(e) => { setAge(e.target.value); setErrors((prev) => ({ ...prev, age: undefined })); }}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder="40"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 focus:outline-none transition-all duration-200 text-base"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${errors.age ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
              }}
              onFocus={(e) => { if (!errors.age) e.currentTarget.style.borderColor = "var(--club-primary, #6366f1)80"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.age ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"; }}
            />
            {errors.age && <p className="mt-1.5 text-xs text-red-400 leading-tight">{errors.age}</p>}
          </div>
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 active:scale-98 mt-8"
        style={{ background: "var(--club-primary, #6366f1)" }}
      >
        <span className="flex items-center justify-center gap-2">
          Próximo — Escolher clube
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
    </div>
  );
}
