import { AiRequest } from '@/lib/ai/types';
import { ContextItem, Paragraph, lettersToText, resumeSummary } from '@/lib/coverLetter';
import { EvidenceMap } from '@/lib/coverLetterPlan';
import { Critique } from '@/lib/coverLetterCritic';
import { GateResult } from '@/lib/coverLetterGate';
import { ResumeData } from '@/types/resume';
import { generateLetterV2 } from './v2pipeline';

export interface EvalCheckLog {
  stage: string;
  detail: string;
}

/** Signature compatible with useAi().run — the app's own AI plumbing. */
export type RunFn = (req: AiRequest, label?: string) => Promise<string | null>;

export interface EvalScenarioInput {
  id: string;
  label: string;
  resume: ResumeData;
  job: { id: string; label: string; text: string };
  style: { custom: string; english?: 'uk' | 'us' };
  rules: string;
  context: ContextItem[];
  appeals?: string;
  followUp?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  label: string;
  status: 'done' | 'error';
  error?: string;
  /** The v2 letter bundle. */
  requirements: string[];
  requirementsTooThin: boolean;
  plan: EvidenceMap | null;
  questions: string[];
  paragraphs: Paragraph[];
  letterText: string;
  notices: string[];
  critique: Critique | null;
  mustFixCount: number;
  repaired: boolean;
  gate: GateResult | null;
  adEcho: number;
  planCover: number | null;
  /** Stages as they ran, in order (requirements, plan, draft, critique, …). */
  stages: EvalCheckLog[];
  /** Deterministic framework checks + LLM judge, filled in by the lab. */
  deterministic: DeterministicResult | null;
  judge: JudgeVerdict | null;
  agreement: Agreement | null;
  /** Every raw AI answer, for offline debugging. */
  transcript: { label: string; request: AiRequest; answer: string | null }[];
  durationMs: number;
  aiCalls: number;
}

// Result types filled in after generation; imported loosely to avoid a cycle.
type DeterministicResult = import('./checks').DeterministicResult;
type JudgeVerdict = import('./judge').JudgeVerdict;
type Agreement = import('./judge').Agreement;

export interface RunnerOptions {
  /** Pause between AI calls, ms, to be gentle on free providers. */
  gapMs?: number;
  onProgress?: (message: string) => void;
  shouldStop?: () => boolean;
}

export class StopError extends Error {
  constructor() { super('Run stopped'); this.name = 'StopError'; }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run one scenario end to end and capture everything the lab page shows. */
export async function runScenario(
  scenario: EvalScenarioInput,
  run: RunFn,
  options: RunnerOptions = {},
): Promise<ScenarioResult> {
  const { gapMs = 400, onProgress, shouldStop } = options;
  const transcript: ScenarioResult['transcript'] = [];
  const stages: EvalCheckLog[] = [];
  const started = Date.now();

  const runner: RunFn = async (request, label) => {
    if (shouldStop?.()) throw new StopError();
    transcript.push({ label: label || '', request, answer: null });
    const index = transcript.length - 1;
    try {
      const answer = await run(request, label);
      transcript[index].answer = answer;
      return answer;
    } finally {
      await sleep(gapMs);
    }
  };

  const base = { ...emptyBundle() };
  try {
    onProgress?.(`${scenario.label}: generating`);
    const result = await generateLetterV2(runner, {
      resume: resumeSummary(scenario.resume),
      job: scenario.job.text,
      style: scenario.style,
      rules: scenario.rules,
      context: scenario.context,
      appeals: scenario.appeals,
      followUp: scenario.followUp,
    }, stages, gapMs);

    onProgress?.(`${scenario.label}: deterministic checks`);
    const deterministic = (await import('./checks')).runDeterministicChecks({
      letterText: result.letterText,
      jobAd: scenario.job.text,
      resumeText: resumeSummary(scenario.resume),
      candidateName: scenario.resume.basics.name || '',
      rules: scenario.rules,
      style: scenario.style,
      gate: result.gate,
      letters: result.paragraphs.map((p) => p.text),
      notices: result.notices,
      questions: result.questions,
    });

    onProgress?.(`${scenario.label}: LLM judge`);
    const judge = await (await import('./judge')).judgeLetter(runner, result.ctx, result.letterText, result.requirements);

    return {
      scenarioId: scenario.id,
      label: scenario.label,
      status: 'done',
      ...result,
      stages,
      deterministic,
      judge,
      agreement: (await import('./judge')).checkerAgreement(result.gate, result.paragraphs, judge),
      transcript,
      durationMs: Date.now() - started,
      aiCalls: transcript.length,
    };
  } catch (error) {
    if ((error as Error)?.name === 'StopError') throw error;
    return {
      scenarioId: scenario.id,
      label: scenario.label,
      status: 'error',
      error: (error as Error)?.message || String(error),
      ...base,
      stages,
      deterministic: null,
      judge: null,
      agreement: null,
      transcript,
      durationMs: Date.now() - started,
      aiCalls: transcript.length,
    };
  }
}

function emptyBundle() {
  return {
    ctx: null as any,
    requirements: [],
    requirementsTooThin: false,
    plan: null,
    questions: [],
    paragraphs: [],
    letterText: '',
    notices: [],
    critique: null,
    mustFixCount: 0,
    repaired: false,
    gate: null,
    adEcho: 0,
    planCover: null,
  };
}
