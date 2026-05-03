import { useMemo, useState } from "react";
import type { PositionPtBr } from "@/lib/squadCache";
import type { SquadPlayer } from "@/lib/squadCache";
import { PT_BR_TO_POSITION } from "@/lib/squadCache";
import {
  getBasePlayers,
  addBasePlayer,
  removeBasePlayer,
  updateBasePlayer,
  isReadyToPromote,
  generateBasePlayerId,
  BASE_MAX_SLOTS,
  BASE_MIN_AGE,
  BASE_MAX_AGE,
  type BasePlayer,
} from "@/lib/baseStorage";
import { addCustomPlayer, generateCustomPlayerId } from "@/lib/customPlayersStorage";
import { setPlayerOverride } from "@/lib/playerStatsStorage";
import { addCriaId } from "@/lib/criaStorage";
import { emitPromotionNews } from "@/lib/basePromotionNews";
import { useLang } from "@/hooks/useLang";
import { BASE as BASE_I18N } from "@/lib/i18n";

interface BaseViewProps {
  careerId: string;
  seasonId: string;
  seasonLabel: string;
  clubName: string;
  onPromoted?: () => void;
}

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)", color: "#f87171" },
};

interface FormState {
  firstName: string;
  lastName: string;
  position: PositionPtBr;
  age: string;
  nationality: string;
  overall: string;
  potentialMin: string;
  potentialMax: string;
  photo: string;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  position: "MID",
  age: "16",
  nationality: "Brazil",
  overall: "55",
  potentialMin: "70",
  potentialMax: "80",
  photo: "",
};

function PotentialBadge({ min, max }: { min: number; max: number }) {
  const tier = max >= 88 ? "elite" : max >= 75 ? "promissor" : "modesto";
  const color = tier === "elite"
    ? { bg: "rgba(234,179,8,0.18)", fg: "#facc15" }
    : tier === "promissor"
    ? { bg: "rgba(99,102,241,0.20)", fg: "#a5b4fc" }
    : { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.55)" };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums"
      style={{ background: color.bg, color: color.fg }}
      title={`Potencial: ${min}-${max}`}
    >
      {min}–{max}
    </span>
  );
}

export function BaseView({ careerId, seasonId, seasonLabel, clubName, onPromoted }: BaseViewProps) {
  const [lang] = useLang();
  const t = BASE_I18N[lang];

  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const players = useMemo(() => getBasePlayers(careerId), [careerId, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleAdd = () => {
    setError(null);
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const age = parseInt(form.age, 10);
    const overall = parseInt(form.overall, 10);
    const potentialMin = parseInt(form.potentialMin, 10);
    const potentialMax = parseInt(form.potentialMax, 10);

    if (!firstName || !lastName) { setError(t.errName); return; }
    if (!form.nationality.trim()) { setError(t.errNat); return; }
    if (Number.isNaN(age) || age < BASE_MIN_AGE || age > BASE_MAX_AGE) {
      setError(t.errAge); return;
    }
    if (Number.isNaN(overall) || overall < 30 || overall > 99) {
      setError(t.errOvr); return;
    }
    if (Number.isNaN(potentialMin) || Number.isNaN(potentialMax)
      || potentialMin < overall || potentialMax < potentialMin
      || potentialMax > 99 || potentialMin > 99) {
      setError(t.errPotential); return;
    }
    if (players.length >= BASE_MAX_SLOTS) { setError(t.errFull); return; }

    addBasePlayer(careerId, {
      id: generateBasePlayerId(),
      firstName, lastName,
      position: form.position,
      age, overall, potentialMin, potentialMax,
      nationality: form.nationality.trim(),
      photo: form.photo.trim() || undefined,
      addedAt: Date.now(),
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    refresh();
  };

  const handlePromote = (p: BasePlayer) => {
    if (!confirm(t.confirmPromote.replace("{name}", `${p.firstName} ${p.lastName}`))) return;
    const newId = generateCustomPlayerId();
    const fullName = `${p.firstName} ${p.lastName}`;
    const player: SquadPlayer = {
      id: newId,
      name: fullName,
      age: p.age,
      position: PT_BR_TO_POSITION[p.position],
      positionPtBr: p.position,
      photo: p.photo ?? "",
    };
    addCustomPlayer(careerId, player);
    setPlayerOverride(careerId, newId, {
      overall: p.overall,
      nationality: p.nationality,
    });
    addCriaId(careerId, newId, seasonId, seasonLabel);
    updateBasePlayer(careerId, p.id, { promotedAt: Date.now(), promotedAsId: newId });
    try {
      emitPromotionNews(seasonId, careerId, p, clubName, lang);
    } catch (err) {
      console.error("[base] emitPromotionNews failed", err);
    }
    refresh();
    onPromoted?.();
  };

  const handleRelease = (p: BasePlayer) => {
    if (!confirm(t.confirmRelease.replace("{name}", `${p.firstName} ${p.lastName}`))) return;
    removeBasePlayer(careerId, p.id);
    refresh();
  };

  const slotsLabel = `${players.length}/${BASE_MAX_SLOTS}`;

  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-black text-base">{t.heading}</h2>
          <p className="text-white/40 text-xs mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg tabular-nums"
            style={{
              background: players.length >= BASE_MAX_SLOTS
                ? "rgba(239,68,68,0.15)"
                : "rgba(var(--club-primary-rgb),0.12)",
              color: players.length >= BASE_MAX_SLOTS
                ? "#f87171"
                : "var(--club-primary)",
            }}
          >
            {slotsLabel}
          </span>
          <button
            onClick={() => { setShowAdd(true); setError(null); }}
            disabled={players.length >= BASE_MAX_SLOTS}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--club-gradient)" }}
          >
            + {t.addBtn}
          </button>
        </div>
      </div>

      {players.length === 0 && (
        <div
          className="rounded-xl px-5 py-8 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}
        >
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-white/60 text-sm font-semibold">{t.emptyTitle}</p>
          <p className="text-white/30 text-xs mt-1">{t.emptyDesc}</p>
        </div>
      )}

      <div className="space-y-2">
        {players.map((p) => {
          const ready = isReadyToPromote(p);
          const pos = POS_STYLE[p.position];
          return (
            <div
              key={p.id}
              className="rounded-xl px-3 py-2.5 flex items-center gap-3"
              style={{
                background: ready ? "rgba(234,179,8,0.06)" : "rgba(255,255,255,0.04)",
                border: ready
                  ? "1px solid rgba(234,179,8,0.25)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: "rgba(var(--club-primary-rgb),0.10)" }}
              >
                {p.photo ? (
                  <img src={p.photo} alt="" className="w-9 h-9 object-cover" />
                ) : (
                  <span className="text-base">🌱</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-white text-sm font-semibold leading-tight truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  {ready && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded leading-none"
                      style={{ background: "rgba(234,179,8,0.20)", color: "#facc15" }}
                      title={t.readyTooltip}
                    >
                      ⭐ {t.readyBadge}
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-[11px] mt-0.5 truncate">
                  {p.age} {t.yrs} · {p.nationality} · OVR {p.overall}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PotentialBadge min={p.potentialMin} max={p.potentialMax} />
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: pos.bg, color: pos.color }}
                >
                  {p.position}
                </span>
                <button
                  onClick={() => handlePromote(p)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: "var(--club-gradient)" }}
                >
                  {t.promoteBtn}
                </button>
                <button
                  onClick={() => handleRelease(p)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title={t.releaseTooltip}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ background: "var(--app-bg)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <h3 className="text-white font-black text-base">{t.addTitle}</h3>
                <p className="text-white/40 text-xs mt-0.5">{t.addSubtitle}</p>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/08"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.firstName}>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t.lastName}>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.position}>
                  <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as PositionPtBr })} className={inputCls}>
                    <option value="GOL">GOL</option>
                    <option value="DEF">DEF</option>
                    <option value="MID">MID</option>
                    <option value="ATA">ATA</option>
                  </select>
                </Field>
                <Field label={t.nationality}>
                  <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Brazil" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={`${t.age} (${BASE_MIN_AGE}-${BASE_MAX_AGE})`}>
                  <input type="number" min={BASE_MIN_AGE} max={BASE_MAX_AGE} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className={inputCls} />
                </Field>
                <Field label="OVR">
                  <input type="number" min={30} max={99} value={form.overall} onChange={(e) => setForm({ ...form, overall: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t.potential}>
                  <div className="flex items-center gap-1">
                    <input type="number" min={30} max={99} value={form.potentialMin} onChange={(e) => setForm({ ...form, potentialMin: e.target.value })} className={inputCls} />
                    <span className="text-white/30">–</span>
                    <input type="number" min={30} max={99} value={form.potentialMax} onChange={(e) => setForm({ ...form, potentialMax: e.target.value })} className={inputCls} />
                  </div>
                </Field>
              </div>
              <Field label={`${t.photo} (${t.optional})`}>
                <input value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://…" className={inputCls} />
              </Field>
              {error && (
                <div className="px-3 py-2 rounded-lg text-xs text-red-300" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
                  {error}
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white/40 hover:text-white/70 hover:bg-white/06">{t.cancel}</button>
              <button onClick={handleAdd} className="flex-1 py-2 rounded-xl text-sm font-black text-white" style={{ background: "var(--club-gradient)" }}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-2.5 py-1.5 rounded-lg text-white text-sm font-semibold focus:outline-none tabular-nums";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/40 text-[11px] font-medium">{label}</label>
      <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }}>
        {children}
      </div>
    </div>
  );
}
