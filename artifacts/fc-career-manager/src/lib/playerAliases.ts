// Frontend mirror of artifacts/api-server/src/data/playerAliases.ts.
// Used to make local matching (vendas against the user's squad) recognize
// nicknames the same way the backend /api/players/search does.
//
// Keep in sync with the backend file. When a new alias is added there, add it
// here too. The matching is normalized (accents/punctuation stripped, lowercase),
// so accent variants are not strictly needed in every entry — but matching the
// backend keeps both ends consistent.

export const PLAYER_NAME_ALIASES: string[][] = [
  ["savinho", "savio", "sávio"],
  ["vini jr", "vinicius jr", "vinicius junior", "vini", "vinícius júnior", "vinícius"],
  ["rodrygo", "rodrygo goes", "rodrygo góes"],
  ["neymar", "neymar jr"],
  ["gabigol", "gabriel barbosa"],
  ["hulk", "givanildo vieira"],
  ["casemiro", "carlos casemiro", "carlos henrique"],
  ["richarlison", "richarlison de andrade"],
  ["antony", "antony matheus", "antony dos santos"],
  ["bremer", "gleison bremer"],
  ["marquinhos", "marcos aoas", "marcos aoás"],
  ["alisson", "alisson becker"],
  ["ederson", "ederson moraes"],
  ["coutinho", "philippe coutinho"],
  ["firmino", "roberto firmino", "bobby firmino"],
  ["oscar", "oscar dos santos"],
  ["raphinha", "raphael dias"],
  ["fabinho", "fabio tavares", "fábio tavares"],
  ["rafinha", "rafael alcantara", "rafael alcântara"],
  ["jesus", "gabriel jesus"],
  ["paqueta", "lucas paqueta", "paquetá", "lucas paquetá"],
  ["vitinha", "vitor ferreira", "vítor ferreira"],
  ["joao felix", "joao felix sequeira", "joão félix", "joão félix sequeira"],
  ["endrick", "endrick felipe"],
  ["pedri", "pedro gonzalez", "pedro gonzález"],
  ["gavi", "pablo paez", "pablo páez"],
  ["fati", "ansu fati"],
  ["isco", "francisco roman", "francisco román"],
  ["koke", "jorge resurreccion", "jorge resurrección"],
  ["aspas", "iago aspas"],
  ["nico", "nicolas gonzalez", "nico gonzalez", "nicolás gonzález", "nico gonzález"],
  ["dybala", "paulo dybala"],
  ["lo celso", "giovani lo celso"],
  ["paredes", "leandro paredes"],
  ["di maria", "angel di maria", "ángel di maría"],
  ["bruno", "bruno fernandes"],
  ["cancelo", "joao cancelo", "joão cancelo"],
  ["bernardo", "bernardo silva"],
  ["mo salah", "mohamed salah"],
  ["kdb", "kevin de bruyne"],
  ["cr7", "cristiano ronaldo"],
  ["leo messi", "lionel messi"],
  ["mac allister", "alexis mac allister"],
];

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

const aliasIndex = new Map<string, Set<string>>();
for (const group of PLAYER_NAME_ALIASES) {
  const originals = new Set(group.map((t) => t.trim()));
  for (const term of group) {
    const key = normalize(term);
    const existing = aliasIndex.get(key);
    if (existing) {
      for (const o of originals) existing.add(o);
    } else {
      aliasIndex.set(key, new Set(originals));
    }
  }
}

// Returns all known synonyms of `q` (including q itself), trimmed.
// If q has no aliases, returns just [q.trim()].
export function expandAliases(q: string): string[] {
  const n = normalize(q);
  if (!n) return [q.trim()];
  const direct = aliasIndex.get(n);
  if (direct) return Array.from(direct);
  for (const [key, set] of aliasIndex.entries()) {
    if (n === key || n.includes(key) || key.includes(n)) {
      return Array.from(set);
    }
  }
  return [q.trim()];
}
