import { RunFn, EvalCheckLog } from './runner';
import {
  Ctx, Paragraph, LETTER_SYSTEM, REQUIREMENTS_SYSTEM, GROUNDING_SYSTEM,
  contextBlock, draftPrompt, requirementsPrompt, groundingPrompt,
  flagRepetition, normaliseModelText, promptWithInstruction,
} from '@/lib/coverLetter';
import {
  PLAN_SYSTEM, EvidenceMap, evidenceMapBlock, mapQuestions, parseEvidenceMap, planPrompt,
} from '@/lib/coverLetterPlan';
import {
  CRITIC_SYSTEM, Critique, critiqueInstructions, critiquePrompt, parseCritique,
} from '@/lib/coverLetterCritic';
import { qualityGate, GateResult, ngramOverlap } from '@/lib/coverLetterGate';
import { parseJsonAnswer } from '@/lib/ai/client';

/** Split a letter into normalised paragraphs, as every v2 stage expects. */
export const split = (text: string): string[] =>
  normaliseModelText(text).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);

/** Build a Paragraph from a grounding result, matching the app's own shaping. */
export const buildParagraph = (text: string, index: number, flags?: any): Paragraph => {
  const g = flags || {};
  return {
    id: `p${index}`,
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
    ruleFlags: g.rules,
    repetition: flagRepetition(text),
  };
};

export interface V2GenerateInput {
  resume: string;
  job: string;
  style: Ctx['style'];
  rules: string;
  context: Ctx['context'];
  appeals?: string;
  followUp?: string;
}

export interface V2LetterResult {
  ctx: Ctx;
  requirements: string[];
  requirementsTooThin: boolean;
  plan: EvidenceMap | null;
  questions: string[];
  /** Final validated paragraphs (the letter the user would see). */
  paragraphs: Paragraph[];
  letterText: string;
  notices: string[];
  critique: Critique | null;
  mustFixCount: number;
  repaired: boolean;
  gate: GateResult | null;
  adEcho: number;
  planCover: number | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The full v2 flow, staged exactly as the app and scripts/eval-corpus.ts run it:
 * requirements, evidence plan, draft, independent review, repair of what blocks
 * the review, validation of every claim, then the quality gate.
 */
export async function generateLetterV2(
  run: RunFn,
  input: V2GenerateInput,
  log: EvalCheckLog[] = [],
  gapMs = 400,
): Promise<V2LetterResult> {
  const call = async <T,>(stage: string, system: string, prompt: string, parse: (raw: string) => T): Promise<T | null> => {
    const raw = await run({ prompt, system, json: true }, stage);
    log.push({ stage, detail: raw ? `${raw.length} chars` : 'no answer' });
    await sleep(gapMs);
    return raw ? parse(raw) : null;
  };

  const ctx: Ctx = {
    resume: input.resume,
    job: input.job,
    context: input.context,
    style: input.style,
    rules: input.rules,
    requirements: [],
    appeals: input.appeals,
  };
  const plainContext = contextBlock(ctx);

  // 1. Requirements from the ad (supports tooThin).
  const reqParsed = await call('requirements', REQUIREMENTS_SYSTEM, requirementsPrompt(ctx),
    (raw) => parseJsonAnswer<{ requirements?: string[]; tooThin?: boolean }>(raw));
  const requirements = Array.isArray(reqParsed?.requirements) ? reqParsed!.requirements.map(String) : [];
  const requirementsTooThin = Boolean(reqParsed?.tooThin);
  ctx.requirements = requirements;
  log.push({ stage: 'requirements', detail: requirementsTooThin ? 'too thin' : `${requirements.length} requirements` });

  // 2. Evidence plan: what the employer needs against what the candidate has.
  const planRaw = await call('plan', PLAN_SYSTEM, planPrompt({ context: plainContext, requirements }),
    (raw) => parseEvidenceMap(parseJsonAnswer<any>(raw), requirements));
  if (planRaw) ctx.plan = planRaw;
  const questions = planRaw ? mapQuestions(planRaw) : [];
  ctx.openQuestions = questions;
  log.push({ stage: 'plan', detail: planRaw ? `${planRaw.entries.length} entries` : 'no plan' });

  // 3. Draft against the plan.
  const draftParsed = await call('draft', LETTER_SYSTEM, draftPrompt(ctx),
    (raw) => parseJsonAnswer<{ paragraphs?: string[]; notices?: string[] }>(raw));
  let letter = (draftParsed?.paragraphs?.length ? draftParsed.paragraphs.join('\n\n') : '').trim();
  if (!letter) throw new Error('Draft returned no paragraphs');
  const notices: string[] = (draftParsed?.notices || []).map(String);

  // 4. Independent review of the draft.
  const critiqueOnce = async (): Promise<Critique | null> => {
    const parsed = await call('critique', CRITIC_SYSTEM, critiquePrompt({
      context: plainContext, letter, planBlock: planRaw ? evidenceMapBlock(planRaw) : '',
    }), (raw) => parseCritique(parseJsonAnswer<any>(raw)));
    return parsed;
  };
  let critique = await critiqueOnce();
  const mustFix = critiqueInstructions(critique, 'must-fix');
  log.push({ stage: 'critique', detail: `${mustFix.length} must-fix findings` });

  // 5. Repair what blocks the review, then review the revision as the app does.
  if (mustFix.length) {
    const repairParsed = await call('repair', LETTER_SYSTEM, promptWithInstruction(
      ctx, letter, 'Fix the problems the review raised, without undoing what it said works.',
      [], [], mustFix, [],
    ), (raw) => parseJsonAnswer<{ paragraphs?: string[]; notices?: string[] }>(raw));
    const next = (repairParsed?.paragraphs?.length ? repairParsed.paragraphs.join('\n\n') : '').trim();
    if (next) {
      letter = next;
      notices.push(...(repairParsed?.notices || []).map(String));
      critique = (await critiqueOnce()) ?? critique;
    }
  }

  // 6. Optional follow-up user instruction (the revision path).
  if (input.followUp) {
    const revisionParsed = await call('revision', LETTER_SYSTEM, promptWithInstruction(
      ctx, letter, input.followUp, [], [], [], [],
    ), (raw) => parseJsonAnswer<{ paragraphs?: string[]; notices?: string[]; wouldTouch?: string[] }>(raw));
    const next = (revisionParsed?.paragraphs?.length ? revisionParsed.paragraphs.join('\n\n') : '').trim();
    if (next) {
      letter = next;
      notices.push(...(revisionParsed?.notices || []).map(String));
      critique = (await critiqueOnce()) ?? critique;
    }
  }

  // 7. Validate every claim against the background.
  const parts = split(letter);
  const groundRaw = await run({ prompt: groundingPrompt(ctx, parts), system: GROUNDING_SYSTEM, json: true }, 'validate');
  log.push({ stage: 'validate', detail: groundRaw ? `${parts.length} paragraphs checked` : 'no answer' });
  await sleep(gapMs);
  const groundParsed = groundRaw ? parseJsonAnswer<{ paragraphs?: any[] }>(groundRaw) : null;
  const paragraphs = parts.map((text, index) => buildParagraph(text, index, groundParsed?.paragraphs?.[index]));

  // 8. Gate.
  const gate = qualityGate({
    paragraphs,
    critique,
    openQuestions: questions,
    resume: input.resume,
    minWords: 250,
    maxWords: 400,
  });

  const traced = paragraphs.flatMap((paragraph) => (paragraph.sources || []).filter((s) => s.claim || s.source));
  const { planCoverage } = await import('./planCoverage');

  return {
    ctx,
    requirements,
    requirementsTooThin,
    plan: planRaw,
    questions,
    paragraphs,
    letterText: paragraphs.map((paragraph) => paragraph.text).join('\n\n'),
    notices,
    critique,
    mustFixCount: mustFix.length,
    repaired: mustFix.length > 0,
    gate,
    adEcho: ngramOverlap(letter, input.job, 5),
    planCover: planCoverage(planRaw, traced),
  };
}
