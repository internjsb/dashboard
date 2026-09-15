// Shared "does this text match this query" used by the segment-search bars
// (Dashboard, Sales history). Every query word has to show up somewhere in
// the text — forgiving enough that "unit sold" still matches "Units Sold (30d)".
export function matches(haystack: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack.toLowerCase();
  return words.every((w) => text.includes(w));
}
