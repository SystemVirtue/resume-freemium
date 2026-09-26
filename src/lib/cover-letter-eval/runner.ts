import { AiRequest } from '@/lib/ai/types';
import {
  Ctx, Paragraph, CHECK_SYSTEM, SYSTEM, newId, resumeSummary, requirementsPrompt, draftPrompt, promptWithInstruction,
} from '@/lib/coverLetter';
import { parseJsonAnswer } from '@/lib/ai/client';
import { createPipeline, emptyGrounding } from './pipeline';
import { runDeterministicChecks, DeterministicResult } from './checks';
import { judgeLetter, JudgeVerdict, checkerAgreement, Agreement } from './judge';

export interface ScenarioResult {
  scenarioId: string;
  label: string;
  status: 'done' | 'error';
  error?: string;
  requirements: string[];
  requirementsTooThin: boolean;
  /** final paragraphs after repair (the letter the user would see) */
  paragraphs: Paragraph[];
  /** paragraphs after the first ground, before repair (for convergence checks) */
  beforeRepair: Paragraph[];
  notices: string[];
  deterministic: DeterministicResult | null;
  judge: JudgeVerdict | null;
  agreement: Agreement | null;
  letterText: string;
  /** every raw AI answer, for offline debugging */
  transcript: { label: string; request: AiRequest; answer: string | null }[];
  durationMs: number;
  aiCalls: number;
}

export interface RunnerOptions {
  /** pause between AI calls, ms, to be gentle on free providers */
  gapMs?: number;
  onProgress?: (message: string) => void;
  shouldStop?: () => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runScenario(
  scenario: EvalScenarioInput,
  run: RunFnAdapter,
  options: RunnerOptions = {},
): Promise<ScenarioResult> {
  const { gapMs = 400, onProgress, shouldStop } = options;
  const transcript: ScenarioResult['transcript'] = [];
  const started = Date.now();

  const runner: RunFnAdapter = async (request, label) => {
    if (shouldStop?.()) throw new StopError();
    transcript.push({ label, request, answer: null });
    const index = transcript.length - 1;
    try {
      const answer = await run(request, label);
      transcript[index].answer = answer;
      return answer;
    } finally {
      await sleep(gapMs);
    }
  };

  const ctx: Ctx = {
    resume: resumeSummary(scenario.resume),
    job: scenario.job.text,
    context: scenario.context,
    style: scenario.style,
    rules: scenario.rules,
    requirements: [],
  };

  try {
    // 1. Requirements from the ad (CHECK_SYSTEM path, tooThin supported)
    onProgress?.(`${scenario.label}: reading the ad`);
    let requirements: string[] = [];
    let requirementsTooThin = false;
    const reqAnswer = await runner({ prompt: requirementsPrompt(ctx), system: CHECK_SYSTEM, json: true }, 'reading the ad');
    const reqParsed = reqAnswer ? parseJsonAnswer<{ requirements?: string[]; tooThin?: boolean }>(reqAnswer) : null;
    if (reqParsed?.tooThin) requirementsTooThin = true;
    else if (Array.isArray(reqParsed?.requirements) && reqParsed.requirements.length) requirements = reqParsed.requirements.map(String);
    ctx.requirements = requirements;

    // 2. Draft
    onProgress?.(`${scenario.label}: drafting`);
    const draftAnswer = await runner({ prompt: draftPrompt(ctx), system: SYSTEM, json: true }, 'draft');
    const draftParsed = draftAnswer ? parseJsonAnswer<{ paragraphs?: string[]; notices?: string[] }>(draftAnswer) : null;
    const list = draftParsed?.paragraphs?.length
      ? draftParsed.paragraphs
      : (draftAnswer || '').split(/\n{2,}/).filter(Boolean);
    if (!list.length) throw new Error('Draft returned no paragraphs');
    const base: Paragraph[] = list.map((item) => ({ id: newId(), text: String(item).trim(), locked: false }));

    // 3. Ground + bounded repair (the real pipeline)
    onProgress?.(`${scenario.label}: grounding and repair`);
    const pipeline = createPipeline(runner, ctx);
    const beforeRepair = await pipeline.ground(base, true);
    const paragraphs = await pipeline.repair(beforeRepair);

    // 4. Optional follow-up instruction (revision path with stable IDs)
    let finalParagraphs = paragraphs;
    let notices: string[] = [
      ...(draftParsed?.notices || []).map(String),
    ];
    if (scenario.followUp) {
      onProgress?.(`${scenario.label}: applying change "${scenario.followUp}"`);
      const locked: string[] = [];
      const revisionAnswer = await runner({
        prompt: promptWithInstruction(ctx, paragraphs.map((paragraph) => `[${paragraph.id}] ${paragraph.text}`).join('\n\n'), scenario.followUp, locked, []),
        system: SYSTEM, json: true,
      }, 'revising');
      const revisionParsed = revisionAnswer ? parseJsonAnswer<{ paragraphs?: { id?: string; text?: string }[]; notices?: string[] }>(revisionAnswer) : null;
      if (Array.isArray(revisionParsed?.paragraphs)) {
        const previousById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
        const revised: Paragraph[] = [];
        for (const item of revisionParsed!.paragraphs) {
          const previous = item.id ? previousById.get(item.id) : undefined;
          if (!item.text?.trim()) continue;
          if (previous?.locked) { revised.push(previous); continue; }
          revised.push({
            id: previous?.id || item.id || newId(),
            text: String(item.text).trim(),
            locked: false,
            ...(previous ? { dismissedFlags: previous.dismissedFlags } : {}),
            ...emptyGrounding(),
          } as Paragraph);
        }
        for (const previous of paragraphs.filter((paragraph) => paragraph.locked)) {
          if (!revised.some((paragraph) => paragraph.id === previous.id)) revised.push(previous);
        }
        const revisedIds = new Set(revised.map((paragraph) => paragraph.id));
        finalParagraphs = await pipeline.repair(revised, revisedIds);
        notices = [...notices, ...(revisionParsed?.notices || []).map(String)];
      }
    }

    // 5. Evaluate
    onProgress?.(`${scenario.label}: deterministic checks`);
    const deterministic = runDeterministicChecks(finalParagraphs, scenario, scenario.job.text, scenario.resume.basics.name || '', {
      notices, beforeRepair,
    });
    onProgress?.(`${scenario.label}: LLM judge`);
    const judge = await judgeLetter(runner, ctx, finalParagraphs, requirements);

    return {
      scenarioId: scenario.id, label: scenario.label, status: 'done',
      requirements, requirementsTooThin,
      paragraphs: finalParagraphs, beforeRepair, notices,
      deterministic, judge,
      agreement: checkerAgreement(finalParagraphs, judge),
      letterText: finalParagraphs.map((paragraph) => paragraph.text).join('\n\n'),
      transcript, durationMs: Date.now() - started, aiCalls: transcript.length,
    };
  } catch (error) {
    if ((error as Error)?.name === 'StopError') throw error;
    return {
      scenarioId: scenario.id, label: scenario.label, status: 'error',
      error: (error as Error)?.message || String(error),
      requirements: [], requirementsTooThin: false,
      paragraphs: [], beforeRepair: [], notices: [],
      deterministic: null, judge: null, agreement: null, letterText: '',
      transcript, durationMs: Date.now() - started, aiCalls: transcript.length,
    };
  }
}

export class StopError extends Error {
  constructor() { super('Run stopped'); this.name = 'StopError'; }
}

// Small local aliases so the runner has no hard dependency on fixture types.
type RunFnAdapter = (req: AiRequest, label?: string) => Promise<string | null>;
interface EvalScenarioInput {
  id: string; label: string; resume: import('@/types/resume').ResumeData; job: { id: string; label: string; text: string };
  style: Ctx['style']; rules: string; context: Ctx['context']; followUp?: string;
}
