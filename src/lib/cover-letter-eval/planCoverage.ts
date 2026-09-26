/**
 * Plan coverage, measured the same way scripts/eval-corpus.ts measures it:
 * the trace, not the wording — a traced background line counts as drawing on
 * the plan's evidence when enough five-character content stems are shared.
 */
export interface TracedSource {
  claim: string;
  source: string;
}

const tokens = (s: string) => (s || '').toLowerCase().match(/[a-z']+/g) || [];

const COMMON = new Set([
  'about', 'after', 'again', 'against', 'along', 'already', 'also', 'although', 'always', 'among',
  'another', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'bring', 'came',
  'could', 'doing', 'during', 'each', 'every', 'first', 'from', 'given', 'have', 'having', 'here',
  'into', 'itself', 'narrowly', 'often', 'once', 'only', 'other', 'others', 'over', 'rather', 'really',
  'role', 'same', 'should', 'since', 'some', 'still', 'such', 'take', 'team', 'than', 'that', 'their',
  'them', 'then', 'there', 'these', 'they', 'thing', 'things', 'this', 'those', 'through', 'thus',
  'time', 'under', 'until', 'upon', 'used', 'using', 'very', 'want', 'well', 'were', 'what', 'when',
  'where', 'which', 'while', 'with', 'within', 'without', 'work', 'working', 'would', 'years', 'your',
]);

export const contentStems = (text: string): Set<string> =>
  new Set(
    tokens(text)
      .filter((w) => w.length >= 5 && !COMMON.has(w))
      .map((w) => w.slice(0, 5)),
  );

export function planCoverage(
  map: { entries: { strength: string; evidence?: string; claim?: string; source?: string }[] } | null | undefined,
  traced: TracedSource[],
): number | null {
  const entries = (map?.entries || []).filter((e) => e.strength !== 'none' && (e.evidence || e.claim));
  if (!entries.length) return null;
  const have = traced.map((t) => contentStems(`${t.claim} ${t.source}`)).filter((s) => s.size);
  if (!have.length) return 0;

  const drawn = entries.filter((e) => {
    const wanted = contentStems(`${e.evidence} ${e.source}`);
    if (!wanted.size) return false;
    return have.some((line) => {
      let shared = 0;
      for (const stem of wanted) if (line.has(stem)) shared++;
      return shared >= Math.max(2, Math.ceil(Math.min(wanted.size, line.size) * 0.5));
    });
  }).length;
  return drawn / entries.length;
}
