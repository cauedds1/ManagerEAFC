export type FormationKey =
  | '4-3-3' | '4-3-3-cont' | '4-3-3-of' | '4-3-3-f9' | '4-3-3-def'
  | '4-4-2' | '4-4-2-seg'
  | '4-2-3-1' | '4-2-3-1-fech'
  | '4-1-2-1-2' | '4-1-2-1-2-fech'
  | '4-4-1-1' | '4-4-1-1-ma'
  | '4-5-1' | '4-5-1-at'
  | '4-2-2-2' | '4-2-4' | '4-1-4-1'
  | '3-4-1-2' | '3-4-2-1'
  | '3-4-3' | '3-4-3-los'
  | '3-1-4-2' | '3-5-2' | '3-5-1-1'
  | '5-2-1-2' | '5-2-2-1' | '5-3-2'
  | '5-4-1' | '5-4-1-los';

export interface FormationDef {
  key: FormationKey;
  label: string;
  positions: [number, number][];
}

const P4_DEF: [number, number][] = [[40, 330], [115, 330], [205, 330], [280, 330]];
const P3_DEF: [number, number][] = [[80, 330], [160, 330], [240, 330]];
const P5_DEF: [number, number][] = [[20, 330], [83, 330], [160, 330], [237, 330], [300, 330]];
const GK: [number, number] = [160, 400];

function pos(gk: [number, number], ...rows: [number, number][][]): [number, number][] {
  return [gk, ...rows.flat()];
}

function row(y: number, ...xs: number[]): [number, number][] {
  return xs.map((x) => [x, y] as [number, number]);
}

const FORMATION_POSITIONS: Record<FormationKey, [number, number][]> = {
  '4-3-3':          pos(GK, P4_DEF, row(218, 70, 160, 250),             row(100, 65, 160, 255)),
  '4-3-3-cont':     pos(GK, P4_DEF, row(218, 70, 160, 250),             row(100, 65, 160, 255)),
  '4-3-3-of':       pos(GK, P4_DEF, row(218, 70, 160, 250),             row(100, 65, 160, 255)),
  '4-3-3-f9':       pos(GK, P4_DEF, row(218, 70, 160, 250),             row(100, 65, 160, 255)),
  '4-3-3-def':      pos(GK, P4_DEF, row(218, 70, 160, 250),             row(100, 65, 160, 255)),
  '4-4-2':          pos(GK, P4_DEF, row(218, 40, 115, 205, 280),        row(100, 110, 210)),
  '4-4-2-seg':      pos(GK, P4_DEF, row(218, 40, 115, 205, 280),        row(100, 110, 210)),
  '4-2-3-1':        pos(GK, P4_DEF, row(265, 110, 210),                 row(182, 65, 160, 255), row(95, 160)),
  '4-2-3-1-fech':   pos(GK, P4_DEF, row(265, 110, 210),                 row(182, 65, 160, 255), row(95, 160)),
  '4-1-2-1-2':      pos(GK, P4_DEF, row(268, 160),                      row(198, 100, 220), row(130, 160), row(65, 100, 220)),
  '4-1-2-1-2-fech': pos(GK, P4_DEF, row(268, 160),                      row(198, 100, 220), row(130, 160), row(65, 100, 220)),
  '4-4-1-1':        pos(GK, P4_DEF, row(228, 40, 115, 205, 280),        row(148, 160), row(78, 160)),
  '4-4-1-1-ma':     pos(GK, P4_DEF, row(228, 40, 115, 205, 280),        row(148, 160), row(78, 160)),
  '4-5-1':          pos(GK, P4_DEF, row(218, 25, 88, 160, 232, 295),    row(95, 160)),
  '4-5-1-at':       pos(GK, P4_DEF, row(218, 25, 88, 160, 232, 295),    row(95, 160)),
  '4-2-2-2':        pos(GK, P4_DEF, row(258, 110, 210),                  row(175, 90, 230), row(90, 110, 210)),
  '4-2-4':          pos(GK, P4_DEF, row(248, 110, 210),                  row(115, 35, 120, 200, 285)),
  '4-1-4-1':        pos(GK, P4_DEF, row(268, 160),                       row(198, 40, 120, 200, 280), row(95, 160)),
  '3-4-1-2':        pos(GK, P3_DEF, row(252, 40, 118, 202, 280),         row(168, 160), row(90, 105, 215)),
  '3-4-2-1':        pos(GK, P3_DEF, row(252, 40, 118, 202, 280),         row(165, 105, 215), row(85, 160)),
  '3-4-3':          pos(GK, P3_DEF, row(248, 40, 118, 202, 280),         row(125, 65, 160, 255)),
  '3-4-3-los':      pos(GK, P3_DEF, row(258, 160),                       row(195, 88, 232), row(132, 160), row(65, 65, 160, 255)),
  '3-1-4-2':        pos(GK, P3_DEF, row(268, 160),                       row(198, 40, 118, 202, 280), row(95, 110, 210)),
  '3-5-2':          pos(GK, P3_DEF, row(228, 25, 88, 160, 232, 295),     row(95, 110, 210)),
  '3-5-1-1':        pos(GK, P3_DEF, row(228, 25, 88, 160, 232, 295),     row(148, 160), row(78, 160)),
  '5-2-1-2':        pos(GK, P5_DEF, row(258, 110, 210),                  row(188, 160), row(100, 110, 210)),
  '5-2-2-1':        pos(GK, P5_DEF, row(258, 110, 210),                  row(170, 105, 215), row(88, 160)),
  '5-3-2':          pos(GK, P5_DEF, row(232, 75, 160, 245),              row(100, 110, 210)),
  '5-4-1':          pos(GK, P5_DEF, row(228, 40, 115, 205, 280),         row(95, 160)),
  '5-4-1-los':      pos(GK, P5_DEF, row(268, 160),                       row(198, 88, 232), row(132, 160), row(72, 160)),
};

const LABELS: Record<FormationKey, string> = {
  '4-3-3': '4-3-3 Padrão', '4-3-3-cont': '4-3-3 Contenção', '4-3-3-of': '4-3-3 Ofensivo',
  '4-3-3-f9': '4-3-3 Falso 9', '4-3-3-def': '4-3-3 Defensivo',
  '4-4-2': '4-4-2 Padrão', '4-4-2-seg': '4-4-2 Segurar',
  '4-2-3-1': '4-2-3-1 Aberto', '4-2-3-1-fech': '4-2-3-1 Fechado',
  '4-1-2-1-2': '4-1-2-1-2 Aberto', '4-1-2-1-2-fech': '4-1-2-1-2 Fechado',
  '4-4-1-1': '4-4-1-1 Padrão', '4-4-1-1-ma': '4-4-1-1 Meia-atacante',
  '4-5-1': '4-5-1 Padrão', '4-5-1-at': '4-5-1 Ataque',
  '4-2-2-2': '4-2-2-2', '4-2-4': '4-2-4', '4-1-4-1': '4-1-4-1',
  '3-4-1-2': '3-4-1-2', '3-4-2-1': '3-4-2-1',
  '3-4-3': '3-4-3 Padrão', '3-4-3-los': '3-4-3 Losango',
  '3-1-4-2': '3-1-4-2', '3-5-2': '3-5-2', '3-5-1-1': '3-5-1-1',
  '5-2-1-2': '5-2-1-2', '5-2-2-1': '5-2-2-1', '5-3-2': '5-3-2',
  '5-4-1': '5-4-1 Padrão', '5-4-1-los': '5-4-1 Losango',
};

export interface FormationGroup {
  label: string;
  formations: FormationDef[];
}

export const FORMATION_GROUPS: FormationGroup[] = [
  {
    label: '4 Defensores',
    formations: (['4-3-3','4-3-3-cont','4-3-3-of','4-3-3-f9','4-3-3-def',
      '4-4-2','4-4-2-seg','4-2-3-1','4-2-3-1-fech','4-1-2-1-2','4-1-2-1-2-fech',
      '4-4-1-1','4-4-1-1-ma','4-5-1','4-5-1-at','4-2-2-2','4-2-4','4-1-4-1'] as FormationKey[])
      .map((k) => ({ key: k, label: LABELS[k], positions: FORMATION_POSITIONS[k] })),
  },
  {
    label: '3 Defensores',
    formations: (['3-4-1-2','3-4-2-1','3-4-3','3-4-3-los','3-1-4-2','3-5-2','3-5-1-1'] as FormationKey[])
      .map((k) => ({ key: k, label: LABELS[k], positions: FORMATION_POSITIONS[k] })),
  },
  {
    label: '5 Defensores',
    formations: (['5-2-1-2','5-2-2-1','5-3-2','5-4-1','5-4-1-los'] as FormationKey[])
      .map((k) => ({ key: k, label: LABELS[k], positions: FORMATION_POSITIONS[k] })),
  },
];

export function getFormationPositions(key: FormationKey): [number, number][] {
  return FORMATION_POSITIONS[key];
}

export function getFormationLabel(key: FormationKey): string {
  return LABELS[key];
}

export const DEFAULT_FORMATION: FormationKey = '4-3-3';

export type PosGroup = 'GOL' | 'DEF' | 'MID' | 'ATA';

export function pickBestEleven(
  players: { id: number; positionPtBr: string }[],
  formationKey: FormationKey,
): number[] {
  const positions = FORMATION_POSITIONS[formationKey];
  const numSlots = Math.min(11, positions.length);
  const slots: number[] = Array(numSlots).fill(0);
  const used = new Set<number>();

  const validGroups: PosGroup[] = ['GOL', 'DEF', 'MID', 'ATA'];
  const byGroup: Record<PosGroup, { id: number }[]> = { GOL: [], DEF: [], MID: [], ATA: [] };
  for (const p of players) {
    const g: PosGroup = validGroups.includes(p.positionPtBr as PosGroup)
      ? (p.positionPtBr as PosGroup)
      : 'MID';
    byGroup[g].push(p);
  }

  const pick = (pool: { id: number }[]): { id: number } | undefined =>
    pool.find((p) => !used.has(p.id));

  const assign = (si: number, p: { id: number } | undefined) => {
    if (!p || si >= numSlots) return;
    slots[si] = p.id;
    used.add(p.id);
  };

  // Slot 0 → GK
  assign(0, pick(byGroup.GOL));

  // Classify remaining slots by y-coordinate
  const defSlots: number[] = [];
  const midSlots: number[] = [];
  const atkSlots: number[] = [];
  for (let i = 1; i < numSlots; i++) {
    const y = positions[i][1];
    if (y >= 300) defSlots.push(i);
    else if (y < 160) atkSlots.push(i);
    else midSlots.push(i);
  }

  for (const si of defSlots) assign(si, pick(byGroup.DEF));
  for (const si of atkSlots) assign(si, pick(byGroup.ATA));
  for (const si of midSlots) assign(si, pick(byGroup.MID));

  // Fill any remaining empty slots with any unused player
  for (let i = 0; i < numSlots; i++) {
    if (slots[i] === 0) {
      const p = players.find((pl) => !used.has(pl.id));
      if (p) { slots[i] = p.id; used.add(p.id); }
    }
  }

  return slots;
}
