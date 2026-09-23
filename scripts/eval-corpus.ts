/**
 * Live evaluation harness. Runs the fixed corpus through the legacy letter prompt
 * and the current one, and prints the same measurements for both, so a regression
 * shows up as a number rather than as a user noticing.
 *
 *   OPENROUTER_API_KEY=sk-or-... npx vite-node scripts/eval-corpus.ts
 *
 * Optional environment:
 *   EVAL_MODEL   model slug to use (default a free OpenRouter model)
 *   EVAL_REF     git revision the legacy prompt is read from (default 201ac08)
 *   EVAL_IDS     comma-separated corpus ids to run, for a quick pass
 */
import { execFileSync } from 'node:child_process';
import {
  Ctx,
  LETTER_SYSTEM,
  draftPrompt,
  flagRepetition,
  letterWordCount,
  normaliseModelText,
} from '@/lib/coverLetter';
import { CORPUS, CorpusCase } from '../tests/corpus/cases';

const API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = process.env.EVAL_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
const LEGACY_REF = process.env.EVAL_REF || '201ac08';
const ONLY = (process.env.EVAL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

const GENERIC = [
  'team player',
  'go-getter',
  'hit the ground running',
  'think outside the box',
  'proven track record',
  'excellent communication skills',
  'fast-paced environment',
  'detail-oriented',
  'self-starter',
  'results-driven',
];

/** The legacy prompt is read from git rather than kept as a drifting copy. */
function legacyPrompt(): string | null {
  try {
    const src = execFileSync('git', ['show', `${LEGACY_REF}:src/lib/coverLetter.ts`], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const start = src.indexOf('const SYSTEM = [');
    if (start < 0) return null;
    const arrayStart = src.indexOf('[', start);
    const end = src.indexOf('].join(', arrayStart);
    if (end < 0) return null;
    // The literal is a plain array of string literals from this repository's own history.
    const items = new Function(`return ${src.slice(arrayStart, end + 1)}`)() as string[];
    return items.join('\n');
  } catch {
    return null;
  }
}

function makeCtx(c: CorpusCase): Ctx {
  return {
    resume: c.resume,
    job: c.job,
    context: [],
    style: { custom: c.tone || '', english: 'uk' },
    rules: c.rules,
    requirements: c.requirements,
    appeals: c.appeals,
  };
}

const words = (s: string) => normaliseModelText(s).toLowerCase().match(/[a-z']+/g) || [];

function ngrams(s: string, n: number): Set<string> {
  const w = words(s);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

interface Metrics {
  words: number;
  lengthOk: boolean;
  repetition: number;
  generic: number;
  adEcho: number;
  coverage: number;
  forbidden: string[];
}

function measure(letter: string, c: CorpusCase): Metrics {
  const adGrams = ngrams(c.job, 5);
  const letterGrams = ngrams(letter, 5);
  const shared = [...letterGrams].filter((g) => adGrams.has(g)).length;
  const lower = letter.toLowerCase();
  const covered = c.requirements.filter((r) => {
    const content = words(r).filter((w) => w.length > 4);
    if (!content.length) return false;
    const hits = content.filter((w) => w.slice(0, 5) && lower.includes(w.slice(0, 5))).length;
    return hits / content.length >= 0.5;
  }).length;
  return {
    words: letterWordCount(
      letter.split(/\n{2,}/).map((t, i) => ({ id: String(i), text: t, locked: false })),
    ),
    lengthOk: false,
    repetition: flagRepetition(letter).length,
    generic: GENERIC.filter((g) => lower.includes(g)).length,
    adEcho: letterGrams.size ? shared / letterGrams.size : 0,
    coverage: c.requirements.length ? covered / c.requirements.length : 1,
    forbidden: (c.expectations.forbiddenWords || []).filter((w) => lower.includes(w.toLowerCase())),
  };
}

async function write(system: string, ctx: Ctx): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'X-Title': 'JobGoblin corpus',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: draftPrompt(ctx) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    return (parsed.paragraphs || []).join('\n\n');
  } catch {
    return raw;
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

async function main() {
  const legacy = legacyPrompt();
  if (!legacy) {
    console.error(`Could not read the legacy prompt from git ref ${LEGACY_REF}.`);
    process.exit(1);
  }
  console.log(`Legacy prompt loaded from ${LEGACY_REF} (${legacy.length} characters).`);
  if (!API_KEY) {
    console.error('Set OPENROUTER_API_KEY to run the live corpus.');
    process.exit(1);
  }

  const cases = ONLY.length ? CORPUS.filter((c) => ONLY.includes(c.id)) : CORPUS;
  console.log(`Model: ${MODEL}   Cases: ${cases.length}   Legacy prompt: ${LEGACY_REF}\n`);
  console.log(`${pad('case', 16)} ${pad('prompt', 8)} ${pad('words', 6)} len  rep  gen  echo  cover  forbidden`);

  const totals = {
    legacy: { adEcho: 0, generic: 0, repetition: 0, coverage: 0 },
    new: { adEcho: 0, generic: 0, repetition: 0, coverage: 0 },
  };

  for (const c of cases) {
    for (const [name, system] of [['legacy', legacy], ['v2', LETTER_SYSTEM]] as const) {
      const ctx = makeCtx(c);
      let m: Metrics;
      try {
        m = measure(await write(system, ctx), c);
      } catch (err: any) {
        console.log(`${pad(c.id, 16)} ${pad(name, 8)} failed: ${err?.message}`);
        continue;
      }
      const ok = m.words >= 250 && m.words <= 400;
      console.log(
        `${pad(c.id, 16)} ${pad(name, 8)} ${pad(String(m.words), 6)} ${
          ok ? ' ok ' : ' !! '
        }  ${pad(String(m.repetition), 4)} ${pad(String(m.generic), 4)} ${pad(
          pct(m.adEcho),
          5,
        )}  ${pad(pct(m.coverage), 6)} ${m.forbidden.join(', ') || '-'}`,
      );
      const t = totals[name];
      t.adEcho += m.adEcho;
      t.generic += m.generic;
      t.repetition += m.repetition;
      t.coverage += m.coverage;
    }
  }

  const n = cases.length || 1;
  console.log('');
  console.log(`Average over ${n} cases (lower is better except coverage):`);
  for (const name of ['legacy', 'new'] as const) {
    const t = totals[name];
    console.log(
      `  ${pad(name, 8)} echo ${pct(t.adEcho / n)}  generic ${(t.generic / n).toFixed(1)}  ` +
        `repetition ${(t.repetition / n).toFixed(1)}  coverage ${pct(t.coverage / n)}`,
    );
  }
  console.log('\nRerun the same case after every change; compare the two blocks above.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
