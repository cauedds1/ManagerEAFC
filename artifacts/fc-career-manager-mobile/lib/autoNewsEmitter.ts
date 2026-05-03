// PORTED FROM artifacts/fc-career-manager/src/lib/basePromotionNews.ts and a
// small subset of autoNewsEngine.ts — adapted to the mobile NewsItem shape
// (headline/body/type) and persisted via api.seasonData.set('news', ...).
//
// This is intentionally a minimal slice of the web auto-news pipeline: it
// covers post-match milestone news (big result, win streak) plus academy
// promotion news. It is idempotent at the storage layer (each event has a
// stable key).

import { api, type NewsItem, type MatchRecord } from '@/lib/api';
import { wasEventHandled, markEventHandled } from '@/lib/autoNewsStorage';

function genId(): string {
  return `news_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function appendNews(seasonId: string, item: NewsItem): Promise<void> {
  const current = await api.seasonData.get(seasonId);
  const list: NewsItem[] = (current?.data?.news as NewsItem[] | undefined) ?? [];
  await api.seasonData.set(seasonId, 'news', [item, ...list]);
}

export async function emitMatchMilestoneNews(
  seasonId: string,
  match: MatchRecord,
  allMatches: MatchRecord[],
  clubName: string,
): Promise<void> {
  const diff = match.myScore - match.opponentScore;

  if (Math.abs(diff) >= 4) {
    const key = `bigresult_${match.id}`;
    if (!wasEventHandled(seasonId, key)) {
      const win = diff > 0;
      await appendNews(seasonId, {
        id: genId(),
        headline: win
          ? `Goleada do ${clubName}: ${match.myScore}x${match.opponentScore} contra ${match.opponent}`
          : `${clubName} sofre goleada: ${match.myScore}x${match.opponentScore} para ${match.opponent}`,
        body: win
          ? `O ${clubName} aplicou ${match.myScore}x${match.opponentScore} no ${match.opponent} em ${match.tournament}. ` +
            `Resultado expressivo que deve marcar a temporada.`
          : `O ${clubName} foi derrotado por ${match.opponentScore}x${match.myScore} pelo ${match.opponent}. ` +
            `Pressão sobre o elenco aumenta.`,
        type: 'resultado',
        createdAt: Date.now(),
        matchId: match.id,
        source: 'auto',
      });
      markEventHandled(seasonId, key);
    }
  }

  const sorted = [...allMatches].sort((a, b) => a.createdAt - b.createdAt);
  let winStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].myScore > sorted[i].opponentScore) winStreak++;
    else break;
  }
  if (winStreak === 5 || winStreak === 10) {
    const key = `streak_${winStreak}_${match.id}`;
    if (!wasEventHandled(seasonId, key)) {
      await appendNews(seasonId, {
        id: genId(),
        headline: `${clubName} chega a ${winStreak} vitórias seguidas`,
        body:
          `A sequência invicta do ${clubName} chega a ${winStreak} jogos com vitória. ` +
          `Torcida em festa, pressão por mais.`,
        type: 'conquista',
        createdAt: Date.now(),
        source: 'auto',
      });
      markEventHandled(seasonId, key);
    }
  }
}

export async function emitPromotionNews(
  seasonId: string,
  careerId: string,
  player: { firstName: string; lastName: string; age: number; overall: number; potentialMax: number; nationality: string; position: 'GOL' | 'DEF' | 'MID' | 'ATA' },
  clubName: string,
): Promise<void> {
  const fullName = `${player.firstName} ${player.lastName}`.trim();
  const tier = player.potentialMax >= 88 ? 'elite' : player.potentialMax >= 75 ? 'promissor' : 'modesto';
  const posPt: Record<string, string> = { GOL: 'goleiro', DEF: 'zagueiro', MID: 'meio-campista', ATA: 'atacante' };

  const headline = tier === 'elite'
    ? `Joia da base ${fullName} promovida ao profissional do ${clubName}`
    : tier === 'promissor'
      ? `Promessa da base ${fullName} é promovida ao ${clubName}`
      : `${fullName} é promovido das categorias de base do ${clubName}`;

  const body =
    `🌱 PROMOÇÃO DA BASE\n\n` +
    `O ${clubName} promoveu ${fullName} (${player.age} anos, ${posPt[player.position] ?? 'jogador'}, ${player.nationality}) ` +
    `das categorias de base com OVR ${player.overall} e potencial máximo ${player.potentialMax}.`;

  const key = `promo_${careerId}_${fullName}_${player.age}`;
  if (wasEventHandled(seasonId, key)) return;

  await appendNews(seasonId, {
    id: genId(),
    headline,
    body,
    type: 'base_promotion',
    createdAt: Date.now(),
    source: 'auto',
  });
  markEventHandled(seasonId, key);
}
