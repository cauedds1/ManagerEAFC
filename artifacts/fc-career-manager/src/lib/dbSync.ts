import { loadSeasonData, loadCareerData, putSeasonData, putCareerData } from "@/lib/apiStorage";
import { hydrateRivalsCache } from "@/lib/rivalsStorage";
import { hydrateFanMoodCache } from "@/lib/fanMoodStorage";
import { sessionSet, sessionGet } from "@/lib/sessionStore";

function matchesKey(sid: string) { return `fc-career-manager-matches-${sid}`; }
function statsKey(sid: string) { return `fc-career-manager-stats-${sid}`; }
function transfersKey(sid: string) { return `fc-career-manager-transfers-${sid}`; }
function leagueKey(sid: string) { return `fc-career-manager-league-${sid}`; }
function financeKey(sid: string) { return `fc-financeiro-settings-${sid}`; }
function newsKey(sid: string) { return `fc-career-noticias-${sid}`; }
function injuryKey(sid: string) { return `fc-injuries-${sid}`; }
function summaryKey(sid: string) { return `fc-season-summary-${sid}`; }

function overridesKey(cid: string) { return `fc-career-manager-overrides-${cid}`; }
function lineupKey(cid: string) { return `fc-career-manager-lineup-${cid}`; }
function benchKey(cid: string) { return `fc-career-manager-bench-${cid}`; }
function formationKey(cid: string) { return `fc-career-manager-formation-${cid}`; }
function membersKey(cid: string) { return `fc-diretoria-members-${cid}`; }
function meetingsKey(cid: string) { return `fc-diretoria-meetings-${cid}`; }
function notifKey(cid: string) { return `fc-diretoria-notifications-${cid}`; }
function convKey(cid: string, mid: string) { return `fc-diretoria-conv-${cid}-${mid}`; }
function trophiesKey(cid: string) { return `fc-cm-trophies-${cid}`; }
function compResultsKey(cid: string) { return `fc-cm-comp-results-${cid}`; }
function customPlayersKey(cid: string) { return `fc-career-manager-custom-players-${cid}`; }
function formerPlayersKey(cid: string) { return `fc-career-manager-former-players-${cid}`; }
function hiddenKey(cid: string) { return `fc-career-manager-hidden-players-${cid}`; }

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

  if (data.matches !== undefined) sessionSet(matchesKey(seasonId), data.matches);
  if (data.player_stats !== undefined) sessionSet(statsKey(seasonId), data.player_stats);
  if (data.transfers !== undefined) sessionSet(transfersKey(seasonId), data.transfers);
  if (data.league_position !== undefined) sessionSet(leagueKey(seasonId), data.league_position);
  if (data.finances !== undefined) sessionSet(financeKey(seasonId), data.finances);
  if (data.news !== undefined) sessionSet(newsKey(seasonId), data.news);
  if (data.injuries !== undefined) sessionSet(injuryKey(seasonId), data.injuries);
  if (data.rivals !== undefined || data.rivalsLocked !== undefined) hydrateRivalsCache(seasonId, data);
  if (data.fan_mood !== undefined) hydrateFanMoodCache(seasonId, data);
  if (data.season_summary !== undefined) sessionSet(summaryKey(seasonId), data.season_summary);
}

async function migrateSeasonToDb(seasonId: string): Promise<void> {
  const matches = getLocal(matchesKey(seasonId));
  const stats = getLocal(statsKey(seasonId));
  const transfers = getLocal(transfersKey(seasonId));
  const league = getLocal(leagueKey(seasonId));
  const finances = getLocal(financeKey(seasonId));
  const news = getLocal(newsKey(seasonId));
  const injuries = getLocal(injuryKey(seasonId));

  const tasks: Promise<void>[] = [];
  if (matches) { sessionSet(matchesKey(seasonId), matches); tasks.push(putSeasonData(seasonId, "matches", matches)); }
  if (stats) { sessionSet(statsKey(seasonId), stats); tasks.push(putSeasonData(seasonId, "player_stats", stats)); }
  if (transfers) { sessionSet(transfersKey(seasonId), transfers); tasks.push(putSeasonData(seasonId, "transfers", transfers)); }
  if (league) { sessionSet(leagueKey(seasonId), league); tasks.push(putSeasonData(seasonId, "league_position", league)); }
  if (finances) { sessionSet(financeKey(seasonId), finances); tasks.push(putSeasonData(seasonId, "finances", finances)); }
  if (news) { sessionSet(newsKey(seasonId), news); tasks.push(putSeasonData(seasonId, "news", news)); }
  if (injuries) { sessionSet(injuryKey(seasonId), injuries); tasks.push(putSeasonData(seasonId, "injuries", injuries)); }

  const rivalsRaw = getLocal<string[]>(`fc-rivals-${seasonId}`);
  const rivalsLocked = localStorage.getItem(`fc-rivals-locked-${seasonId}`) === "1";
  if (rivalsRaw) { hydrateRivalsCache(seasonId, { rivals: rivalsRaw }); tasks.push(putSeasonData(seasonId, "rivals", rivalsRaw)); }
  if (rivalsLocked) { hydrateRivalsCache(seasonId, { rivalsLocked: true }); tasks.push(putSeasonData(seasonId, "rivalsLocked", true)); }

  const fanMoodRaw = localStorage.getItem(`fc-fan-mood-${seasonId}`);
  if (fanMoodRaw !== null) {
    const v = Number(fanMoodRaw);
    if (!isNaN(v)) { hydrateFanMoodCache(seasonId, { fan_mood: v }); tasks.push(putSeasonData(seasonId, "fan_mood", v)); }
  }

  await Promise.all(tasks);
}

export async function syncCareerFromDb(careerId: string): Promise<void> {
  const data = await loadCareerData(careerId);

  if (Object.keys(data).length === 0) {
    await migrateCareerToDb(careerId);
    return;
  }

  if (data.overrides !== undefined) sessionSet(overridesKey(careerId), data.overrides);
  if (data.lineup !== undefined) {
    if (data.lineup === null) sessionSet(lineupKey(careerId), null);
    else sessionSet(lineupKey(careerId), data.lineup);
  }
  if (data.benchOrder !== undefined) {
    if (data.benchOrder === null) sessionSet(benchKey(careerId), null);
    else sessionSet(benchKey(careerId), data.benchOrder);
  }
  if (data.formation !== undefined && data.formation !== null) {
    sessionSet(formationKey(careerId), data.formation);
  }
  if (data.diretoria_members !== undefined) sessionSet(membersKey(careerId), data.diretoria_members);
  if (data.diretoria_meetings !== undefined) sessionSet(meetingsKey(careerId), data.diretoria_meetings);
  if (data.diretoria_notifications !== undefined) sessionSet(notifKey(careerId), data.diretoria_notifications);
  if (data.trophies !== undefined) sessionSet(trophiesKey(careerId), data.trophies);
  if (data.comp_results !== undefined) sessionSet(compResultsKey(careerId), data.comp_results);
  if (data.customPlayers !== undefined) sessionSet(customPlayersKey(careerId), data.customPlayers);
  if (data.formerPlayers !== undefined) sessionSet(formerPlayersKey(careerId), data.formerPlayers);
  if (data.hiddenPlayerIds !== undefined) sessionSet(hiddenKey(careerId), data.hiddenPlayerIds);

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("conv_")) {
      const memberId = key.slice(5);
      if (value !== null) {
        sessionSet(convKey(careerId, memberId), value);
      }
    }
  }
}

async function migrateCareerToDb(careerId: string): Promise<void> {
  const overrides = getLocal(overridesKey(careerId));
  const lineup = getLocal(lineupKey(careerId));
  const bench = getLocal(benchKey(careerId));
  const members = getLocal(membersKey(careerId));
  const meetings = getLocal(meetingsKey(careerId));
  const notifs = getLocal(notifKey(careerId));
  const trophies = getLocal(trophiesKey(careerId));
  const compResults = getLocal(compResultsKey(careerId));
  const customPlayers = getLocal(customPlayersKey(careerId));
  const formerPlayers = getLocal(formerPlayersKey(careerId));
  const hiddenPlayerIds = getLocal(hiddenKey(careerId));

  let formation: string | null = null;
  try { formation = localStorage.getItem(formationKey(careerId)); } catch {}

  const tasks: Promise<void>[] = [];

  if (overrides) { sessionSet(overridesKey(careerId), overrides); tasks.push(putCareerData(careerId, "overrides", overrides)); }
  if (lineup) { sessionSet(lineupKey(careerId), lineup); tasks.push(putCareerData(careerId, "lineup", lineup)); }
  if (bench) { sessionSet(benchKey(careerId), bench); tasks.push(putCareerData(careerId, "benchOrder", bench)); }
  if (formation) { sessionSet(formationKey(careerId), formation); tasks.push(putCareerData(careerId, "formation", formation)); }
  if (members) { sessionSet(membersKey(careerId), members); tasks.push(putCareerData(careerId, "diretoria_members", members)); }
  if (meetings) { sessionSet(meetingsKey(careerId), meetings); tasks.push(putCareerData(careerId, "diretoria_meetings", meetings)); }
  if (notifs) { sessionSet(notifKey(careerId), notifs); tasks.push(putCareerData(careerId, "diretoria_notifications", notifs)); }
  if (trophies) { sessionSet(trophiesKey(careerId), trophies); tasks.push(putCareerData(careerId, "trophies", trophies)); }
  if (compResults) { sessionSet(compResultsKey(careerId), compResults); tasks.push(putCareerData(careerId, "comp_results", compResults)); }
  if (customPlayers) { sessionSet(customPlayersKey(careerId), customPlayers); tasks.push(putCareerData(careerId, "customPlayers", customPlayers)); }
  if (formerPlayers) { sessionSet(formerPlayersKey(careerId), formerPlayers); tasks.push(putCareerData(careerId, "formerPlayers", formerPlayers)); }
  if (hiddenPlayerIds) { sessionSet(hiddenKey(careerId), hiddenPlayerIds); tasks.push(putCareerData(careerId, "hiddenPlayerIds", hiddenPlayerIds)); }

  const allKeys = Object.keys(localStorage);
  const convPrefix = `fc-diretoria-conv-${careerId}-`;
  for (const lsKey of allKeys) {
    if (lsKey.startsWith(convPrefix)) {
      const memberId = lsKey.slice(convPrefix.length);
      const conv = getLocal(lsKey);
      if (conv) {
        sessionSet(convKey(careerId, memberId), conv);
        tasks.push(putCareerData(careerId, `conv_${memberId}`, conv));
      }
    }
  }

  await Promise.all(tasks);
}

export function getSessionValue<T>(key: string): T | null {
  return sessionGet<T>(key);
}
