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
 * Testing runs dev-side, against whichever free model is pointed at here. It
 * never calls the Lovable AI the product itself uses, so a test run cannot eat
 * the product's rate limit, and every run records which endpoint and which
 * model produced its numbers.
 *
 * The endpoint is any OpenAI-compatible chat completions API. The key is read
 * from EVAL_API_KEY, falling back to OPENROUTER_API_KEY, and from .env.local /
 * .env if it is not already in the environment (an existing variable always
 * wins). A model running on the developer's own machine needs no key at all.
 *
 * Environment:
 *   EVAL_BASE_URL  OpenAI-compatible base URL (default the OpenRouter API)
 *                  a local model: EVAL_BASE_URL=http://localhost:11434/v1
 *   EVAL_API_KEY   key for that endpoint; omit it for a local model
 *   EVAL_MODEL     model slug (default a free OpenRouter model; required in
 *                  practice for any other endpoint)
 *   EVAL_RETRIES   attempts per call before giving up (default 5)
 *   EVAL_CONCURRENCY  generations in flight at once (default 1, which is the
 *                  polite setting for a per-minute free tier)
 *   EVAL_JSON_MODE 1 to ask for JSON-object responses, 0 for local servers
 *                  that reject the parameter (default 1)
 *   EVAL_SPLIT     dev | holdout | all (default all). The holdout is the half
 *                  fixes must not be written against; membership is a hash of
 *                  the case id, so it cannot drift. See splitOf.
 *   EVAL_CORPUS    JSON array of cases, for a corpus grown outside the
 *                  fixture the unit tests treat as a contract
 *   EVAL_BASELINE  a previous report to difference this run against
 *   EVAL_OUT       directory to write the JSON and Markdown report to
 *   EVAL_LETTERS   file of letters written outside this process, keyed by
 *                  corpus id, scored by the same instrument without any model
 *                  call: see runImported
 *   EVAL_CASSETTE  file of recorded answers, for a run with no network at all
 *   EVAL_MODE      legacy | prompt | pipeline | both   (default both)
 *                  legacy   the pre-v2 prompt, read from git
 *                  prompt   the current v2 prompt, no planning or review
 *                  pipeline the staged pipeline: plan → draft → review → repair
 *                           → validate → gate
 *   EVAL_REPEATS   generations per case (default 1; use 3 for a variance read)
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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * The endpoint under test. Any OpenAI-compatible chat completions API works,
 * and that is the whole point: a free hosted model, or a local Ollama or
 * llama.cpp server on the developer's own machine, and the same pipeline is
 * measured either way. Nothing in this file reaches the Lovable AI the product
 * uses, so a test run cannot spend the product's rate limit.
 */
const BASE_URL = (process.env.EVAL_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const API_KEY = process.env.EVAL_API_KEY || process.env.OPENROUTER_API_KEY || '';
/** A local server is the one endpoint for which "no key" is correct, not a mistake. */
const NEEDS_KEY = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(BASE_URL);

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
const MODEL =
  process.env.EVAL_MODEL ||
  (BASE_URL.includes('openrouter.ai') ? 'meta-llama/llama-3.3-70b-instruct:free' : 'set-EVAL_MODEL');
const RETRIES = Math.max(1, Number(process.env.EVAL_RETRIES || 5));
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY || 1));
const JSON_MODE = (process.env.EVAL_JSON_MODE || '1') !== '0';
const LETTERS = process.env.EVAL_LETTERS || '';
const LEGACY_REF = process.env.EVAL_REF || '201ac08';
const MODE = (process.env.EVAL_MODE || 'both').toLowerCase();
const REPEATS = Math.max(1, Number(process.env.EVAL_REPEATS || 1));
const VERBOSE = process.env.EVAL_VERBOSE === '1';

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

export type Mode = 'legacy' | 'prompt' | 'pipeline' | 'letters';

/**
 * Letters written outside this process, keyed by corpus id.
 *
 * The point of the mode is to separate who writes a letter from how it is
 * measured. A person, a local model, or an agent working in this repository can
 * all drop letters into a file, and the same instrument scores them as it scores
 * a live run. Without it, the only way to get a letter measured is for this
 * script to call a model itself, which quietly turns "is this prompt any good?"
 * into "is this prompt as good as whatever model I happened to have a key for?".
 *
 * The shape is a JSON object of case id to letter text, or to { letter }:
 *
 *   { "junior": "Dear ...", "technical": { "letter": "Dear ..." } }
 */
let loadedLetters: Record<string, string> | null = null;

function importedLetters(): Record<string, string> | null {
  if (loadedLetters) return loadedLetters;
  if (!LETTERS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(LETTERS, 'utf8'));
  } catch (err: any) {
    console.error(`Could not read the letters file at ${LETTERS}: ${err?.message}`);
    process.exit(1);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(`${LETTERS} is not a JSON object of corpus id to letter.`);
    process.exit(1);
  }
  const letters: Record<string, string> = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    const letter = typeof value === 'string' ? value : (value as { letter?: unknown })?.letter;
    if (typeof letter !== 'string' || !letter.trim()) {
      console.error(`The entry for "${id}" has no letter text.`);
      process.exit(1);
    }
    letters[id] = letter.trim();
  }
  loadedLetters = letters;
  return letters;
}

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
  let last = 'no attempt made';
  for (let attempt = 1; ; attempt++) {
    let retryable = true;
    let asked = '';
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
          'X-Title': 'JobGoblin corpus',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          ...(JSON_MODE ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || '';
      }
      // A 429 or a 5xx is the endpoint asking for patience, not a verdict on
      // the prompt, so it is worth waiting out. A 4xx is a real answer — a bad
      // key, an unknown model — and retrying it just spends the run's budget.
      asked = res.headers.get('retry-after') || '';
      const detail = (await res.text()).slice(0, 200);
      retryable = res.status === 429 || res.status >= 500;
      last = `${BASE_URL} ${res.status}${detail ? `: ${detail}` : ''}`;
    } catch (err: any) {
      last = err?.message || String(err);
    }
    if (!retryable || attempt >= RETRIES) throw new Error(last);
    const wait = backoff(attempt, asked);
    console.log(
      `  ${key}: ${last.slice(0, 100)}\n  waiting ${(wait / 1000).toFixed(1)}s, ` +
        `attempt ${attempt + 1} of ${RETRIES}`,
    );
    await sleep(wait);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with equal jitter, deferring to Retry-After when the
 * endpoint sets one. The fixed half matters: pure jitter can pick a wait of
 * nearly zero, which turns a rate limit into a tight retry loop.
 */
function backoff(attempt: number, retryAfter?: string) {
  const asked = Number(retryAfter);
  if (Number.isFinite(asked) && asked > 0) return Math.min(asked * 1000, 60_000);
  const ceiling = Math.min(30_000, 1000 * 2 ** (attempt - 1));
  return ceiling / 2 + Math.random() * (ceiling / 2);
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
/**
 * Text the letter puts in double quotation marks, removed.
 *
 * Ad echo exists to catch a letter that parrots the advert into mush. It has no
 * business catching a letter that quotes the advert back in order to accept or
 * refuse it: "you asked for X, and here is what I can say about X" is the
 * load-bearing sentence of a refusal, and it overlaps the ad by definition. Only
 * double quotes are stripped — an apostrophe cannot be told from an opening
 * single quote, and "don't" is not a quotation.
 *
 * The CV is not treated this way. Quoting a job advert is attribution; quoting
 * one's own CV is lifting phrasing, which is the unoriginality that echo is
 * meant to catch.
 */
const unquoted = (text: string) => text.replace(/"[^"]*"/g, ' ');

/**
 * Exported so the quoted-span exemption can be calibrated in the tests: the
 * difference between restating the advert and attributing it is the whole
 * behaviour, and it is invisible unless you can call this directly.
 */
export const adEcho = (letter: string, job: string) => ngramOverlap(unquoted(letter), job, 5);

/**
 * The word band a letter has to land in.
 *
 * A thin advert is the exception, and the exception is the point. There are no
 * requirements to answer in four sentences of boilerplate, so a letter that
 * reaches 250 words has padded — which is the fault the case exists to catch. So
 * the floor drops for those cases and the ceiling barely moves: the letter still
 * has to be a letter, just not a padded one.
 */
const wordBand = (c: CorpusCase) =>
  c.expectations.tooThin ? { minWords: 120, maxWords: 320 } : { minWords: 250, maxWords: 400 };

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
    ...wordBand(input.c),
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
    lengthOk: words >= wordBand(c).minWords && words <= wordBand(c).maxWords,
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

/**
 * One cheap call before the corpus. A dead endpoint, a rejected key or an
 * unknown model should be one clear line, not the same failure repeated once
 * per case until a misconfiguration looks like a pipeline fault.
 */
async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
      }),
    });
    if (res.ok) return true;
    console.error(`${BASE_URL} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (res.status === 401 || res.status === 403) {
      console.error('That reads as a rejected key. Check EVAL_API_KEY.');
    } else if (res.status === 404) {
      console.error(
        'That reads as a wrong base URL or an unknown model. Check EVAL_BASE_URL and EVAL_MODEL.',
      );
    }
    return false;
  } catch (err: any) {
    console.error(`Could not reach ${BASE_URL}: ${err?.message || err}`);
    if (!NEEDS_KEY) console.error('A local model was expected. Check the server and EVAL_BASE_URL.');
    return false;
  }
}

/**
 * The run as a dev-side artifact: JSON to diff against the last run, Markdown
 * to read. A run leaves a file behind and nothing else — which is the point of
 * testing dev-side rather than in the browser.
 */
function writeReport(samples: Sample[], meta: Record<string, unknown>) {
  const dir = process.env.EVAL_OUT;
  if (!dir) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rows = [...new Set(samples.map((s) => s.mode))].map((mode) => {
    const of = samples.filter((s) => s.mode === mode && s.ok);
    return {
      mode,
      letters: of.length,
      penalty: stats(of.map((s) => s.penalty)),
      words: stats(of.map((s) => s.words)),
    };
  });
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `eval-${stamp}.json`), JSON.stringify({ ...meta, samples }, null, 2));
    writeFileSync(
      join(dir, `eval-${stamp}.md`),
      [
        `# Eval run ${stamp}`,
        '',
        `Endpoint: ${meta.endpoint}  ·  Model: ${meta.model}  ·  Repeats: ${meta.repeats}`,
        '',
        '| mode | letters | penalty mean / min / max / sd | words mean / min / max / sd |',
        '| --- | --- | --- | --- |',
        ...rows.map((r) => `| ${r.mode} | ${r.letters} | ${fmt(r.penalty)} | ${fmt(r.words, 0)} |`),
        '',
        `Failed generations: ${samples.filter((s) => !s.ok).length}`,
        '',
      ].join('\n'),
    );
    console.log(`\nReport written to ${dir}/eval-${stamp}.json and .md`);
  } catch (err: any) {
    console.error(`Could not write the report to ${dir}: ${err?.message || err}`);
  }
}

/**
 * Score letters that were written elsewhere, calling no model.
 *
 * The honest limit: without a validator in the loop there is nothing to trace a
 * claim back to the CV, so the grounded codes — UNSUPPORTED_CLAIM,
 * MISATTRIBUTED_FACT, OVERCLAIMING — stay at zero here. What is reported is the
 * half of the instrument that needs no model: length, ad echo, resume echo,
 * genericity, repetition, forbidden words, and the gate's structural verdicts.
 * That gap is stated in the output rather than averaged in silently, because a
 * zero penalty here means "not measured", not "nothing wrong".
 */
function runImported(letters: Record<string, string>): Sample[] {
  const samples: Sample[] = [];
  for (const [id, letter] of Object.entries(letters)) {
    const c = activeCorpus().find((x) => x.id === id);
    if (!c) {
      console.log(`${id}: no corpus case with that id, skipped.`);
      continue;
    }
    const paragraphs = split(letter).map((text, i) => paragraph(text, i));
    const gate = qualityGate({
      paragraphs,
      critique: null,
      openQuestions: [],
      resume: c.resume,
      ...wordBand(c),
    });
    samples.push(
      measure({
        caseId: c.id,
        mode: 'letters',
        letter,
        c,
        verdict: gate.verdict,
        failures: gate.failures,
        questions: 0,
        repaired: false,
        planCover: null,
      }),
    );
  }
  return samples;
}

/* ------------------------------------------------------------------ *
 * The loop: a corpus that can grow, a holdout, and a baseline to beat  *
 * ------------------------------------------------------------------ */

/**
 * A corpus read from a file, so cases can be added without editing the fixture
 * the tests import. The built-in corpus stays the default and stays tested;
 * this is for the generated bulk that a self-improving loop needs, which does
 * not belong in a file the unit tests treat as a contract.
 */
let loadedCorpus: CorpusCase[] | null = null;

function activeCorpus(): CorpusCase[] {
  const path = process.env.EVAL_CORPUS || '';
  if (!path) return CORPUS;
  if (loadedCorpus) return loadedCorpus;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err: any) {
    console.error(`Could not read the corpus at ${path}: ${err?.message}`);
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    console.error(`${path} is not a JSON array of cases.`);
    process.exit(1);
  }
  const cases = parsed as CorpusCase[];
  for (const c of cases) {
    if (!c.id || !c.resume || !c.job) {
      console.error(`A case in ${path} is missing an id, a resume or a job ad.`);
      process.exit(1);
    }
  }
  loadedCorpus = cases;
  return cases;
}

/**
 * Which half of the corpus a case belongs to, fixed by its id.
 *
 * The holdout is the half that fixes are not allowed to be written against. It
 * only means anything if it stays put, so the assignment is a hash of the id
 * rather than an argument, an environment variable, or a reshuffle: all three
 * make it easy to drift a case from holdout to dev after looking at its score,
 * which is the ordinary way a test set quietly becomes a training set.
 */
function splitOf(id: string): 'dev' | 'holdout' {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100 < 20 ? 'holdout' : 'dev';
}

function selectCases(): CorpusCase[] {
  const split = (process.env.EVAL_SPLIT || 'all').toLowerCase();
  const only = (process.env.EVAL_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let cases = activeCorpus();
  if (only.length) cases = cases.filter((c) => only.includes(c.id));
  if (split === 'dev' || split === 'holdout') {
    cases = cases.filter((c) => splitOf(c.id) === split);
  }
  if (!cases.length) {
    console.error(`No cases in the ${split} split.`);
    process.exit(1);
  }
  return cases;
}

/** Print the split, because a holdout nobody can see is a holdout nobody trusts. */
function announceSplit(cases: CorpusCase[]) {
  const split = (process.env.EVAL_SPLIT || 'all').toLowerCase();
  if (split === 'all') return;
  const dev = cases.filter((c) => splitOf(c.id) === 'dev').map((c) => c.id);
  const held = cases.filter((c) => splitOf(c.id) === 'holdout').map((c) => c.id);
  console.log(`Split: ${split} (${cases.length} cases)`);
  if (split === 'holdout') console.log(`Holdout: ${held.join(', ')}`);
  if (split === 'dev') console.log(`Dev, for contrast: ${dev.join(', ')}`);
}

/**
 * Compare this run against a previous report. The loop is only a loop if a run
 * can be said to have improved, and "improved" has to mean a named number moved
 * in the right direction without another one moving the wrong way. Deltas are
 * printed per failure code rather than only in the penalty total, because the
 * total can fall while the fault the fix was aimed at is merely displaced.
 */
function compareToBaseline(samples: Sample[]) {
  const path = process.env.EVAL_BASELINE || '';
  if (!path) return;
  let before: { samples: Sample[] };
  try {
    before = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err: any) {
    console.error(`Could not read the baseline at ${path}: ${err?.message}`);
    process.exit(1);
  }
  const prior = (before.samples || []).filter((s) => s.ok);
  const now = samples.filter((s) => s.ok);
  if (!prior.length || !now.length) {
    console.error('The baseline or this run has no successful generations to compare.');
    return;
  }

  const rate = (rows: Sample[], code: FailureCode) =>
    rows.reduce((sum, s) => sum + (s.failures?.[code] || 0), 0) / rows.length;
  const codes = [...new Set([...prior, ...now].flatMap((s) => Object.keys(s.failures || {})))]
    .filter((c): c is FailureCode => !!c)
    .sort();

  const line = (name: string, was: number, is: number, better: 'down' | 'up', unit = '') => {
    const delta = is - was;
    const good = better === 'down' ? delta < 0 : delta > 0;
    const flat = Math.abs(delta) < 1e-9;
    const mark = flat ? '  =  ' : good ? ' better' : ' WORSE';
    const d = `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
    console.log(
      `  ${pad(name, 26)} ${was.toFixed(2)}${unit} -> ${is.toFixed(2)}${unit}  ${d.padStart(7)}${mark}`,
    );
  };

  console.log(`\nAgainst baseline ${path} (${prior.length} -> ${now.length} letters):`);
  line('mean penalty', stats(prior.map((s) => s.penalty)).mean, stats(now.map((s) => s.penalty)).mean, 'down');
  line('worst penalty', stats(prior.map((s) => s.penalty)).max, stats(now.map((s) => s.penalty)).max, 'down');
  line('length in band', (prior.filter((s) => s.lengthOk).length / prior.length) * 100, (now.filter((s) => s.lengthOk).length / now.length) * 100, 'up', '%');
  line('ad echo', stats(prior.map((s) => s.adEcho)).mean, stats(now.map((s) => s.adEcho)).mean, 'down');
  line('resume echo', stats(prior.map((s) => s.resumeEcho)).mean, stats(now.map((s) => s.resumeEcho)).mean, 'down');
  line('repetition flags', stats(prior.map((s) => s.repetition)).mean, stats(now.map((s) => s.repetition)).mean, 'down');
  for (const code of codes) line(`${code} per letter`, rate(prior, code), rate(now, code), 'down');
  console.log(
    '  A fix that lowers the total while raising a code has moved the fault, not removed it.',
  );
}

async function main() {
  if (!API_KEY && !cassette() && !importedLetters() && NEEDS_KEY) {
    console.error(`No key for ${BASE_URL}.`);
    console.error('  a free hosted model: set EVAL_API_KEY, or OPENROUTER_API_KEY, in .env.local');
    console.error('  a model on this machine (free, unmetered, no key):');
    console.error('    ollama pull llama3.1:8b');
    console.error('    EVAL_BASE_URL=http://localhost:11434/v1 EVAL_MODEL=llama3.1:8b npm run eval');
    console.error('  no network at all: point EVAL_CASSETTE at a file of recorded answers');
    console.error('The measuring half needs no key and no model: npm test covers it.');
    process.exit(1);
  }
  if (importedLetters()) {
    const split = (process.env.EVAL_SPLIT || 'all').toLowerCase();
    const all = importedLetters()!;
    const letters =
      split === 'dev' || split === 'holdout'
        ? Object.fromEntries(
            Object.entries(all).filter(([id]) => splitOf(id) === split),
          )
        : all;
    if (!Object.keys(letters).length) {
      console.error(`None of the supplied letters fall in the ${split} split.`);
      process.exit(1);
    }
    console.log(`Letters: ${LETTERS} — ${Object.keys(letters).length} written outside this process.`);
    announceSplit(Object.keys(letters).map((id) => ({ id } as CorpusCase)));
    console.log(
      'No model is called, so the claim-grounding codes stay at zero: not measured, not clean.',
    );
    const samples = runImported(letters);
    summarise(samples, `Imported letters (${samples.length})`);
    compareToBaseline(samples);
    writeReport(samples, {
      at: new Date().toISOString(),
      endpoint: `letters:${LETTERS}`,
      model: 'external',
      modes: ['letters'],
      cases: samples.length,
      repeats: 1,
      concurrency: 1,
    });
    console.log(
      '\nRead the spread, not the best number: the target is a lower sd and a lower worst case.',
    );
    return;
  }

  const legacy = MODE === 'legacy' || MODE === 'both' ? legacyPrompt() : null;
  if ((MODE === 'legacy' || MODE === 'both') && !legacy) {
    console.error(`Could not read the legacy prompt from git ref ${LEGACY_REF}.`);
    process.exit(1);
  }

  const cases = selectCases();
  announceSplit(cases);
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
    console.log(`Endpoint: ${BASE_URL}`);
    console.log(`Model: ${MODEL}   key: ${API_KEY ? 'set' : 'not needed'}   in flight: ${CONCURRENCY}`);
    if (!await reachable()) process.exit(1);
  }
  console.log(`Cases: ${cases.length}   Repeats: ${REPEATS}   Modes: ${modes.join(', ')}`);
  if (REPEATS === 1 && !cassette()) {
    console.log('One generation per case: raise EVAL_REPEATS=3 to read the spread, which is the point.');
  }

  const samples: Sample[] = [];
  // The work list is built up front so the pool below can hand out jobs and
  // keep every slot busy. With the default concurrency of 1 this is the same
  // sequential run as before; raising it trades rate-limit patience for
  // wall-clock, which is the trade a free per-minute tier forces.
  const jobs: Array<{ c: CorpusCase; run: number; mode: Mode }> = [];
  for (const c of cases) {
    for (let run = 1; run <= REPEATS; run++) {
      for (const mode of modes) jobs.push({ c, run, mode });
    }
  }
  const failures: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      // Read and bump without an await between them, so two workers can never
      // claim the same job.
      const job = jobs[next++];
      const { c, run, mode } = job;
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
        const message = err?.message || String(err);
        failures.push(message);
        samples.push({
          caseId: c.id,
          mode,
          ok: false,
          error: message,
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
        console.log(`${pad(c.id, 16)} ${pad(mode, 9)} run ${run} failed: ${message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

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

  const failed = samples.filter((s) => !s.ok);
  if (failed.length) {
    const distinct = [...new Set(failed.map((s) => s.error || 'unknown'))];
    console.log(
      `\n${failed.length} of ${samples.length} generations failed, ${distinct.length} distinct causes:`,
    );
    for (const reason of distinct.slice(0, 5)) console.log(`  ${reason.slice(0, 160)}`);
  }

  compareToBaseline(samples);

  writeReport(samples, {
    at: new Date().toISOString(),
    endpoint: cassette() ? `cassette:${process.env.EVAL_CASSETTE}` : BASE_URL,
    model: cassette() ? 'cassette' : MODEL,
    modes,
    cases: cases.length,
    repeats: REPEATS,
    concurrency: CONCURRENCY,
  });

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
