export function getCurrentSeason(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}
