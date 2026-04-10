import type { NewsPost, NewsComment } from "@/types/noticias";
import type { Career } from "@/types/career";
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

export function seedPosts(career: Career): NewsPost[] {
  const club = career.clubName;
  const shortClub = club.split(" ").slice(0, 2).join(" ");
  const slug = club.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const fanHandle = `@${slug}oficial`;
  const fanName = `${shortClub} Oficial`;

  const posts: NewsPost[] = [
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

  const isLarge = isMediumOrLargeClub(career);
  const filtered = isLarge
    ? posts
    : posts.filter((p) => p.source === "fanpage");

  return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
}
