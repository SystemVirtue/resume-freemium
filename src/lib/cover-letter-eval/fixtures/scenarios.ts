import { ContextItem, StyleSettings } from '@/lib/coverLetter';
import { EVAL_RESUMES, EvalResume } from './resumes';
import { EVAL_JOBS, EvalJob } from './jobs';

export interface EvalScenario {
  id: string;
  label: string;
  resumeId: string;
  jobId: string;
  style: StyleSettings;
  rules: string;
  context: ContextItem[];
  /** What the candidate says appeals about this role — the only motivation source. */
  appeals?: string;
  /** Ask-for-a-change instruction applied after the first draft, to exercise the revision path. */
  followUp?: string;
}

const ctxItem = (id: string, label: string, text: string, role: ContextItem['role']): ContextItem => ({ id, label, text, role });

const RESUME_BY_ID = new Map(EVAL_RESUMES.map((resume) => [resume.id, resume]));
const JOB_BY_ID = new Map(EVAL_JOBS.map((job) => [job.id, job]));

const plainStyle = (over: Partial<StyleSettings> = {}): StyleSettings => ({
  custom: '', english: 'uk', ...over,
});

const make = (scenario: Omit<EvalScenario, 'resumeId' | 'jobId'> & { resume: string; job: string }): EvalScenario => {
  const resume = RESUME_BY_ID.get(scenario.resume);
  const job = JOB_BY_ID.get(scenario.job);
  if (!resume || !job) throw new Error(`Unknown fixture in scenario ${scenario.id}`);
  return { ...scenario, resumeId: resume.id, jobId: job.id };
};

export const EVAL_SCENARIOS: EvalScenario[] = [
  make({
    id: 'sc-grad-admin',
    label: 'Graduate → admin role (entry path)',
    resume: 'res-graduate', job: 'job-grad-admin',
    style: plainStyle({ custom: 'warm' }),
    rules: '',
    context: [ctxItem('c1', 'Why Fernwell', 'I liked that the trust trains its admin staff into adviser roles.', 'style_only')],
  }),
  make({
    id: 'sc-mid-tech',
    label: 'Mid engineer → frontend (stretch case)',
    resume: 'res-mid-tech', job: 'job-frontend-terse',
    style: plainStyle({ english: 'us', custom: 'direct, technical' }),
    rules: 'No em dashes. Keep it under 300 words.',
    context: [ctxItem('c2', 'Why Larkspur', 'The design-system ownership is the part of the job I want next.', 'style_only')],
  }),
  make({
    id: 'sc-senior-content',
    label: 'Senior content → content lead (strong match)',
    resume: 'res-senior-marketing', job: 'job-content-lead',
    style: plainStyle({ custom: 'confident' }),
    rules: 'Never use the word "passionate".',
    context: [ctxItem('c3', 'Why Parcelly', 'Logistics is the sector I know best from Northbeam.', 'style_only')],
  }),
  make({
    id: 'sc-changer-ux',
    label: 'Career changer → UX researcher',
    resume: 'res-career-changer', job: 'job-ux-researcher',
    style: plainStyle({ english: 'us', custom: 'understated' }),
    rules: 'No em dashes. Do not mention my age or years of experience as a negative.',
    context: [ctxItem('c4', 'Why Grove', 'Checkout flow redesign is exactly what I did in store, now with research methods.', 'style_only')],
  }),
  make({
    id: 'sc-nurse-hse',
    label: 'Nurse manager → HSE ward (public sector)',
    resume: 'res-healthcare', job: 'job-nurse-ward',
    style: plainStyle(),
    rules: '',
    context: [],
  }),
  make({
    id: 'sc-electrician',
    label: 'Electrician → municipal role (US spelling source)',
    resume: 'res-trades', job: 'job-electrician',
    style: plainStyle({ english: 'us' }),
    rules: 'Short paragraphs. No curly quotes.',
    context: [],
  }),
  make({
    id: 'sc-injection',
    label: 'Adversarial ad (injection + forced opener)',
    resume: 'res-mid-tech', job: 'job-adversarial-injection',
    style: plainStyle({ english: 'us' }),
    rules: '',
    context: [],
  }),
  make({
    id: 'sc-thin-ad',
    label: 'Too-thin ad (requirements bail path)',
    resume: 'res-graduate', job: 'job-thin-ad',
    style: plainStyle(),
    rules: '',
    context: [],
  }),
  make({
    id: 'sc-echo-bait',
    label: 'Echo bait ad (corporate cliché phrases)',
    resume: 'res-senior-marketing', job: 'job-echo-bait',
    style: plainStyle(),
    rules: 'No cliches like "fast-paced environment" or "proven track record".',
    context: [],
  }),
  make({
    id: 'sc-us-spelling',
    label: 'US ad + UK-leaning resume (variant enforcement)',
    resume: 'res-graduate', job: 'job-us-spelling-test',
    style: plainStyle({ english: 'us' }),
    rules: 'Use American spelling throughout.',
    context: [],
  }),
  make({
    id: 'sc-variant-conflict',
    label: 'Rules vs selector mismatch (conflict flag path)',
    resume: 'res-healthcare', job: 'job-nurse-ward',
    style: plainStyle({ english: 'us' }),
    rules: 'Use British spelling, organise not organize. Two pages maximum is fine.',
    context: [],
  }),
  make({
    id: 'sc-ops-mismatch',
    label: 'Admin graduate → ops manager (deliberate mismatch)',
    resume: 'res-graduate', job: 'job-ops-corporate',
    style: plainStyle(),
    rules: 'No em dashes.',
    context: [],
  }),
  make({
    id: 'sc-support-au',
    label: 'Mid engineer → AU support lead (second mismatch)',
    resume: 'res-mid-tech', job: 'job-support-bullets',
    style: plainStyle({ english: 'uk', custom: 'warm' }),
    rules: '',
    context: [ctxItem('c5', 'Support interest', 'I mentored two graduates and enjoyed the teaching side of engineering.', 'background')],
  }),
  make({
    id: 'sc-revision-followup',
    label: 'Draft + revision follow-up (instruction path)',
    resume: 'res-senior-marketing', job: 'job-content-lead',
    style: plainStyle(),
    rules: 'No em dashes.',
    context: [],
    appeals: 'Parcelly is the logistics-tech space I know best and the benchmark-report craft is the work I most enjoy.',
    followUp: 'Lead the second paragraph with the benchmark report story, and keep it under 350 words.',
  }),
];

export const scenarioResume = (scenario: EvalScenario): EvalResume => RESUME_BY_ID.get(scenario.resumeId)!;
export const scenarioJob = (scenario: EvalScenario): EvalJob => JOB_BY_ID.get(scenario.jobId)!;
