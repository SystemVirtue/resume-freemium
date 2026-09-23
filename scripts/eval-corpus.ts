/**
 * Live evaluation harness for the cover letter pipeline.
 *
 * The problem this measures is variance, not the best case: a system that is
 * occasionally brilliant and frequently mediocre is the thing being fixed. So
 * the corpus is run through several modes, every mode is repeated, and the
 * numbers reported are a distribution — average, worst, best and spread — not a
 * single lucky generation.
 *
 *   npm run eval
 *
 * The key is read from OPENROUTER_API_KEY, or from .env.local / .env if it is
 * not already set in the environment (an existing variable always wins).
 *
 * Environment:
 *   EVAL_MODE      legacy | prompt | pipeline | both   (default both)
 *                  legacy   the pre-v2 prompt, read from git
 *                  prompt   the current v2 prompt, no planning or review
 *                  pipeline the staged pipeline: plan → draft → review → repair
 *                           → validate → gate
 *   EVAL_REPEATS   generations per case (default 1; use 3 for a variance read)
 *   EVAL_MODEL     model slug (default a free OpenRouter model)
 *   EVAL_REF       git revision the legacy prompt is read from (default 201ac08)
 *   EVAL_IDS       comma-separated corpus ids, for a quick pass
 *   EVAL_VERBOSE   set to 1 to print every generation's numbers
 *
 * The "penalty" column is a proxy, not a quality score: it is a weighted count
 * of everything measurable and wrong (unsupported claims, genericity, ad echo,
 * resume echo, repetition, length, a gate that says regenerate). Lower is
 * better, and its spread across repeats is the number this file exists to watch.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  Ctx,
  GROUNDING_SYSTEM,
  LETTER_SYSTEM,
  Paragraph,
  contextBlock,
  draftPrompt,
  flagRepetition,
  groundingPrompt,
  letterWordCount,
  normaliseModelText,
  promptWithInstruction,
} from '@/lib/coverLetter';
import {
  PLAN_SYSTEM,
  EvidenceMap,
  evidenceMapBlock,
  mapQuestions,
  parseEvidenceMap,
  planPrompt,
} from '@/lib/coverLetterPlan';
import {
  CRITIC_SYSTEM,
  Critique,
  FailureCode,
  critiqueInstructions,
  critiquePrompt,
  parseCritique,
} from '@/lib/coverLetterCritic';
import { GateVerdict, qualityGate, ngramOverlap } from '@/lib/coverLetterGate';
import { CORPUS, CorpusCase } from '../tests/corpus/cases';

/**
 * Read the key from the environment, or from .env.local / .env when it is not
 * already set, so a live run is one command instead of an exported secret. An
 * existing environment variable always wins and nothing is written back.
 */
function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    let text = '';
    try {
      text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^["'](.*)["']$/, '$1');
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
}
loadEnvFiles();

const API_KEY = process.env.OPENROUTER_API_KEY || '';

/**
 * A cassette stands in for the model: a file of answers, keyed by case and stage.
 *
 * It exists so the pipeline can be run end to end without a key, and so the
 * stages can be exercised against answers whose faults are known. Answers
 * written by one author are a single sample of that author, not of the app's
 * model, so a cassette run reports a quality level and exercises every stage —
 * it cannot report variance, because the same answer replays every time.
 */
let loadedCassette: Record<string, unknown> | null = null;

/** Read the cassette on first use, not at import: the file is a side effect. */
function cassette(): Record<string, unknown> | null {
  if (loadedCassette) return loadedCassette;
  const path = process.env.EVAL_CASSETTE || '';
  if (!path) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the file is not a JSON object of answers');
    }
    loadedCassette = parsed as Record<string, unknown>;
    return loadedCassette;
  } catch (err: any) {
    console.error(`Could not read the cassette at ${path}: ${err?.message}`);
    process.exit(1);
  }
}
const MODEL = process.env.EVAL_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
const LEGACY_REF = process.env.EVAL_REF || '201ac08';
const MODE = (process.env.EVAL_MODE || 'both').toLowerCase();
const REPEATS = Math.max(1, Number(process.env.EVAL_REPEATS || 1));
const VERBOSE = process.env.EVAL_VERBOSE === '1';
const ONLY = (process.env.EVAL_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const GENERIC = [
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

export type Mode = 'legacy' | 'prompt' | 'pipeline';

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

const makeCtx = (c: CorpusCase): Ctx => ({
  resume: c.resume,
  job: c.job,
  context: [],
  style: { custom: c.tone || '', english: 'uk' },
  rules: c.rules,
  requirements: c.requirements,
  appeals: c.appeals,
});

const tokens = (s: string) => normaliseModelText(s).toLowerCase().match(/[a-z']+/g) || [];

/**
 * Answer one question: from a cassette when one is given, otherwise from the
 * model. The key is the case and stage, which is what a cassette is written
 * against — a hash would make the file unreadable and unauthorable by hand.
 */
async function ask(system: string, prompt: string, key: string): Promise<string> {
  const answers = cassette();
  if (answers) {
    const answer = answers[key];
    if (answer === undefined || answer === null || answer === '') {
      throw new Error(`The cassette has no answer for "${key}".`);
    }
    /** Structured answers are written as JSON in the file; the stage reads text. */
    return typeof answer === 'string' ? answer : JSON.stringify(answer);
  }
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
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

function json<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0).concat([0]),
  );
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return null;
  }
}

/** What one generation produced, measured the same way whichever mode wrote it. */
export interface Sample {
  caseId: string;
  mode: Mode;
  ok: boolean;
  error?: string;
  words: number;
  lengthOk: boolean;
  adEcho: number;
  resumeEcho: number;
  generic: number;
  repetition: number;
  /** Share of the plan's evidenced requirements the letter draws on. null without a plan. */
  planCover: number | null;
  forbidden: string[];
  failures: Partial<Record<FailureCode, number>>;
  verdict: GateVerdict | null;
  questions: number;
  repaired: boolean;
  /** Lower is better. A proxy for "how much is wrong", not a quality score. */
  penalty: number;
}

/** The 5-gram overlap between the letter and the ad, as a share of the letter. */
const adEcho = (letter: string, job: string) => ngramOverlap(letter, job, 5);

/**
 * Words too common to be evidence that a letter drew on one particular piece of
 * background: every letter contains them, so they prove nothing. Kept short and
 * deliberately boring rather than clever.
 */
const COMMON = new Set([
  'about', 'after', 'again', 'against', 'along', 'already', 'also', 'although', 'always', 'among',
  'another', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'bring', 'came',
  'could', 'doing', 'during', 'each', 'every', 'first', 'from', 'given', 'have', 'having', 'here',
  'into', 'itself', 'just', 'keep', 'last', 'later', 'least', 'less', 'like', 'made', 'make', 'many',
  'might', 'more', 'most', 'much', 'must', 'never', 'next', 'nothing', 'often', 'once', 'only',
  'other', 'others', 'over', 'rather', 'really', 'role', 'same', 'should', 'since', 'some', 'still',
  'such', 'take', 'team', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'things', 'this', 'those', 'through', 'thus', 'time', 'under', 'until', 'upon', 'used', 'using',
  'very', 'want', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'within',
  'without', 'work', 'working', 'would', 'years', 'your',
]);

/** Five-character stems of the content words in a phrase, deduplicated. */
export const contentStems = (text: string): Set<string> =>
  new Set(
    tokens(text)
      .filter((w) => w.length >= 5 && !COMMON.has(w))
      .map((w) => w.slice(0, 5)),
  );

/** One background line the validator traced a claim back to. */
export interface TracedSource {
  claim: string;
  source: string;
}

/**
 * How much of the plan the letter actually draws on.
 *
 * This replaces a measure that counted the employer's vocabulary in the letter. That
 * one scored the advertisement itself at 100%, so the letter was rewarded for using
 * the wording the echo check penalises: the two numbers pulled against each other
 * and neither could be read on its own.
 *
 * Comparing the letter's words with the plan's instead does not fix it, because a
 * letter is supposed to rephrase and the evidence for a relevant requirement
 * naturally shares vocabulary with the ad that made it relevant — measured that way
 * the advertisement still covered its own requirements.
 *
 * So this measures the trace, not the wording: the validator already reports, per
 * paragraph, which background lines each claim rests on. An entry the plan found
 * evidence for counts as drawn on when one of those traced lines matches the entry's
 * evidence. Echoing the ad produces no traced background lines at all, so it earns
 * nothing here. What it cannot do is distinguish a letter that used the evidence from
 * one that used the same words by accident; it says the evidence is visible in the
 * letter, which is what coverage is for.
 *
 * Requirements the plan marked as having no evidence are left out of the denominator
 * on purpose: the letter is supposed to leave those out, so covering them would be
 * the fault rather than the goal.
 *
 * Returns null when there is nothing to judge: no plan (the single-call modes have
 * none) or no requirement with evidence behind it.
 */
export function planCoverage(
  map: EvidenceMap | null | undefined,
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
      // Half of the shorter phrase: the two are short descriptions of the same
      // thing, so a couple of shared words is a coincidence but half of them is not.
      return shared >= Math.max(2, Math.ceil(Math.min(wanted.size, line.size) * 0.5));
    });
  }).length;
  return drawn / entries.length;
}

/**
 * Everything the letter can be charged with. The weights are a judgement, kept
 * in one place so they can be argued with: an unsupported claim costs far more
 * than a repeated word, and a letter the gate calls regenerate costs more than a
 * letter it calls worth a small edit.
 *
 * Every category the critic and the validator can report has a weight. An
 * earlier version weighted only the five codes that happened to be wired up
 * first, which meant a finding reported as REPETITION or POOR_JOB_ALIGNMENT cost
 * nothing — the number the variance claim rests on was blind to most of the
 * taxonomy it was counting. tests/evalInstrument.test.ts holds this table to
 * that promise.
 */
const FAILURE_WEIGHTS: Partial<Record<FailureCode, number>> = {
  // A claim nobody can defend, or a real fact on the wrong employer.
  UNSUPPORTED_CLAIM: 3,
  MISATTRIBUTED_FACT: 3,
  // The case is not made: the claim outruns the source, or the wrong evidence
  // was chosen, or the letter answers a different job.
  OVERCLAIMING: 2,
  INSUFFICIENT_EVIDENCE: 2,
  POOR_EVIDENCE_SELECTION: 2,
  POOR_JOB_ALIGNMENT: 2,
  GENERICITY: 2,
  RESUME_DUPLICATION: 1.5,
  WEAK_ROLE_CONNECTION: 1.5,
  // Craft: real faults, but editing rather than invention.
  WEAK_OPENING: 1,
  WEAK_CLOSING: 1,
  WEAK_EMPLOYER_CONNECTION: 1,
  AD_ECHO: 1,
  EMPLOYER_DESCRIPTION: 1,
  AI_LIKE_LANGUAGE: 1,
  EXCESSIVE_JARGON: 1,
  FORMULAIC_STRUCTURE: 1,
  UNRESOLVED_ENDING: 1,
  EXCESSIVE_LENGTH: 1,
  WRONG_SENIORITY: 1,
  WRONG_TONE: 1,
  RULE_BREACH: 1,
  REPETITION: 0.5,
  FORMATTING_ERROR: 0.5,
  OTHER: 0.5,
  // Not a defect in the letter: a question only the candidate can answer, and
  // reported on its own line as needed-user-input.
  MISSING_INFORMATION: 0,
  // Also not a defect, and the whole reason it exists as its own code: naming a
  // requirement in order to admit a gap is the honest alternative to implying cover
  // for it, and it used to be charged as ad echo at 1.
  GAP_STATEMENT: 0,
};

const DEFAULT_FAILURE_WEIGHT = 1;

function penaltyOf(sample: Omit<Sample, 'penalty'>): number {
  const lengthPenalty = sample.lengthOk ? 0 : 1;
  const gatePenalty = sample.verdict === 'regenerate' ? 3 : sample.verdict === 'minor' ? 1 : 0;
  const reported = Object.entries(sample.failures).reduce(
    (sum, [code, n]) =>
      sum + (n || 0) * (FAILURE_WEIGHTS[code as FailureCode] ?? DEFAULT_FAILURE_WEIGHT),
    0,
  );
  return (
    reported +
    10 * sample.adEcho +
    10 * sample.resumeEcho +
    0.5 * sample.repetition +
    sample.generic +
    lengthPenalty +
    gatePenalty
  );
}

function paragraph(text: string, i: number, flags?: any): Paragraph {
  const g = flags || {};
  return {
    id: `p${i}`,
    text,
    locked: false,
    unsupported: g.unsupported,
    misattributed: g.misattributed,
    echoes: g.echoes,
    gapStatement: g.gapStatement,
    scope: g.scope,
    employer: g.employer,
    pivot: g.pivot,
    unresolved: g.unresolved,
    needsInput: g.needsInput,
  };
}

const split = (text: string) => normaliseModelText(text).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);

/**
 * The measurement every mode shares: validate the letter, put it to the gate,
 * and score it. Every mode gets this, because a letter written without planning
 * must not escape the checks a planned letter faces — charging the pipeline for
 * faults the other modes are never asked about would rig the comparison.
 *
 * The only thing a mode supplies is the review: the pipeline has one, and the
 * single-call modes have nothing to supply.
 */
async function scoreLetter(input: {
  c: CorpusCase;
  mode: Mode;
  letter: string;
  ctx: Ctx;
  /** Cassette key for the validator's answer. */
  groundKey: string;
  critique: Critique | null;
  openQuestions?: string[];
  questions: number;
  repaired: boolean;
}): Promise<Sample> {
  const parts = split(input.letter);
  const groundRaw = await ask(
    GROUNDING_SYSTEM,
    groundingPrompt(input.ctx, parts),
    input.groundKey,
  );
  const ground = json<{ paragraphs: any[] }>(groundRaw);
  const paragraphs = parts.map((text, i) => paragraph(text, i, ground?.paragraphs?.[i]));
  /** Every background line the validator traced a claim to, across the letter. */
  const traced: TracedSource[] = (ground?.paragraphs || []).flatMap((p: any) =>
    (Array.isArray(p?.sources) ? p.sources : [])
      .map((s: any) =>
        typeof s === 'string'
          ? { claim: '', source: s }
          : { claim: String(s?.claim || ''), source: String(s?.source || '') },
      )
      .filter((s: TracedSource) => s.claim || s.source),
  );

  const gate = qualityGate({
    paragraphs,
    critique: input.critique,
    openQuestions: input.openQuestions || [],
    resume: input.c.resume,
    minWords: 250,
    maxWords: 400,
  });

  return measure({
    caseId: input.c.id,
    mode: input.mode,
    letter: input.letter,
    c: input.c,
    verdict: gate.verdict,
    failures: gate.failures,
    questions: input.questions,
    repaired: input.repaired,
    planCover: planCoverage(input.ctx.plan, traced),
  });
}

/** The pre-v2 prompt: one call, no planning, no review. */
async function runLegacy(c: CorpusCase, system: string): Promise<Sample> {
  const ctx = makeCtx(c);
  const raw = await ask(system, draftPrompt(ctx), `${c.id}:legacy`);
  const parsed = json<{ paragraphs: string[] }>(raw);
  const letter = (parsed?.paragraphs?.length ? parsed.paragraphs.join('\n\n') : raw).trim();
  return scoreLetter({
    c,
    mode: 'legacy',
    letter,
    ctx,
    groundKey: `${c.id}:legacy:ground`,
    critique: null,
    questions: 0,
    repaired: false,
  });
}

/** The current v2 prompt on its own: the generation stage with nothing around it. */
async function runPromptOnly(c: CorpusCase): Promise<Sample> {
  const ctx = makeCtx(c);
  const raw = await ask(LETTER_SYSTEM, draftPrompt(ctx), `${c.id}:prompt`);
  const parsed = json<{ paragraphs: string[] }>(raw);
  const letter = (parsed?.paragraphs?.length ? parsed.paragraphs.join('\n\n') : raw).trim();
  return scoreLetter({
    c,
    mode: 'prompt',
    letter,
    ctx,
    groundKey: `${c.id}:prompt:ground`,
    critique: null,
    questions: 0,
    repaired: false,
  });
}

/**
 * The staged pipeline as the app runs it: plan the evidence, write to the plan,
 * have an independent review attack the draft, repair what blocks it, validate
 * every claim against the background, then let the gate decide.
 */
export async function runPipeline(c: CorpusCase): Promise<Sample> {
  const ctx = makeCtx(c);
  const plainContext = contextBlock({ ...ctx, plan: undefined });

  const planRaw = await ask(
    PLAN_SYSTEM,
    planPrompt({ context: plainContext, requirements: c.requirements }),
    `${c.id}:plan`,
  );
  const map: EvidenceMap | null = parseEvidenceMap(json<any>(planRaw), c.requirements);
  const withPlan: Ctx = { ...ctx, plan: map || undefined };

  const draftRaw = await ask(LETTER_SYSTEM, draftPrompt(withPlan), `${c.id}:draft`);
  const drafted = json<{ paragraphs: string[] }>(draftRaw);
  let letter = (drafted?.paragraphs?.length ? drafted.paragraphs.join('\n\n') : draftRaw).trim();

  const critiqueRaw = await ask(
    CRITIC_SYSTEM,
    critiquePrompt({
      context: plainContext,
      letter,
      planBlock: map ? evidenceMapBlock(map) : '',
    }),
    `${c.id}:critique`,
  );
  const critique: Critique | null = parseCritique(json<any>(critiqueRaw));
  const mustFix = critiqueInstructions(critique, 'must-fix');
  let repaired = false;
  let finalCritique = critique;
  if (mustFix.length) {
    repaired = true;
    const repairRaw = await ask(
      LETTER_SYSTEM,
      promptWithInstruction(
        withPlan,
        letter,
        'Fix the problems the review raised, without undoing what it said works.',
        [],
        [],
        mustFix,
        [],
      ),
      `${c.id}:repair`,
    );
    const repaired_ = json<{ paragraphs: string[] }>(repairRaw);
    const next = repaired_?.paragraphs?.length ? repaired_.paragraphs.join('\n\n') : '';
    if (next.trim()) letter = next.trim();

    /*
     * A repaired letter is reviewed again before it is gated, as the app does.
     * Gating a revision against the findings on the draft would charge it for
     * problems it has already fixed.
     */
    finalCritique =
      parseCritique(
        json<any>(
          await ask(
            CRITIC_SYSTEM,
            critiquePrompt({
              context: plainContext,
              letter,
              planBlock: map ? evidenceMapBlock(map) : '',
            }),
            `${c.id}:critique-after`,
          ),
        ),
      ) ?? critique;
  }

  const questions = map ? mapQuestions(map) : [];
  return scoreLetter({
    c,
    mode: 'pipeline',
    letter,
    ctx: withPlan,
    groundKey: `${c.id}:ground`,
    critique: finalCritique,
    openQuestions: questions,
    questions: questions.length,
    repaired,
  });
}

export function measure(input: {
  caseId: string;
  mode: Mode;
  letter: string;
  c: CorpusCase;
  verdict: GateVerdict | null;
  failures: Partial<Record<FailureCode, number>>;
  questions: number;
  repaired: boolean;
  /** Computed from the plan in scoreLetter, so it is null where no plan exists. */
  planCover?: number | null;
}): Sample {
  const { letter, c } = input;
  const words = letterWordCount(split(letter).map((t, i) => paragraph(t, i)));
  const lower = letter.toLowerCase();
  const base = {
    caseId: input.caseId,
    mode: input.mode,
    ok: true,
    words,
    lengthOk: words >= 250 && words <= 400,
    adEcho: adEcho(letter, c.job),
    resumeEcho: ngramOverlap(letter, c.resume, 5),
    generic: GENERIC.filter((g) => lower.includes(g)).length,
    repetition: flagRepetition(letter).length,
    planCover: input.planCover ?? null,
    forbidden: (c.expectations.forbiddenWords || []).filter((w) => lower.includes(w.toLowerCase())),
    failures: input.failures,
    verdict: input.verdict,
    questions: input.questions,
    repaired: input.repaired,
  };
  return { ...base, penalty: penaltyOf(base) };
}

/* ------------------------------------------------------------------ *
 * Reporting                                                          *
 * ------------------------------------------------------------------ */

interface Stats {
  mean: number;
  min: number;
  max: number;
  sd: number;
}

function stats(values: number[]): Stats {
  if (!values.length) return { mean: 0, min: 0, max: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, min: Math.min(...values), max: Math.max(...values), sd: Math.sqrt(variance) };
}

const fmt = (s: Stats, digits = 2) => `${s.mean.toFixed(digits)} / ${s.min.toFixed(digits)} / ${s.max.toFixed(digits)} / ${s.sd.toFixed(digits)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

function summarise(samples: Sample[], label: string) {
  const ok = samples.filter((s) => s.ok);
  if (!ok.length) {
    console.log(`${label}: every generation failed.`);
    return;
  }
  const line = (name: string, field: (s: Sample) => number, digits = 2) =>
    console.log(`  ${pad(name, 20)} ${fmt(stats(ok.map(field)), digits)}`);

  console.log(`\n${label} — ${ok.length} letters, mean / min / max / sd (lower is better):`);
  line('penalty (proxy)', (s) => s.penalty);
  line('words', (s) => s.words, 0);
  line('ad echo', (s) => s.adEcho * 100, 1);
  line('resume echo', (s) => s.resumeEcho * 100, 1);
  line('genericity hits', (s) => s.generic, 2);
  line('repetition flags', (s) => s.repetition, 2);
  line('unsupported', (s) => s.failures.UNSUPPORTED_CLAIM || 0, 2);
  line('misattributed', (s) => s.failures.MISATTRIBUTED_FACT || 0, 2);
  line('overclaiming', (s) => s.failures.OVERCLAIMING || 0, 2);
  // Pipeline-only, and labelled as such: the single-call modes have no plan to
  // measure a letter against, so printing a zero for them would read as a failure.
  const planValues = ok
    .map((s) => s.planCover)
    .filter((v): v is number => typeof v === 'number');
  console.log(
    `  ${pad('plan coverage', 20)} ${
      planValues.length
        ? fmt(stats(planValues.map((v) => v * 100)), 0)
        : 'n/a (no plan in this mode)'
    }`,
  );
  console.log(
    `  length in band: ${pct(ok.filter((s) => s.lengthOk).length / ok.length)}   ` +
      `forbidden words: ${ok.filter((s) => s.forbidden.length).length}`,
  );
  if (ok.some((s) => s.verdict)) {
    console.log(
      `  gate: pass ${pct(ok.filter((s) => s.verdict === 'pass').length / ok.length)}  ` +
        `minor ${pct(ok.filter((s) => s.verdict === 'minor').length / ok.length)}  ` +
        `needs input ${pct(ok.filter((s) => s.verdict === 'needs-input').length / ok.length)}  ` +
        `regenerate ${pct(ok.filter((s) => s.verdict === 'regenerate').length / ok.length)}`,
    );
    console.log(
      `  needed user input: ${pct(ok.filter((s) => s.questions > 0).length / ok.length)}   ` +
        `auto-repaired: ${pct(ok.filter((s) => s.repaired).length / ok.length)}`,
    );
  }

  const totals: Partial<Record<string, number>> = {};
  for (const s of ok) {
    for (const [code, n] of Object.entries(s.failures)) {
      totals[code] = (totals[code] || 0) + (n || 0);
    }
  }
  const entries = Object.entries(totals).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  console.log(
    `  failure categories: ${entries.length ? entries.map(([c, n]) => `${c}×${n}`).join(' ') : 'none'}`,
  );
}

async function main() {
  if (!API_KEY && !cassette()) {
    console.error(
      'Set OPENROUTER_API_KEY, or put it in .env.local, to run the live corpus against a real model.',
    );
    console.error('Or point EVAL_CASSETTE at a file of answers to run the stages offline.');
    console.error('The measuring half needs no key at all: npm test covers it.');
    process.exit(1);
  }
  const legacy = MODE === 'legacy' || MODE === 'both' ? legacyPrompt() : null;
  if ((MODE === 'legacy' || MODE === 'both') && !legacy) {
    console.error(`Could not read the legacy prompt from git ref ${LEGACY_REF}.`);
    process.exit(1);
  }

  const cases = ONLY.length ? CORPUS.filter((c) => ONLY.includes(c.id)) : CORPUS;
  const modes: Mode[] =
    MODE === 'both'
      ? ['legacy', 'pipeline']
      : MODE === 'legacy'
        ? ['legacy']
        : MODE === 'prompt'
          ? ['prompt']
          : ['pipeline'];

  if (cassette()) {
    console.log(`Model: cassette at ${process.env.EVAL_CASSETTE} — answers written by hand, not a live model.`);
    console.log('A cassette reports a level, not a spread: the same answer replays every time.');
  } else {
    console.log(`Model: ${MODEL}`);
  }
  console.log(`Cases: ${cases.length}   Repeats: ${REPEATS}   Modes: ${modes.join(', ')}`);
  if (REPEATS === 1 && !cassette()) {
    console.log('One generation per case: raise EVAL_REPEATS=3 to read the spread, which is the point.');
  }

  const samples: Sample[] = [];
  for (const c of cases) {
    for (let run = 1; run <= REPEATS; run++) {
      for (const mode of modes) {
        try {
          const sample =
            mode === 'legacy'
              ? await runLegacy(c, legacy!)
              : mode === 'prompt'
                ? await runPromptOnly(c)
                : await runPipeline(c);
          samples.push(sample);
          if (VERBOSE) {
            console.log(
              `${pad(c.id, 16)} ${pad(mode, 9)} run ${run}  ${pad(String(sample.words), 5)} words  ` +
                `penalty ${sample.penalty.toFixed(1)}  ${sample.verdict || '-'}  ` +
                `unsupported ${sample.failures.UNSUPPORTED_CLAIM || 0}`,
            );
          }
        } catch (err: any) {
          samples.push({
            caseId: c.id,
            mode,
            ok: false,
            error: err?.message || String(err),
            words: 0,
            lengthOk: false,
            adEcho: 0,
            resumeEcho: 0,
            generic: 0,
            repetition: 0,
            planCover: null,
            forbidden: [],
            failures: {},
            verdict: null,
            questions: 0,
            repaired: false,
            penalty: 0,
          });
          console.log(`${pad(c.id, 16)} ${pad(mode, 9)} run ${run} failed: ${err?.message}`);
        }
      }
    }
  }

  for (const mode of modes) {
    summarise(
      samples.filter((s) => s.mode === mode),
      mode === 'legacy'
        ? 'Legacy prompt (pre-v2)'
        : mode === 'prompt'
          ? 'Current prompt alone'
          : 'Staged pipeline (plan → review → repair → validate → gate)',
    );
  }

  console.log('\nRead the spread, not the best number: the target is a lower sd and a lower worst case.');
}

/*
 * Run only when invoked directly, so the measuring half of this file can be
 * imported and calibrated by the test suite without starting a live run. The
 * usual import.meta.url === argv[1] comparison cannot be used here: under
 * vite-node, argv[1] is the vite-node launcher rather than this script, so a
 * path check silently skipped main() and the command appeared to do nothing.
 * The test suite is the only other importer, and it sets VITEST.
 */
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
