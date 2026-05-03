/**
 * Base / academy player seed generator. Self-contained (no `baseStorage`
 * dependency on mobile yet — the BasePlayer type is declared inline).
 */

export type BasePosition = 'GOL' | 'DEF' | 'MID' | 'ATA';

export interface BasePlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: BasePosition;
  age: number;
  nationality: string;
  overall: number;
  potentialMin: number;
  potentialMax: number;
  addedAt: number;
}

export function generateBasePlayerId(): string {
  return `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface NamePool { first: string[]; last: string[] }

const NAME_POOLS: Record<string, NamePool> = {
  Brazil: {
    first: ['João', 'Pedro', 'Lucas', 'Matheus', 'Rafael', 'Bruno', 'Vinícius', 'Gabriel', 'Gustavo', 'Felipe', 'Thiago', 'André', 'Caio', 'Diego', 'Yuri', 'Wesley', 'Kauã', 'Davi'],
    last: ['Silva', 'Souza', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Pereira', 'Oliveira', 'Santos', 'Lima', 'Carvalho', 'Nascimento', 'Mendes'],
  },
  Argentina: {
    first: ['Mateo', 'Santiago', 'Lautaro', 'Joaquín', 'Julián', 'Tomás', 'Bautista', 'Franco', 'Nicolás', 'Agustín', 'Facundo'],
    last: ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Álvarez', 'Torres', 'Ruiz'],
  },
  Spain: {
    first: ['Álvaro', 'Pablo', 'Hugo', 'Marcos', 'David', 'Adrián', 'Diego', 'Sergio', 'Iván', 'Marco'],
    last: ['García', 'Martín', 'Hernández', 'Ruiz', 'Jiménez', 'Moreno', 'Gómez', 'Navarro', 'Cortés'],
  },
  Portugal: {
    first: ['João', 'Tomás', 'Gonçalo', 'Rafael', 'Diogo', 'Tiago', 'André', 'Bernardo', 'Miguel'],
    last: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Rodrigues', 'Sousa', 'Carvalho'],
  },
  France: {
    first: ['Lucas', 'Hugo', 'Léo', 'Jules', 'Maël', 'Liam', 'Théo', 'Adam', 'Nathan'],
    last: ['Martin', 'Bernard', 'Dubois', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Fontaine'],
  },
  England: {
    first: ['Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'Tommy', 'Alfie', 'Freddie'],
    last: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Walker', 'Hughes', 'Hall'],
  },
  Italy: {
    first: ['Lorenzo', 'Marco', 'Matteo', 'Alessandro', 'Leonardo', 'Davide', 'Riccardo'],
    last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Conti'],
  },
};

const NATIONALITY_POOL = ['Brazil', 'Brazil', 'Brazil', 'Argentina', 'Spain', 'Portugal', 'France', 'Italy', 'England'];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNamePool(nationality: string): NamePool {
  return NAME_POOLS[nationality] ?? NAME_POOLS.Brazil;
}

const POSITIONS: BasePosition[] = ['GOL', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'ATA', 'ATA'];

export function generateRandomBasePlayer(): BasePlayer {
  const nationality = rand(NATIONALITY_POOL);
  const pool = randomNamePool(nationality);
  const position = rand(POSITIONS);
  const age = randInt(15, 18);

  const roll = Math.random();
  let potentialMin: number;
  let potentialMax: number;
  if (roll < 0.08) {
    potentialMin = randInt(85, 89);
    potentialMax = randInt(90, 99);
  } else if (roll < 0.43) {
    potentialMin = randInt(73, 78);
    potentialMax = randInt(80, 87);
  } else {
    potentialMin = randInt(60, 67);
    potentialMax = randInt(68, 74);
  }

  const ageGrowth = (age - 15) * 4;
  const baseOvr = randInt(45, 55) + ageGrowth + Math.round((potentialMax - 70) * 0.25);
  const overall = Math.max(40, Math.min(potentialMax - 2, baseOvr));

  return {
    id: generateBasePlayerId(),
    firstName: rand(pool.first),
    lastName: rand(pool.last),
    position,
    age,
    nationality,
    overall,
    potentialMin,
    potentialMax,
    addedAt: Date.now(),
  };
}

export function generateInitialBaseSeed(): BasePlayer[] {
  const count = randInt(8, 12);
  return Array.from({ length: count }, () => generateRandomBasePlayer());
}
