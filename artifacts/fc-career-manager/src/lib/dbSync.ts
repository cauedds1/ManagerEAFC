import { loadSeasonData, loadCareerData, putSeasonData, putCareerData } from "@/lib/apiStorage";

function matchesKey(sid: string) { return `fc-career-manager-matches-${sid}`; }
function statsKey(sid: string) { return `fc-career-manager-stats-${sid}`; }
function transfersKey(sid: string) { return `fc-career-manager-transfers-${sid}`; }
function leagueKey(sid: string) { return `fc-career-manager-league-${sid}`; }
function financeKey(sid: string) { return `fc-financeiro-settings-${sid}`; }
function newsKey(sid: string) { return `fc-career-noticias-${sid}`; }

function overridesKey(cid: string) { return `fc-career-manager-overrides-${cid}`; }
function lineupKey(cid: string) { return `fc-career-manager-lineup-${cid}`; }
function formationKey(cid: string) { return `fc-career-manager-formation-${cid}`; }
function membersKey(cid: string) { return `fc-diretoria-members-${cid}`; }
function meetingsKey(cid: string) { return `fc-diretoria-meetings-${cid}`; }
function notifKey(cid: string) { return `fc-diretoria-notifications-${cid}`; }
function convKey(cid: string, mid: string) { return `fc-diretoria-conv-${cid}-${mid}`; }

function setLocal(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function getLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export async function syncSeasonFromDb(seasonId: string): Promise<void> {
  const data = await loadSeasonData(seasonId);

  if (Object.keys(data).length === 0) {
    await migrateSeasonToDb(seasonId);
    return;
  }

  if (data.matches !== undefined) setLocal(matchesKey(seasonId), data.matches);
  if (data.player_stats !== undefined) setLocal(statsKey(seasonId), data.player_stats);
  if (data.transfers !== undefined) setLocal(transfersKey(seasonId), data.transfers);
  if (data.league_position !== undefined) setLocal(leagueKey(seasonId), data.league_position);
  if (data.finances !== undefined) setLocal(financeKey(seasonId), data.finances);
  if (data.news !== undefined) setLocal(newsKey(seasonId), data.news);
}

async function migrateSeasonToDb(seasonId: string): Promise<void> {
  const matches = getLocal(matchesKey(seasonId));
  const stats = getLocal(statsKey(seasonId));
  const transfers = getLocal(transfersKey(seasonId));
  const league = getLocal(leagueKey(seasonId));
  const finances = getLocal(financeKey(seasonId));
  const news = getLocal(newsKey(seasonId));

  const tasks: Promise<void>[] = [];
  if (matches) tasks.push(putSeasonData(seasonId, "matches", matches));
  if (stats) tasks.push(putSeasonData(seasonId, "player_stats", stats));
  if (transfers) tasks.push(putSeasonData(seasonId, "transfers", transfers));
  if (league) tasks.push(putSeasonData(seasonId, "league_position", league));
  if (finances) tasks.push(putSeasonData(seasonId, "finances", finances));
  if (news) tasks.push(putSeasonData(seasonId, "news", news));

  await Promise.all(tasks);
}

export async function syncCareerFromDb(careerId: string): Promise<void> {
  const data = await loadCareerData(careerId);

  if (Object.keys(data).length === 0) {
    await migrateCareerToDb(careerId);
    return;
  }

  if (data.overrides !== undefined) setLocal(overridesKey(careerId), data.overrides);
  if (data.lineup !== undefined) {
    if (data.lineup === null) {
      try { localStorage.removeItem(lineupKey(careerId)); } catch {}
    } else {
      setLocal(lineupKey(careerId), data.lineup);
    }
  }
  if (data.formation !== undefined && data.formation !== null) {
    try { localStorage.setItem(formationKey(careerId), data.formation as string); } catch {}
  }
  if (data.diretoria_members !== undefined) setLocal(membersKey(careerId), data.diretoria_members);
  if (data.diretoria_meetings !== undefined) setLocal(meetingsKey(careerId), data.diretoria_meetings);
  if (data.diretoria_notifications !== undefined) setLocal(notifKey(careerId), data.diretoria_notifications);

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("conv_")) {
      const memberId = key.slice(5);
      if (value !== null) {
        setLocal(convKey(careerId, memberId), value);
      }
    }
  }
}

async function migrateCareerToDb(careerId: string): Promise<void> {
  const overrides = getLocal(overridesKey(careerId));
  const lineup = getLocal(lineupKey(careerId));
  const members = getLocal(membersKey(careerId));
  const meetings = getLocal(meetingsKey(careerId));
  const notifs = getLocal(notifKey(careerId));

  let formation: string | null = null;
  try { formation = localStorage.getItem(formationKey(careerId)); } catch {}

  const tasks: Promise<void>[] = [];
  if (overrides) tasks.push(putCareerData(careerId, "overrides", overrides));
  if (lineup) tasks.push(putCareerData(careerId, "lineup", lineup));
  if (formation) tasks.push(putCareerData(careerId, "formation", formation));
  if (members) tasks.push(putCareerData(careerId, "diretoria_members", members));
  if (meetings) tasks.push(putCareerData(careerId, "diretoria_meetings", meetings));
  if (notifs) tasks.push(putCareerData(careerId, "diretoria_notifications", notifs));

  const allKeys = Object.keys(localStorage);
  const convPrefix = `fc-diretoria-conv-${careerId}-`;
  for (const lsKey of allKeys) {
    if (lsKey.startsWith(convPrefix)) {
      const memberId = lsKey.slice(convPrefix.length);
      const conv = getLocal(lsKey);
      if (conv) tasks.push(putCareerData(careerId, `conv_${memberId}`, conv));
    }
  }

  await Promise.all(tasks);
}
