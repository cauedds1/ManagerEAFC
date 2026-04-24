import type { NewsPost, NewsComment } from "@/types/noticias";
import type { Career } from "@/types/career";
import type { Lang } from "@/lib/i18n";
import { generatePostId, generateCommentId } from "@/lib/noticiaStorage";

const MAJOR_LEAGUE_KEYWORDS = [
  "premier league", "la liga", "serie a", "bundesliga", "ligue 1",
  "série a", "brasileirao", "brasileirão", "campeonato brasileiro",
  "eredivisie", "primeira liga", "liga profesional", "primera division",
  "champions league", "europa league",
];

export function isMediumOrLargeClub(career: Career): boolean {
  const league = (career.clubLeague ?? "").toLowerCase();
  return MAJOR_LEAGUE_KEYWORDS.some((kw) => league.includes(kw));
}

const now = Date.now();
const H = 3600_000;

function cmt(
  username: string,
  displayName: string,
  content: string,
  likes: number,
  personality?: NewsComment["personality"],
  replies?: NewsComment[],
): NewsComment {
  return {
    id: generateCommentId(),
    username,
    displayName,
    content,
    likes,
    personality,
    replies,
    createdAt: now - Math.floor(Math.random() * 12 * H),
  };
}

function buildEnPosts(career: Career): NewsPost[] {
  const club = career.clubName;
  const shortClub = club.split(" ").slice(0, 2).join(" ");
  const slug = club.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const fanHandle = `@${slug}official`;
  const fanName = `${shortClub} Official`;

  return [
    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "treino",
      content:
        `🟢 TRAINING WEEK!\n\n` +
        `${club} have stepped up their preparations this week with two sessions a day. ` +
        `The manager focused on physical conditioning and tactics, with the next match firmly in mind.\n\n` +
        `United and focused! 💪⚽\n\n` +
        `#${shortClub.replace(/\s/g, "")} #Training #Preparation`,
      likes: 4_812,
      commentsCount: 187,
      sharesCount: 312,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "That's it! A focused squad is half the battle 🔥🔥",
          342,
          "otimista",
          [
            cmt("@rafael.nunes_7", "Rafael Nunes", "Focused on nothing mate, did you see the last session? A complete mess", 89, "corneteiro"),
            cmt("@vitor.mendes10", "Vitor Mendes", "Relax lol there's always someone to kill the vibe 😂", 56, "zoeiro"),
          ],
        ),
        cmt(
          "@alexandre.costa8",
          "Alexandre Costa",
          "TODAY WE TRAIN, TOMORROW WE PLAY, THEN WE WIN THE TITLE 🏆🏆🏆",
          218,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Training, training, training… and the results? Zero. Fed up with this squad going nowhere",
          134,
          "chato",
          [
            cmt("@murilo.figueira_", "Murilo Figueira", "Stop complaining mate, the team is improving 🙏", 78, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "Improving where? You're watching a different game to me", 45, "chato"),
            cmt("@caio.drummond_", "Caio Drummond", "This guy complains even when they win hahahaha permanent moan 😂", 201, "zoeiro"),
          ],
        ),
        cmt(
          "@felipe.augusto99",
          "Felipe Augusto",
          `Hey everyone! Does anyone know the kick-off time for ${shortClub}'s next game?`,
          12,
          "neutro",
          [
            cmt("@analuiza.ribeiro_", "Ana Luíza Ribeiro", "Check the official site, all the info's there 😊", 34, "neutro"),
          ],
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          `Today's session is good but it'll never compare to ${shortClub} in 2008… that generation was something else`,
          167,
          "saudosista",
          [
            cmt("@lucas.vinicius_", "Lucas Vinicius", "Stopped reading at 2008 lol let it go mate", 234, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 5 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "lesao",
      content:
        `INJURED 🚑\n\n` +
        `${club} have released the squad's injury update.\n\n` +
        `One of the first-teamers felt discomfort in their right thigh during the last training session and is a doubt for the next match. ` +
        `The medical department is monitoring daily and further details will be released in the coming hours.\n\n` +
        `Keep an eye on our channels for updates! 🏥`,
      likes: 7_234,
      commentsCount: 413,
      sharesCount: 891,
      comments: [
        cmt(
          "@bruno.gomes17",
          "Bruno Gomes",
          "Can't believe it… always when we need them most 😭😭",
          567,
          "chato",
          [
            cmt("@rodrigo.alves13", "Rodrigo Alves", "Stay calm everyone, we have a strong squad! Next man up! 💪", 234, "otimista"),
            cmt("@bruno.gomes17", "Bruno Gomes", "Easy to say… always the same injury issues at this club", 89, "chato"),
          ],
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "This is the result of poor fitness work. The conditioning staff need to rethink their methods urgently",
          445,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "You're an expert in sports science, are you? Easy to talk from the outside", 123, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "You don't need to be a professional to see something's wrong, look at the injury record", 89, "corneteiro"),
          ],
        ),
        cmt(
          "@caio.drummond_",
          "Caio Drummond",
          "The club's medical department works so well the players prefer to get injured 😂",
          1_102,
          "zoeiro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "In my day players were tougher, the ones today are made of glass",
          234,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "Times were different — sports medicine has improved so more injuries get detected now. No drama", 345, "neutro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "Such sad news 😢 Get well soon, warrior! The fans are with you!",
          678,
          "otimista",
        ),
      ],
      createdAt: now - 22 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `📣 SQUAD ANNOUNCED!\n\n` +
        `${club} have just released the list of players called up for the next match. ` +
        `The manager has named 23 players, keeping the first-team core and ` +
        `including two players from the academy.\n\n` +
        `Good luck to all! Together! 🏟️⚽\n\n` +
        `#Squad #${shortClub.replace(/\s/g, "")}`,
      likes: 6_789,
      commentsCount: 412,
      sharesCount: 876,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "Good call-up! Happy with the manager's choices 👏👏",
          678,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Dreadful squad selection. Left out the players who've been performing best",
          345,
          "chato",
          [
            cmt("@caio.drummond_", "Caio Drummond", "My friend you complain when they're called up and complain when they're not 😂 give it a rest", 1_234, "zoeiro"),
          ],
        ),
        cmt(
          "@lucas.vinicius_",
          "Lucas Vinicius",
          "The academy lads getting a call-up is exactly what I wanted to see!! Bright future 🌟",
          567,
          "otimista",
          [
            cmt("@edmundo.carvalho", "Edmundo Carvalho", "In my day the academy already had better players… nowadays…", 89, "saudosista"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "Balanced squad. The manager knows what he's doing 🎯",
          456,
          "neutro",
        ),
      ],
      createdAt: now - 30 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `📊 SEASON NUMBERS\n\n` +
        `${club} have been putting together impressive statistics this season. ` +
        `Here are the highlights:\n\n` +
        `⚽ Goals scored: Growing with every matchday\n` +
        `🧱 Defensive record: Solid and organised backline\n` +
        `🏃 Average distance covered: High intensity every game\n\n` +
        `The manager's influence is leaving its mark on this squad. ` +
        `So proud of our team! 💪🏆`,
      likes: 8_234,
      commentsCount: 296,
      sharesCount: 1_456,
      comments: [
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "The numbers are good but we still need to improve at defending set pieces",
          234,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "There's always one to find fault even with positive numbers lol", 456, "zoeiro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "WHAT A TEAM 💪❤️ these numbers show how far we've come!",
          1_234,
          "otimista",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Good to see these numbers but the 2012 side had even better stats…",
          123,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "Uncle we're in 2025 not 2012 😂 enjoy the present", 789, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 110 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "tnt",
      sourceHandle: "@tntsports",
      sourceName: "TNT Sports",
      category: "geral",
      content:
        `📊 ANALYSIS | ${club.toUpperCase()}\n\n` +
        `${club} have been showing some interesting tactical evolution over the last few rounds. ` +
        `The side displayed greater defensive consistency and attacking creativity, ` +
        `averaging over 2 goals per game across the last 5 matches.\n\n` +
        `The manager has been getting the best out of the squad and supporters are starting to believe ` +
        `in this team's potential this season. Will they hold up under pressure when it matters most? 🤔`,
      likes: 15_890,
      commentsCount: 1_203,
      sharesCount: 4_512,
      comments: [
        cmt(
          "@martin.erikson9",
          "Martin Erikson",
          `${club} looking really solid this season. Impressive tactical work`,
          456,
          "internacional",
          [
            cmt("@marc.soler21", "Marc Soler", "Lol who even cares about this club 😂", 123, "internacional"),
            cmt("@martin.erikson9", "Martin Erikson", "Every club matters, bro. Respect the game", 567, "internacional"),
            cmt("@tom.whitfield99", "Tom Whitfield", "People who gatekeep football need to touch grass honestly", 789, "internacional"),
          ],
        ),
        cmt(
          "@oliver.james_fc",
          "Oliver James",
          `Interesting to see ${shortClub} develop this way. Their pressing stats are actually decent`,
          234,
          "internacional",
        ),
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "Even TNT are watching us! We're a big club now 🔥🔥🔥",
          892,
          "otimista",
          [
            cmt("@marco.antonio.fc", "Marco Antônio", "TNT covers every club when they need to fill airtime lol calm down", 345, "zoeiro"),
            cmt("@helio.campos_", "Hélio Campos", "Let us dream mate 😂😂", 567, "zoeiro"),
          ],
        ),
        cmt(
          "@alex.harris_7",
          "Alex Harris",
          "Never heard of them tbh but the stats look promising",
          167,
          "internacional",
        ),
        cmt(
          "@james.walker_fc",
          "James Walker",
          "Every underdog story in football is worth following 🙌",
          2_341,
          "internacional",
        ),
      ],
      createdAt: now - 36 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `🎥 BEHIND THE SCENES\n\n` +
        `A different week at the training ground! The squad took advantage of a break in the schedule for a ` +
        `team-bonding session. Check out this week's behind the scenes.\n\n` +
        `A united squad is a strong squad! 💪❤️\n\n` +
        `#BehindTheScenes #${shortClub.replace(/\s/g, "")} #TrainingGround`,
      likes: 9_341,
      commentsCount: 329,
      sharesCount: 1_120,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "Such a beautiful sight!! Love seeing the group like this 🥹🥹",
          892,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Bonding sessions yes, but what about the results on the pitch? Messing around at the training ground while the league slips away",
          234,
          "chato",
          [
            cmt("@junior.bezerra_j", "Junior Bezerra", "Mate, players are human too. They need rest and team bonding to perform better 😅", 456, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "Their job is to win games, not make behind-the-scenes videos", 78, "chato"),
            cmt("@caio.drummond_", "Caio Drummond", "This guy would moan if the team won the Champions League kkkkk relax 😂", 1_203, "zoeiro"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "Clubs that look after squad wellbeing are more successful. The data backs it up! 📊",
          345,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Team bonding these days looks like this… In my day it was hard tackling in training then a beer after 😄",
          1_567,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "That's exactly why there were more injuries back then lol 'in my day'", 678, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 48 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "espn",
      sourceHandle: "@espn",
      sourceName: "ESPN",
      category: "transferencia",
      content:
        `💰 TRANSFER MARKET\n\n` +
        `Sources close to ${club} indicate the club are monitoring at least two targets ahead of ` +
        `the next transfer window. The board is looking for reinforcements in midfield.\n\n` +
        `The club's financial situation allows for targeted moves, according to ESPN's report. ` +
        `More details should emerge in the coming weeks. 🔴`,
      likes: 23_456,
      commentsCount: 2_891,
      sharesCount: 8_123,
      comments: [
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "JUST SIGN THEM PLEASE 🙏🙏🙏🙏",
          3_456,
          "otimista",
          [
            cmt("@marco.antonio.fc", "Marco Antônio", "Wait for the window to open before celebrating lol", 234, "neutro"),
          ],
        ),
        cmt(
          "@oliver.james_fc",
          "Oliver James",
          `Midfield reinforcement is the right move for ${shortClub}. Their pressing game needs more depth`,
          567,
          "internacional",
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Monitoring for 3 transfer windows in a row. This club only 'monitors', never actually signs anyone of quality",
          2_123,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "They did sign someone last window, you just don't follow closely enough", 456, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "Who? Name me one signing who actually made a difference", 345, "corneteiro"),
            cmt("@caio.drummond_", "Caio Drummond", "This has turned into a comments section debate 😂 getting worse", 789, "zoeiro"),
          ],
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Midfield… our best midfield signing was 10 years ago. Nothing but decline since then",
          890,
          "saudosista",
        ),
        cmt(
          "@marc.soler21",
          "Marc Soler",
          "and who cares about this team? focus on what matters ESPN",
          445,
          "internacional",
          [
            cmt("@helio.campos_", "Hélio Campos", "Don't follow us then 👋", 2_341, "otimista"),
            cmt("@martin.erikson9", "Martin Erikson", "Football isn't just about the top 6 clubs, my friend", 1_234, "internacional"),
          ],
        ),
      ],
      createdAt: now - 60 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "renovacao",
      content:
        `📋 RENEWAL!\n\n` +
        `${club} are in advanced talks to renew the contract of one of the squad's key pillars. ` +
        `Negotiations are at a final stage and the announcement could come within days.\n\n` +
        `Stay, warrior! 🙏❤️\n\n` +
        `#Renewal #${shortClub.replace(/\s/g, "")} #Stay`,
      likes: 18_923,
      commentsCount: 934,
      sharesCount: 3_445,
      comments: [
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "STAY STAY STAY STAY STAY ❤️❤️❤️❤️",
          4_512,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Renew for what? To carry on the same? We need new faces, not more of the same",
          567,
          "chato",
          [
            cmt("@vitor.mendes10", "Vitor Mendes", "You're unbearable mate lol the guy is good and you want him gone?", 1_234, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "Good at what exactly? Show me one good performance in the last 6 months", 234, "chato"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "Important to keep the spine of the team. Continuity is fundamental in modern football",
          789,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Good to see someone who still wants to stay. Before, players had love for the shirt — today it's all about money",
          1_123,
          "saudosista",
          [
            cmt("@caio.drummond_", "Caio Drummond", "Do you renew your contract because you love the company or because they pay well? lol 😂", 2_890, "zoeiro"),
            cmt("@edmundo.carvalho", "Edmundo Carvalho", "That's different mate…", 123, "saudosista"),
          ],
        ),
      ],
      createdAt: now - 72 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "treino",
      content:
        `📸 FRIDAY TRAINING!\n\n` +
        `Matchday eve at ${club}'s training ground! The manager took charge of the final session before tomorrow's match. ` +
        `The squad is in good physical shape and morale is high.\n\n` +
        `Who do you put in tomorrow's team? Comment below! 👇⚽`,
      likes: 12_445,
      commentsCount: 1_678,
      sharesCount: 2_340,
      comments: [
        cmt(
          "@felipe.augusto99",
          "Felipe Augusto",
          "Play the usual first eleven, no surprises! 🔥",
          567,
          "otimista",
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Need to change the right back, looked weak this week in training. Everyone saw it",
          345,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "Where's the proof they looked weak? Did you watch the sessions?", 123, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "I watched the highlights yeah, was pretty clear", 89, "corneteiro"),
            cmt("@caio.drummond_", "Caio Drummond", "Training highlights lol this guy is a legend 😂", 1_456, "zoeiro"),
          ],
        ),
        cmt(
          "@bruno.gomes17",
          "Bruno Gomes",
          "Everyone's too anxious. Let the manager do his job in peace",
          678,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "In my day the eve of a match was total silence and focus. Nowadays it's a party and selfies for social media",
          890,
          "saudosista",
          [
            cmt("@lucas.vinicius_", "Lucas Vinicius", "Uncle, fan engagement is part of modern football. Stop complaining about everything 😂", 1_234, "zoeiro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "Tomorrow is the day!! Let's go all out!! 🏆🏆",
          3_456,
          "otimista",
        ),
      ],
      createdAt: now - 84 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "tnt",
      sourceHandle: "@tntsports",
      sourceName: "TNT Sports",
      category: "geral",
      content:
        `🧠 TACTICAL MASTERCLASS\n\n` +
        `How is ${club} building their football? Our tactical analysis shows that ` +
        `the side works the ball well down the right flank and exploits space in behind the opposition line effectively.\n\n` +
        `With over 300 pressing actions in the last 5 games, the squad shows that the ` +
        `defensive system is becoming more and more organised. A genuine advantage or just a good run of form? 👀`,
      likes: 31_234,
      commentsCount: 4_123,
      sharesCount: 12_456,
      comments: [
        cmt(
          "@noah.robertson92",
          "Noah Robertson",
          `${shortClub}'s high press is genuinely impressive for a team of this size. Kompany vibes 🧠`,
          2_345,
          "internacional",
          [
            cmt("@liam.davidson_fc", "Liam Davidson", "300 pressing actions in 5 games is elite territory actually", 567, "internacional"),
            cmt("@carlos.ruiz_es", "Carlos Ruíz", "Mucho hype… esperemos a ver cuando jueguen contra los grandes", 234, "internacional"),
          ],
        ),
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "THE BIGGEST REVELATION IN WORLD FOOTBALL 🔥🔥🔥 SO PROUD",
          5_678,
          "otimista",
        ),
        cmt(
          "@marco.antonio.fc",
          "Marco Antônio",
          "Good analysis. But this is form — let's see when the big games come",
          1_234,
          "neutro",
          [
            cmt("@vitor.mendes10", "Vitor Mendes", "Negativity lol at least let us enjoy the moment", 678, "otimista"),
          ],
        ),
        cmt(
          "@finn.wagner_9",
          "Finn Wagner",
          "team of the season for me so far, love watching them play",
          1_890,
          "internacional",
        ),
        cmt(
          "@marc.soler21",
          "Marc Soler",
          "300 pressing actions but how many actual trophies? lol",
          345,
          "internacional",
          [
            cmt("@martin.erikson9", "Martin Erikson", "Not every club starts with trophies, some have to build first 🤷‍♂️", 2_123, "internacional"),
            cmt("@helio.campos_", "Hélio Campos", "You'll be eating your words when we win everything 😤", 3_456, "otimista"),
          ],
        ),
      ],
      createdAt: now - 96 * H,
    },
  ];
}

function buildPtPosts(career: Career): NewsPost[] {
  const club = career.clubName;
  const shortClub = club.split(" ").slice(0, 2).join(" ");
  const slug = club.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const fanHandle = `@${slug}oficial`;
  const fanName = `${shortClub} Oficial`;

  return [
    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "treino",
      content:
        `🟢 SEMANA DE TREINOS!\n\n` +
        `O ${club} intensificou a preparação nesta semana com dois períodos de trabalho por dia. ` +
        `O técnico focou na parte física e tática, com foco no próximo confronto.\n\n` +
        `Grupo unido e focado! 💪⚽\n\n` +
        `#${shortClub.replace(/\s/g, "")} #Treino #Preparação`,
      likes: 4_812,
      commentsCount: 187,
      sharesCount: 312,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "Isso aí! Grupo focado é metade da batalha 🔥🔥",
          342,
          "otimista",
          [
            cmt("@rafael.nunes_7", "Rafael Nunes", "Focado em nada hein, vcs já viram o último treino? Uma bagunça só", 89, "corneteiro"),
            cmt("@vitor.mendes10", "Vitor Mendes", "Cara, calma kkk sempre tem alguém pra estragar o clima 😂", 56, "zoeiro"),
          ],
        ),
        cmt(
          "@alexandre.costa8",
          "Alexandre Costa",
          "HOJE TEM TREINO, AMANHÃ TEM JOGO, DEPOIS TEM TÍTULO 🏆🏆🏆",
          218,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Treino, treino, treino... e o resultado? Zero. Já não aguento mais esse grupo sem evolução",
          134,
          "chato",
          [
            cmt("@murilo.figueira_", "Murilo Figueira", "Para de reclamar rapaz, o time tá evoluindo sim 🙏", 78, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "Evoluindo onde? Vc tá vendo jogo diferente do meu", 45, "chato"),
            cmt("@caio.drummond_", "Caio Drummond", "Esse cara reclama até quando ganha hahahaha eterno insatisfeito 😂", 201, "zoeiro"),
          ],
        ),
        cmt(
          "@felipe.augusto99",
          "Felipe Augusto",
          `Boa tarde gente! Alguém sabe o horário do próximo jogo do ${shortClub}?`,
          12,
          "neutro",
          [
            cmt("@analuiza.ribeiro_", "Ana Luíza Ribeiro", "Verifica no site oficial, lá tem tudo certinho 😊", 34, "neutro"),
          ],
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          `Treino de hoje tá bom mas nunca vai ser como o do ${shortClub} de 2008... aquela geração era outra coisa`,
          167,
          "saudosista",
          [
            cmt("@lucas.vinicius_", "Lucas Vinicius", "Parei de ler em 2008 kkkkk deixa o passado pra trás tio", 234, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 5 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "lesao",
      content:
        `LESIONADO 🚑\n\n` +
        `O ${club} divulga o boletim médico do elenco.\n\n` +
        `Um dos titulares apresentou desconforto muscular na coxa direita durante o último treino e é dúvida para o próximo jogo. ` +
        `O departamento médico faz acompanhamento diário e mais detalhes serão divulgados nas próximas horas.\n\n` +
        `Fique de olho nas nossas redes para atualizações! 🏥`,
      likes: 7_234,
      commentsCount: 413,
      sharesCount: 891,
      comments: [
        cmt(
          "@bruno.gomes17",
          "Bruno Gomes",
          "Não acredito... sempre que a gente mais precisa 😭😭",
          567,
          "chato",
          [
            cmt("@rodrigo.alves13", "Rodrigo Alves", "Calma gente, temos um elenco forte! Vem o próximo! 💪", 234, "otimista"),
            cmt("@bruno.gomes17", "Bruno Gomes", "Fala fácil né... sempre o mesmo problema de lesão nesse clube", 89, "chato"),
          ],
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Isso é resultado de um trabalho físico mal feito. Preparador físico precisa rever os métodos urgente",
          445,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "Você entende muito de preparação física é? Fácil falar de fora", 123, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "Não precisa ser profissional pra ver que algo tá errado, olha o histórico de lesões", 89, "corneteiro"),
          ],
        ),
        cmt(
          "@caio.drummond_",
          "Caio Drummond",
          "Departamento médico do clube funciona tão bem que os jogadores preferem se lesionar 😂",
          1_102,
          "zoeiro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "No meu tempo os jogadores eram mais resistentes, esses de hoje são feitos de vidro",
          234,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "Seu tempo era diferente, medicina do esporte melhorou e aí detectam mais lesões que antes. Sem drama", 345, "neutro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "Que notícia triste 😢 Fica bem, guerreiro! A torcida tá do lado!",
          678,
          "otimista",
        ),
      ],
      createdAt: now - 22 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `📣 CONVOCAÇÃO!\n\n` +
        `O ${club} acaba de divulgar a lista de relacionados para o próximo compromisso. ` +
        `O técnico optou por convocar 23 jogadores, mantendo a base do time titular e ` +
        `incluindo dois nomes das categorias de base.\n\n` +
        `Boa sorte a todos! Vamos juntos! 🏟️⚽\n\n` +
        `#Convocação #${shortClub.replace(/\s/g, "")}`,
      likes: 6_789,
      commentsCount: 412,
      sharesCount: 876,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "Convocou bem! Gostei das escolhas do técnico 👏👏",
          678,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Convocação fraquíssima. Deixou de fora justamente quem mais tem jogado bem",
          345,
          "chato",
          [
            cmt("@caio.drummond_", "Caio Drummond", "Meu amigo você reclama se convoca e reclama se não convoca 😂 dá um descanso", 1_234, "zoeiro"),
          ],
        ),
        cmt(
          "@lucas.vinicius_",
          "Lucas Vinicius",
          "Os guris da base sendo chamados é o que eu queria ver!! Futuro promissor 🌟",
          567,
          "otimista",
          [
            cmt("@edmundo.carvalho", "Edmundo Carvalho", "No meu tempo a base já tinha jogadores melhores... hoje em dia...", 89, "saudosista"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "Formação equilibrada. O técnico sabe o que está fazendo 🎯",
          456,
          "neutro",
        ),
      ],
      createdAt: now - 30 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `📊 NÚMEROS DA TEMPORADA\n\n` +
        `O ${club} tem acumulado estatísticas impressionantes nesta temporada. ` +
        `Veja os destaques:\n\n` +
        `⚽ Gols marcados: Aumentando a cada rodada\n` +
        `🧱 Defesas: Linha sólida e organizada\n` +
        `🏃 Quilometragem média: Alta intensidade em campo\n\n` +
        `O trabalho do técnico está deixando cada vez mais sua marca nesse elenco. ` +
        `Muito orgulho da nossa equipe! 💪🏆`,
      likes: 8_234,
      commentsCount: 296,
      sharesCount: 1_456,
      comments: [
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Os números são bons mas ainda precisamos melhorar nas bolas aéreas defensivas",
          234,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "Sempre tem um pra achar defeito mesmo em números positivos kkk", 456, "zoeiro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "QUE TIME LINDO 💪❤️ esses números mostram o quanto evoluímos!",
          1_234,
          "otimista",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Bonito ver esses números mas o time de 2012 tinha estatísticas ainda melhores...",
          123,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "Tio a gente tá em 2025 não em 2012 😂 curte o presente", 789, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 110 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "tnt",
      sourceHandle: "@tntsports",
      sourceName: "TNT Sports",
      category: "geral",
      content:
        `📊 ANÁLISE | ${club.toUpperCase()}\n\n` +
        `O ${club} vem apresentando uma evolução tática interessante nas últimas rodadas. ` +
        `O time mostrou mais consistência defensiva e criatividade no ataque, ` +
        `com uma média de mais de 2 gols por jogo nas últimas 5 partidas.\n\n` +
        `O técnico tem conseguido encaixar bem o elenco e a torcida começa a acreditar no potencial ` +
        `dessa equipe na temporada. Será que vai aguentar a pressão nos momentos decisivos? 🤔`,
      likes: 15_890,
      commentsCount: 1_203,
      sharesCount: 4_512,
      comments: [
        cmt(
          "@martin.erikson9",
          "Martin Erikson",
          `${club} looking really solid this season. Impressive tactical work`,
          456,
          "internacional",
          [
            cmt("@marc.soler21", "Marc Soler", "Lol who even cares about this club 😂", 123, "internacional"),
            cmt("@martin.erikson9", "Martin Erikson", "Every club matters, bro. Respect the game", 567, "internacional"),
            cmt("@tom.whitfield99", "Tom Whitfield", "People who gatekeep football need to touch grass honestly", 789, "internacional"),
          ],
        ),
        cmt(
          "@oliver.james_fc",
          "Oliver James",
          `Interesting to see ${shortClub} develop this way. Their pressing stats are actually decent`,
          234,
          "internacional",
        ),
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "Até a TNT tá de olho! Somos grandes 🔥🔥🔥",
          892,
          "otimista",
          [
            cmt("@marco.antonio.fc", "Marco Antônio", "TNT fala de todo time quando precisa preencher grade kkkkk calma", 345, "zoeiro"),
            cmt("@helio.campos_", "Hélio Campos", "Deixa a gente sonhar homem 😂😂", 567, "zoeiro"),
          ],
        ),
        cmt(
          "@alex.harris_7",
          "Alex Harris",
          "Never heard of them tbh but the stats look promising",
          167,
          "internacional",
        ),
        cmt(
          "@james.walker_fc",
          "James Walker",
          "Every underdog story in football is worth following 🙌",
          2_341,
          "internacional",
        ),
      ],
      createdAt: now - 36 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "geral",
      content:
        `🎥 BASTIDORES\n\n` +
        `Uma semana diferente no CT! O grupo aproveitou uma folga no calendário para fazer um ` +
        `trabalho de integração. Confira os bastidores da semana.\n\n` +
        `Elenco unido é elenco forte! 💪❤️\n\n` +
        `#Bastidores #${shortClub.replace(/\s/g, "")} #CT`,
      likes: 9_341,
      commentsCount: 329,
      sharesCount: 1_120,
      comments: [
        cmt(
          "@vitor.mendes10",
          "Vitor Mendes",
          "Que cena bonita demais!! Adorei ver o grupo assim 🥹🥹",
          892,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Integração sim, mas e os resultados em campo? Brincadeira no CT enquanto o campeonato vai embora",
          234,
          "chato",
          [
            cmt("@junior.bezerra_j", "Junior Bezerra", "Cara, jogador também é humano. Precisa de descanso e integração pra render mais 😅", 456, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "E a obrigação deles é ganhar jogo, não fazer vídeo de bastidores", 78, "chato"),
            cmt("@caio.drummond_", "Caio Drummond", "Esse cara ia reclamar se o time ganhasse a Champions também kkkkk relaxa 😂", 1_203, "zoeiro"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "O clube que cuida do bem estar do elenco tem mais sucesso. Dados comprovam isso! 📊",
          345,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Integração hoje em dia é isso... Na minha época era pancada no treino e cerveja depois 😄",
          1_567,
          "saudosista",
          [
            cmt("@caio_ferreira22", "Caio Ferreira", "Isso que fazia os jogadores se lesionarem mais kkk 'na minha época'", 678, "zoeiro"),
          ],
        ),
      ],
      createdAt: now - 48 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "espn",
      sourceHandle: "@espnbrasil",
      sourceName: "ESPN Brasil",
      category: "transferencia",
      content:
        `💰 MERCADO DA BOLA\n\n` +
        `Fontes próximas ao ${club} indicam que o clube está monitorando pelo menos dois nomes para ` +
        `o próximo janela de transferências. A diretoria busca reforços para o setor de meio-campo.\n\n` +
        `A situação financeira do clube permite movimentos pontuais, segundo apuração da ESPN. ` +
        `Mais detalhes devem surgir nas próximas semanas. 🔴`,
      likes: 23_456,
      commentsCount: 2_891,
      sharesCount: 8_123,
      comments: [
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "CONTRATA LOGO POR FAVOR 🙏🙏🙏🙏",
          3_456,
          "otimista",
          [
            cmt("@marco.antonio.fc", "Marco Antônio", "Espera a janela abrir antes de comemorar kkk", 234, "neutro"),
          ],
        ),
        cmt(
          "@oliver.james_fc",
          "Oliver James",
          `Midfield reinforcement is the right move for ${shortClub}. Their pressing game needs more depth`,
          567,
          "internacional",
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Monitorando há 3 mercados seguidos. Esse clube só 'monitora', nunca contrata ninguém de qualidade",
          2_123,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "Contratou sim na última janela, você que não acompanha direito", 456, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "Contratou quem? Me fala o nome de um reforço que realmente fez diferença", 345, "corneteiro"),
            cmt("@caio.drummond_", "Caio Drummond", "Isso virou debate de comentários de Instagram agora 😂 cada um pior", 789, "zoeiro"),
          ],
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Meio campo... nossa melhor contratação de meio campo foi há 10 anos. Desde então só decadência",
          890,
          "saudosista",
        ),
        cmt(
          "@marc.soler21",
          "Marc Soler",
          "ta e quem liga pra esse time? foca no que importa ESPN",
          445,
          "internacional",
          [
            cmt("@helio.campos_", "Hélio Campos", "Liga não entao 👋", 2_341, "otimista"),
            cmt("@martin.erikson9", "Martin Erikson", "Football isn't just about the top 6 clubs, my friend", 1_234, "internacional"),
          ],
        ),
      ],
      createdAt: now - 60 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "renovacao",
      content:
        `📋 RENOVAÇÃO!\n\n` +
        `O ${club} está em negociações avançadas para renovar o contrato de um dos pilares do elenco. ` +
        `As conversas estão em fase final e o anúncio pode vir nos próximos dias.\n\n` +
        `Fica, guerreiro! 🙏❤️\n\n` +
        `#Renovação #${shortClub.replace(/\s/g, "")} #Fica`,
      likes: 18_923,
      commentsCount: 934,
      sharesCount: 3_445,
      comments: [
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "FICA FICA FICA FICA FICA ❤️❤️❤️❤️",
          4_512,
          "otimista",
        ),
        cmt(
          "@josivaldo.peixoto_",
          "Josivaldo Peixoto",
          "Renovar pra quê? Pra continuar igual? Precisamos de novidades, não de mais do mesmo",
          567,
          "chato",
          [
            cmt("@vitor.mendes10", "Vitor Mendes", "Você é insuportável cara kkkk o cara é bom e você quer mandar embora?", 1_234, "otimista"),
            cmt("@josivaldo.peixoto_", "Josivaldo Peixoto", "Bom pra quê? Me mostra um jogo bom que ele fez nos últimos 6 meses", 234, "chato"),
          ],
        ),
        cmt(
          "@guilherme.ramos3",
          "Guilherme Ramos",
          "Importante manter a espinha dorsal do time. Continuidade é fundamental no futebol moderno",
          789,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "Bom ver que ainda tem gente que quer ficar. Antes os jogadores tinham amor à camisa, hoje só pensam em dinheiro",
          1_123,
          "saudosista",
          [
            cmt("@caio.drummond_", "Caio Drummond", "E você não renova o contrato com o trabalho pq ama a empresa ou pq paga bem? kkk 😂", 2_890, "zoeiro"),
            cmt("@edmundo.carvalho", "Edmundo Carvalho", "Isso é diferente rapaz...", 123, "saudosista"),
          ],
        ),
      ],
      createdAt: now - 72 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "fanpage",
      sourceHandle: fanHandle,
      sourceName: fanName,
      category: "treino",
      content:
        `📸 SEXTA DE TREINO!\n\n` +
        `Véspera de jogo no CT do ${club}! O técnico comandou o último treino antes do confronto ` +
        `de amanhã. O grupo está bem fisicamente e com moral elevado.\n\n` +
        `Quem você coloca no time de amanhã? Comenta aqui! 👇⚽`,
      likes: 12_445,
      commentsCount: 1_678,
      sharesCount: 2_340,
      comments: [
        cmt(
          "@felipe.augusto99",
          "Felipe Augusto",
          "Coloca o time titular de sempre, sem mistério! 🔥",
          567,
          "otimista",
        ),
        cmt(
          "@deivid.moraes_",
          "Deivid Moraes",
          "Precisa mudar a lateral, tá fraca demais essa semana nos treinos. Todo mundo viu",
          345,
          "corneteiro",
          [
            cmt("@thiago_lima9", "Thiago Lima", "Cadê a prova que tá fraca? Você assistiu os treinos?", 123, "neutro"),
            cmt("@deivid.moraes_", "Deivid Moraes", "Assisti os highlights sim, deu pra ver", 89, "corneteiro"),
            cmt("@caio.drummond_", "Caio Drummond", "Highlights de treino kkkkk esse cara é lenda 😂", 1_456, "zoeiro"),
          ],
        ),
        cmt(
          "@bruno.gomes17",
          "Bruno Gomes",
          "Galera ansiosa demais. Deixa o técnico trabalhar em paz",
          678,
          "neutro",
        ),
        cmt(
          "@edmundo.carvalho",
          "Edmundo Carvalho",
          "No meu tempo véspera de jogo era silêncio total, concentração. Hoje vira festa e foto pra rede social",
          890,
          "saudosista",
          [
            cmt("@lucas.vinicius_", "Lucas Vinicius", "Tio, interação com a torcida faz parte do futebol moderno. Para de reclamar de tudo 😂", 1_234, "zoeiro"),
          ],
        ),
        cmt(
          "@analuiza.ribeiro_",
          "Ana Luíza Ribeiro",
          "Amanhã é dia!! Vamos com tudo!! 🏆🏆",
          3_456,
          "otimista",
        ),
      ],
      createdAt: now - 84 * H,
    },

    {
      id: generatePostId(),
      careerId: career.id,
      source: "tnt",
      sourceHandle: "@tntsports",
      sourceName: "TNT Sports",
      category: "geral",
      content:
        `🧠 MASTERCLASS TÁTICA\n\n` +
        `Como o ${club} vem construindo seu futebol? A nossa análise tática mostra que ` +
        `o time trabalha bem a saída de bola pelo corredor direito e explora bem os espaços ` +
        `nas costas da linha adversária.\n\n` +
        `Com mais de 300 ações de pressão nos últimos 5 jogos, o elenco mostra que o sistema ` +
        `defensivo está cada vez mais organizado. Diferencial ou apenas fase boa? 👀`,
      likes: 31_234,
      commentsCount: 4_123,
      sharesCount: 12_456,
      comments: [
        cmt(
          "@noah.robertson92",
          "Noah Robertson",
          `${shortClub}'s high press is genuinely impressive for a team of this size. Kompany vibes 🧠`,
          2_345,
          "internacional",
          [
            cmt("@liam.davidson_fc", "Liam Davidson", "300 pressing actions in 5 games is elite territory actually", 567, "internacional"),
            cmt("@carlos.ruiz_es", "Carlos Ruíz", "Mucho hype... esperemos a ver cuando jueguen contra los grandes", 234, "internacional"),
          ],
        ),
        cmt(
          "@helio.campos_",
          "Hélio Campos",
          "A MAIOR REVELAÇÃO DO FUTEBOL MUNDIAL 🔥🔥🔥 ORGULHO DEMAIS",
          5_678,
          "otimista",
        ),
        cmt(
          "@marco.antonio.fc",
          "Marco Antônio",
          "Análise boa. Mas isso é fase, vamos ver nos jogos que importam mesmo",
          1_234,
          "neutro",
          [
            cmt("@vitor.mendes10", "Vitor Mendes", "Negativinho kkk deixa pelo menos curtir o momento", 678, "otimista"),
          ],
        ),
        cmt(
          "@finn.wagner_9",
          "Finn Wagner",
          "team of the season for me so far, love watching them play",
          1_890,
          "internacional",
        ),
        cmt(
          "@marc.soler21",
          "Marc Soler",
          "300 pressing actions but how many actual trophies? lol",
          345,
          "internacional",
          [
            cmt("@martin.erikson9", "Martin Erikson", "Not every club starts with trophies, some have to build first 🤷‍♂️", 2_123, "internacional"),
            cmt("@helio.campos_", "Hélio Campos", "Você vai engolir quando a gente ganhar tudo 😤", 3_456, "otimista"),
          ],
        ),
      ],
      createdAt: now - 96 * H,
    },
  ];
}

export function seedPosts(career: Career, lang: Lang = "pt"): NewsPost[] {
  const posts = lang === "en" ? buildEnPosts(career) : buildPtPosts(career);
  const isLarge = isMediumOrLargeClub(career);
  const filtered = isLarge
    ? posts
    : posts.filter((p) => p.source === "fanpage");
  return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
}
