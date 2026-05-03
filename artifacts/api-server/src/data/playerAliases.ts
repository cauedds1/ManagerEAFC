// Synonym groups for player names. When the user searches any term in a group,
// we also search for all the others. Useful when the AI / EA FC nickname differs
// from the api-football canonical name (e.g. "Savinho" vs "Sávio").
//
// Keep entries lowercase and accent-stripped — matching is normalized.
// Each group should list every spelling that might appear in either source.
//
// To add a new alias: append a new array with all known forms.

// Each group lists every spelling that might appear in either source — include
// both accented and unaccented forms (ILIKE is NOT accent-insensitive).
export const PLAYER_NAME_ALIASES: string[][] = [
  // Brazilians with mononyms / nicknames
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

  // Spanish / Iberian aliases
  ["pedri", "pedro gonzalez", "pedro gonzález"],
  ["gavi", "pablo paez", "pablo páez"],
  ["fati", "ansu fati"],
  ["isco", "francisco roman", "francisco román"],
  ["koke", "jorge resurreccion", "jorge resurrección"],
  ["aspas", "iago aspas"],
  ["nico", "nicolas gonzalez", "nico gonzalez", "nicolás gonzález", "nico gonzález"],

  // Argentinians
  ["dybala", "paulo dybala"],
  ["lo celso", "giovani lo celso"],
  ["paredes", "leandro paredes"],
  ["di maria", "angel di maria", "ángel di maría"],

  // Portuguese
  ["bruno", "bruno fernandes"],
  ["cancelo", "joao cancelo", "joão cancelo"],
  ["bernardo", "bernardo silva"],

  // Other common nicknames
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

// Index keyed by normalized term → set of ORIGINAL (possibly accented) variants.
// Keeping originals is critical because Postgres ILIKE is not accent-insensitive,
// so we need to ILIKE for both "savio" and "sávio" to match either DB form.
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

// Returns all synonyms of `q` (including q itself), in their original spelling
// so SQL ILIKE can match accented variants in the DB.
// If q has no aliases, returns just [q_trimmed].
export function expandAliases(q: string): string[] {
  const n = normalize(q);
  const direct = aliasIndex.get(n);
  if (direct) return Array.from(direct);
  for (const [key, set] of aliasIndex.entries()) {
    if (n === key || n.includes(key) || key.includes(n)) {
      return Array.from(set);
    }
  }
  return [q.trim()];
}
