/* ─── ClubDemoMockup ──────────────────────────────────────────────────────────
   Live fake app dashboard for the landing-page club-theme section.
   All demo data is derived deterministically from `clubName` so every club
   gets its own unique (but fictional) stats and match history.
──────────────────────────────────────────────────────────────────────────── */

interface Props {
  clubName:   string;
  leagueName: string;
  accent:     string;
  accentRgb:  string;
  secondary?: string;
}

/* ── Deterministic hash ───────────────────────────────────── */
function h(s: string, salt = ""): number {
  const str = (s + salt).toLowerCase();
  let n = 0;
  for (let i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(n);
}

/* ── Short club name for match cards ─────────────────────── */
function short(name: string): string {
  const prefixes = ["FC", "SC", "AC", "RC", "CF", "GD", "SD", "AF", "FK", "PFC"];
  const words = name.split(" ");
  if (words.length >= 2 && prefixes.includes(words[0])) return words[1].slice(0, 10);
  if (name.length <= 10) return name;
  return words[0].slice(0, 9) + (words.length > 1 ? "." : "");
}

/* ── Static opponent pool ─────────────────────────────────── */
const OPPS = [
  "Rival FC","City SC","United AF","Athletic RK","Metro CF",
  "Capital SC","Northern FC","Dynamo SC","Eastern CF","Western SK",
  "Harbor FC","Valley SC","Summit AF","Coastal CF","Forest FC",
  "Plains SC","Ridge AF","Delta CF","Sunrise SK","Canyon FC",
];

const COMPS_POOL = ["Liga","Champions","Copa","Premier","Serie A","Ligue 1","Cups"];

/* ── Generate mock match list ─────────────────────────────── */
function buildMatches(clubName: string) {
  const clk = short(clubName);
  return Array.from({ length: 5 }, (_, i) => {
    const hi   = h(clubName, String(i));
    const home = (hi % 2 === 0);
    const opp  = OPPS[hi % OPPS.length];
    const mine = hi % 4;          // 0-3
    const theirs = h(clubName, `${i}o`) % 3; // 0-2
    const diff = mine - theirs;
    const result = diff > 0 ? "V" : diff < 0 ? "D" : "E";
    return {
      comp:    COMPS_POOL[hi % COMPS_POOL.length],
      team1:   home ? clk  : opp,
      score1:  home ? mine : theirs,
      team2:   home ? opp  : clk,
      score2:  home ? theirs : mine,
      result,
      rodada:  (hi % 12) + 1,
    };
  });
}

/* ── Result colour ────────────────────────────────────────── */
function resultCol(result: string, accent: string) {
  if (result === "V") return accent;
  if (result === "D") return "#ef4444";
  return "#444466";
}
function resultRgb(result: string, accentRgb: string) {
  if (result === "V") return accentRgb;
  if (result === "D") return "239,68,68";
  return "100,100,150";
}

/* ── Shield SVG ───────────────────────────────────────────── */
const Shield = ({ size = 20, accent }: { size?: number; accent: string }) => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: size, height: size, flexShrink: 0 }}>
    <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z"
      fill={accent + "33"} stroke={accent} strokeWidth={1.4}
      style={{ transition: "all 0.5s" }} />
  </svg>
);

const MiniShield = ({ accent }: { accent: string }) => (
  <div style={{ width: 22, height: 22, borderRadius: 6, background: accent + "22",
    border: `1px solid ${accent}44`, display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0, transition: "all 0.5s" }}>
    <Shield size={13} accent={accent} />
  </div>
);

/* ── Tabs ─────────────────────────────────────────────────── */
const TABS = ["Painel","Partidas","Clube","Transferências","Notícias","Diretoria","Momentos"];

/* ══════════════════════════════════════════════════════════════════════════ */
export function ClubDemoMockup({ clubName, leagueName, accent, accentRgb }: Props) {
  const seed       = h(clubName);
  const partidas   = 3  + (seed % 40);
  const elenco     = 24 + (h(clubName, "e") % 12);
  const transfers  = h(clubName, "t") % 8;
  const mood       = "Animada";
  const matches    = buildMatches(clubName);

  const T = (d: number) => `transition: all ${d}s ease`;

  return (
    <div style={{ background: "#0a0a14", fontFamily: "DM Sans, sans-serif",
      borderRadius: "0 0 12px 12px", overflow: "hidden" }}>

      {/* ── App header ── */}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: `1px solid rgba(${accentRgb},0.12)`,
        background: "#0c0c18" }}>

        {/* Left: shield + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `rgba(${accentRgb},0.12)`,
            border: `1px solid rgba(${accentRgb},0.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.5s" }}>
            <Shield size={22} accent={accent} />
          </div>
          <div>
            <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15,
              lineHeight: 1.2, transition: "color 0.4s" }}>{clubName}</div>
            <div style={{ color: "#444466", fontSize: 11,
              transition: "color 0.4s" }}>{leagueName}</div>
          </div>
        </div>

        {/* Right: mood badge + season + trocar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: `rgba(${accentRgb},0.15)`,
            border: `1px solid rgba(${accentRgb},0.35)`,
            borderRadius: 100, padding: "3px 10px", fontSize: 10,
            color: accent, fontWeight: 700, transition: "all 0.5s",
            display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: accent, transition: "background 0.5s" }} />
            {mood}
          </div>
          <span style={{ color: "#333355", fontSize: 10 }}>
            Temp: <span style={{ color: "#666688" }}>2026/27</span>
          </span>
          <div style={{ background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
            padding: "3px 9px", fontSize: 10, color: "#555577" }}>↔ Trocar</div>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "0 14px", background: "#0b0b16", overflowX: "auto" }}>
        {TABS.map((tab, i) => (
          <div key={tab} style={{ position: "relative", padding: "9px 11px",
            fontSize: 11.5, whiteSpace: "nowrap", flexShrink: 0,
            color: i === 0 ? accent : "#333355",
            fontWeight: i === 0 ? 600 : 400,
            borderBottom: i === 0 ? `2px solid ${accent}` : "2px solid transparent",
            transition: "all 0.5s" }}>
            {tab}
            {tab === "Notícias" && (
              <span style={{ position: "absolute", top: 5, right: 2,
                background: accent, borderRadius: 100, fontSize: 8,
                padding: "1px 4px", fontWeight: 700, color: "#fff",
                transition: "background 0.5s" }}>4</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        margin: "10px 12px", borderRadius: 10, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { label: "Partidas",       value: partidas,   sub: "registradas"   },
          { label: "Temporada",      value: "2026/27",  sub: "em andamento"  },
          { label: "Elenco",         value: elenco,     sub: "jogadores"     },
          { label: "Transferências", value: transfers,  sub: "movimentações" },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: "10px 12px", background: "#0a0a14",
            borderRight: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ color: "#2a2a44", fontSize: 9, marginBottom: 3,
              textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            <div style={{ color: "#f0f0ff", fontSize: 17, fontWeight: 700,
              lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ color: "#2a2a44", fontSize: 9, marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Últimas partidas ── */}
      <div style={{ padding: "0 12px 14px" }}>
        <div style={{ color: "#2a2a44", fontSize: 9, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          Últimas Partidas
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          {matches.map((m, i) => {
            const rCol = resultCol(m.result, accent);
            const rRgb = resultRgb(m.result, accentRgb);
            return (
              <div key={i} style={{ flex: "0 0 auto", width: "calc(20% - 6px)",
                borderRadius: 8,
                border: `1px solid rgba(${rRgb},0.25)`,
                background: m.result === "V" ? `rgba(${accentRgb},0.05)` : "#0d0d1a",
                padding: "7px 9px", transition: "all 0.5s" }}>

                {/* Comp + rodada */}
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 8.5, color: rCol, fontWeight: 700,
                    background: `rgba(${rRgb},0.15)`, padding: "2px 5px",
                    borderRadius: 3, transition: "all 0.5s",
                    maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" }}>{m.comp}</span>
                  <span style={{ fontSize: 8, color: "#222244" }}>Rd {m.rodada}</span>
                </div>

                {/* Home row */}
                <div style={{ display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5,
                    minWidth: 0 }}>
                    <MiniShield accent={accent} />
                    <span style={{ fontSize: 10, color: "#aaaacc", fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 48 }}>{m.team1}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#f0f0ff",
                    marginLeft: 4, flexShrink: 0 }}>{m.score1}</span>
                </div>

                {/* Away row */}
                <div style={{ display: "flex", alignItems: "center",
                  justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5,
                    minWidth: 0 }}>
                    <MiniShield accent="#555577" />
                    <span style={{ fontSize: 10, color: "#aaaacc", fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 48 }}>{m.team2}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#f0f0ff",
                    marginLeft: 4, flexShrink: 0 }}>{m.score2}</span>
                </div>

                {/* Footer result */}
                <div style={{ marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)",
                  paddingTop: 5, fontSize: 8, textAlign: "center",
                  color: rCol, fontWeight: 700, letterSpacing: "0.06em",
                  transition: "color 0.5s" }}>
                  {m.result === "V" ? "VITÓRIA" : m.result === "D" ? "DERROTA" : "EMPATE"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
