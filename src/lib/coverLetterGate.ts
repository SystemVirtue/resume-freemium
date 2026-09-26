import { Flag, FlagDecisions, FlagKind, Paragraph, buildFlags, letterWordCount } from '@/lib/coverLetter';
import {
  Critique,
  FailureCode,
  FAILURE_LABELS,
  findingSignature,
  hasBlockingFindings,
  isBlockingCode,
  mustFixFindings,
} from '@/lib/coverLetterCritic';

/**
 * The quality gate.
 *
 * Everything before this stage produces material: a plan, a draft, a review, a
 * set of validation flags, code-side checks. None of those ever decided whether
 * the letter was finished — a letter was simply done when the user stopped
 * editing it. This module is the decision, and it is made in code rather than by
 * asking a model how it feels about its own work.
 *
 * Four verdicts, no scores. A number tells nobody what to fix, and a model's
 * opinion of its own prose is the least reliable input in the whole pipeline.
 *
 * The gate is deliberately conservative: it can say "not yet", it can name what
 * stands in the way, and it can never claim a letter is good. Only silence from
 * every check earns "ready to send".
 */

export type GateVerdict = 'pass' | 'minor' | 'needs-input' | 'regenerate';

export interface GateMeta {
  label: string;
  detail: string;
  /** How the card is painted: green, amber, blue, red. */
  tone: 'good' | 'warning' | 'primary' | 'danger';
}

export const GATE_META: Record<GateVerdict, GateMeta> = {
  pass: {
    label: 'Ready to send',
    detail: 'Nothing is outstanding: every check has passed, or raised something you have already seen to.',
    tone: 'good',
  },
  minor: {
    label: 'Worth a small edit',
    detail: 'Nothing is unsupported. These are worth fixing before you send it.',
    tone: 'warning',
  },
  'needs-input': {
    label: 'Your input needed',
    detail: 'A fact only you can supply would materially improve this letter.',
    tone: 'primary',
  },
  regenerate: {
    label: 'Needs another pass',
    detail: 'Something has to change before this letter can be called finished.',
    tone: 'danger',
  },
};

/**
 * Which failure category each validator flag belongs to. The validator already
 * found the problem; this only files it under a name the gate and the corpus can
 * count.
 */
export const FLAG_FAILURE_CODES: Record<FlagKind, FailureCode> = {
  unsupported: 'UNSUPPORTED_CLAIM',
  misattributed: 'MISATTRIBUTED_FACT',
  echo: 'AD_ECHO',
  rule: 'RULE_BREACH',
  scope: 'OVERCLAIMING',
  employer: 'EMPLOYER_DESCRIPTION',
  pivot: 'FORMULAIC_STRUCTURE',
  unresolved: 'UNRESOLVED_ENDING',
  needsInput: 'MISSING_INFORMATION',
  repetition: 'REPETITION',
  gapStatement: 'GAP_STATEMENT',
};

/**
 * Kinds that are reported and never held against the letter. Naming a requirement
 * in order to admit a gap is the honest alternative to implying cover for it, so it
 * cannot be a reason to withhold a verdict.
 */
export const INFORMATIONAL_FLAG_KINDS: FlagKind[] = ['gapStatement'];

/** The same idea as INFORMATIONAL_FLAG_KINDS, for findings the reviewer raised. */
export const INFORMATIONAL_CODES: FailureCode[] = ['GAP_STATEMENT'];

/**
 * Flags that stop the letter being called final on their own. These are the two
 * that would embarrass the candidate in an interview: something not supported by
 * their background, and a real fact attached to the wrong employer. Everything
 * else the validator raises is editing the user can weigh up.
 */
export const BLOCKING_FLAGS: FlagKind[] = ['unsupported', 'misattributed'];

export interface TaxonomyReport {
  /** How many findings of each kind, flags and review together. */
  counts: Partial<Record<FailureCode, number>>;
  /** Undismissed flags, for the reasons list. */
  active: Flag[];
}

export interface GateInput {
  paragraphs: Paragraph[];
  decisions?: FlagDecisions;
  /** The most recent review of this exact letter, if one has been run. */
  critique?: Critique | null;
  /** Words in the letter; measured from the paragraphs when not given. */
  words?: number;
  minWords?: number;
  maxWords?: number;
  /** Questions put to the user that are still unanswered. */
  openQuestions?: string[];
  /**
   * Should-fix findings the user has read and set aside, by findingSignature.
   * They are still reported, but they no longer hold the letter back.
   */
  acknowledgedFindings?: string[];
  /** The background the letter was written from, for the duplication check. */
  resume?: string;
  /** 5-gram overlap with the resume above which the letter is reading as a copy. */
  resumeOverlapLimit?: number;
}

export interface GateResult {
  verdict: GateVerdict;
  label: string;
  detail: string;
  /** What stands in the way, in plain language. Empty only when the verdict is pass. */
  reasons: string[];
  /**
   * What the checks raised and the user has already dealt with. Reported so the
   * verdict can be trusted rather than merely obeyed, and never a reason to
   * withhold it: a second opinion that cannot be disagreed with is not one.
   */
  notes: string[];
  failures: Partial<Record<FailureCode, number>>;
  /** True only for the pass verdict: the letter has earned "finished". */
  ready: boolean;
}

const DEFAULT_MIN_WORDS = 250;
const DEFAULT_MAX_WORDS = 400;
/** Above this share of five-word runs shared with the resume, the letter is retelling it. */
const DEFAULT_RESUME_OVERLAP_LIMIT = 0.12;

const tokens = (s: string) => (s || '').toLowerCase().match(/[a-z']+/g) || [];

/**
 * Share of the letter's five-word runs that also appear in the other document.
 * Five is long enough that the overlap is wording rather than vocabulary: "I led
 * the redesign of the permit application" matching the resume means the sentence
 * was copied, not that both happen to use the word "application".
 */
export function ngramOverlap(letter: string, other: string, n = 5): number {
  const tail = tokens(other);
  if (tail.length < n) return 0;
  const others = new Set<string>();
  for (let i = 0; i + n <= tail.length; i++) others.add(tail.slice(i, i + n).join(' '));
  const head = tokens(letter);
  if (head.length < n) return 0;
  let hits = 0;
  let total = 0;
  for (let i = 0; i + n <= head.length; i++) {
    total++;
    if (others.has(head.slice(i, i + n).join(' '))) hits++;
  }
  return total ? hits / total : 0;
}

/** Count everything wrong with the letter, by category, flags and review together. */
export function failureTaxonomy(input: {
  paragraphs: Paragraph[];
  decisions?: FlagDecisions;
  critique?: Critique | null;
}): TaxonomyReport {
  const decisions = input.decisions || {};
  const active = input.paragraphs
    .flatMap((p) => buildFlags(p))
    .filter((f) => decisions[f.id] !== 'dismissed');
  const counts: Partial<Record<FailureCode, number>> = {};
  for (const flag of active) {
    const code = FLAG_FAILURE_CODES[flag.kind];
    counts[code] = (counts[code] || 0) + 1;
  }
  for (const finding of input.critique?.findings || []) {
    counts[finding.code] = (counts[finding.code] || 0) + 1;
  }
  return { counts, active };
}

const codeList = (codes: FailureCode[]) => codes.map((c) => FAILURE_LABELS[c]).join(', ');

/**
 * Review findings that are asking for a change. Informational codes are never among
 * them, however the reviewer labelled them: a named requirement with the gap admitted
 * has nothing to change, since the only thing that would change it is a fact the
 * candidate does not have. It is reported in the notes instead.
 */
const actionableFindings = (critique: Critique | null | undefined) =>
  mustFixFindings(critique || null).filter((f) => !INFORMATIONAL_CODES.includes(f.code));

/**
 * Decide where the letter stands. Order matters: a letter that needs another
 * pass needs one whatever else is outstanding, and a missing fact is only worth
 * asking about once the letter is otherwise sound.
 */
export function qualityGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  const paragraphs = input.paragraphs || [];
  const { counts, active } = failureTaxonomy({
    paragraphs,
    decisions: input.decisions,
    critique: input.critique,
  });
  const words = input.words ?? letterWordCount(paragraphs);
  const minWords = input.minWords ?? DEFAULT_MIN_WORDS;
  const maxWords = input.maxWords ?? DEFAULT_MAX_WORDS;
  const openQuestions = (input.openQuestions || []).map((q) => q.trim()).filter(Boolean);

  const notes: string[] = [];

  // Reported whichever way the verdict goes, because it is information rather than
  // a fault: the user should see it while deciding, not after being told off.
  const gapStatements = [
    ...active
      .filter((f) => INFORMATIONAL_FLAG_KINDS.includes(f.kind))
      .map((f) => f.fragment || f.detail),
    ...(input.critique?.findings || [])
      .filter((f) => INFORMATIONAL_CODES.includes(f.code))
      .map((f) => f.passage || f.problem),
  ].filter(Boolean);
  if (gapStatements.length) {
    notes.push(`Gap admitted rather than hidden: ${gapStatements.slice(0, 4).join('; ')}.`);
  }

  if (!paragraphs.length) {
    return {
      verdict: 'regenerate',
      ...GATE_META.regenerate,
      reasons: ['There is no letter to check yet.'],
      notes,
      failures: counts,
      ready: false,
    };
  }

  // 1. Anything the validator or the reviewer says cannot be defended.
  const blockingFlags = active.filter((f) => BLOCKING_FLAGS.includes(f.kind));
  const blockingCodes = blockingFlags.map((f) => FLAG_FAILURE_CODES[f.kind]);
  const blockingFindings = actionableFindings(input.critique);
  if (blockingFlags.length) {
    reasons.push(
      `The validator says some words are not supported by your background: ${blockingFlags
        .map((f) => `“${f.fragment || f.detail}”`)
        .join(', ')}.`,
    );
  }
  if (blockingFindings.length) {
    reasons.push(`The review says: ${codeList(blockingFindings.map((f) => f.code))}.`);
  }
  if (blockingFlags.length || hasBlockingFindings(input.critique || null)) {
    return {
      verdict: 'regenerate',
      ...GATE_META.regenerate,
      reasons,
      notes,
      failures: counts,
      ready: false,
    };
  }

  // 2. A fact only the user has. The letter is honest without it, but limited.
  if (openQuestions.length) {
    return {
      verdict: 'needs-input',
      ...GATE_META['needs-input'],
      reasons: [...reasons, ...openQuestions.map((q) => `Only you can answer: ${q}`)],
      notes,
      failures: counts,
      ready: false,
    };
  }

  // 3. Everything else the validator and the reviewer raised: editing, not invention.
  //
  // A should-fix finding the user has read and set aside stops holding the letter
  // back: the verdict has to be able to improve as they work, and a reviewer that
  // cannot be disagreed with is not a second opinion. Nothing unsupported can be
  // waved through this way — the blocking categories were decided above from the
  // flags and the codes, before this point is reached.
  const otherFlags = active.filter(
    (f) => !BLOCKING_FLAGS.includes(f.kind) && !INFORMATIONAL_FLAG_KINDS.includes(f.kind),
  );
  if (otherFlags.length) {
    const codes = Array.from(new Set(otherFlags.map((f) => FLAG_FAILURE_CODES[f.kind])));
    reasons.push(`${codeList(codes)}: ${otherFlags.map((f) => f.fragment || f.detail).slice(0, 4).join('; ')}.`);
  }
  // A must-fix item with a non-blocking code is the reviewer's own severity call:
  // it is saying change this. Calling the letter ready while one stands would make
  // the label mean nothing, and it is the item the repair stage is told to apply
  // first. Only should-fix findings can be set aside — and a gap statement is never
  // one of these, however the reviewer labelled it, because there is nothing to
  // change: the honest sentence is the point.
  const mustFixOther = actionableFindings(input.critique).filter((f) => !isBlockingCode(f.code));
  if (mustFixOther.length) {
    reasons.push(
      `The review says these must be fixed: ${codeList(
        Array.from(new Set(mustFixOther.map((f) => f.code))),
      )}.`,
    );
  }

  const acknowledged = new Set(input.acknowledgedFindings || []);
  const otherFindings = (input.critique?.findings || []).filter(
    (f) => f.severity === 'should-fix' && !INFORMATIONAL_CODES.includes(f.code),
  );
  const outstanding = otherFindings.filter((f) => !acknowledged.has(findingSignature(f)));
  const settled = otherFindings.filter((f) => acknowledged.has(findingSignature(f)));
  if (outstanding.length) {
    reasons.push(
      `The review also suggests: ${codeList(Array.from(new Set(outstanding.map((f) => f.code))))}.`,
    );
  }
  if (settled.length) {
    notes.push(
      `You set aside: ${codeList(Array.from(new Set(settled.map((f) => f.code))))}.`,
    );
  }

  // 4. Length and shape, measured rather than felt.
  if (words < minWords) {
    reasons.push(`The letter is ${words} words: short enough that the case may not be made.`);
  }
  if (words > maxWords) {
    reasons.push(`The letter is ${words} words, over the ${maxWords}-word limit.`);
  }
  // Greeting and closing lines are short by design; the body carries the argument.
  const body = paragraphs.filter((p) => p.text.trim().length >= 60);
  if (body.length < 2) {
    reasons.push('There is only one body paragraph; a letter usually makes its case in two or three.');
  } else if (body.length > 5) {
    reasons.push(`${body.length} substantial paragraphs is more than a reader will take in.`);
  }

  // 5. Reading as a copy of the resume. A signal, not a rule: some overlap is expected.
  if (input.resume && input.resume.trim()) {
    const overlap = ngramOverlap(
      paragraphs.map((p) => p.text).join(' '),
      input.resume,
      5,
    );
    if (overlap > (input.resumeOverlapLimit ?? DEFAULT_RESUME_OVERLAP_LIMIT)) {
      reasons.push(
        `${Math.round(overlap * 100)}% of the letter's wording also appears in your resume. Say less about what the resume already says.`,
      );
    }
  }

  if (reasons.length) {
    return { verdict: 'minor', ...GATE_META.minor, reasons, notes, failures: counts, ready: false };
  }

  return { verdict: 'pass', ...GATE_META.pass, reasons: [], notes, failures: counts, ready: true };
}

/** One line naming the categories the gate counted, for the eval harness and the UI. */
export function failureLine(counts: Partial<Record<FailureCode, number>>): string {
  const entries = Object.entries(counts).filter(([, n]) => n);
  if (!entries.length) return 'none';
  return entries.map(([code, n]) => `${code}×${n}`).join(' ');
}
