import { ResumeData } from '@/types/resume';

export interface Paragraph {
  id: string;
  text: string;
  locked: boolean;
}

export interface ContextItem {
  id: string;
  label: string;
  text: string;
}

export interface StyleSettings {
  chips: string[];
  custom: string;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

/** True when the resume has enough content to write a cover letter from. */
export function isResumeComplete(resume?: ResumeData | null): boolean {
  if (!resume) return false;
  const b = resume.basics;
  const hasName = Boolean(b?.name?.trim());
  const hasContact = Boolean(b?.email?.trim() || b?.phone?.trim());
  const hasHistory = (resume.work?.length || 0) > 0 || (resume.education?.length || 0) > 0;
  return hasName && hasContact && hasHistory;
}

/** Compact plain-text view of the resume, small enough to send with every request. */
export function resumeSummary(resume: ResumeData): string {
  const b = resume.basics;
  const lines: string[] = [
    `Name: ${b.name}`,
    b.email && `Email: ${b.email}`,
    b.phone && `Phone: ${b.phone}`,
    b.location?.city && `Location: ${[b.location.city, b.location.state, b.location.country].filter(Boolean).join(', ')}`,
    b.summary && `Summary: ${b.summary}`,
  ].filter(Boolean) as string[];

  if (resume.work?.length) {
    lines.push('Experience:');
    resume.work.slice(0, 6).forEach((w) => {
      lines.push(
        `- ${w.position} at ${w.company} (${w.startDate || '?'}–${w.isCurrentRole ? 'present' : w.endDate || '?'}): ${
          w.summary || ''
        } ${(w.highlights || []).slice(0, 3).join('; ')}`.trim(),
      );
    });
  }
  if (resume.education?.length) {
    lines.push('Education:');
    resume.education.slice(0, 4).forEach((e) => {
      lines.push(`- ${e.studyType} ${e.area} at ${e.institution} (${e.endDate || e.startDate || ''})`.trim());
    });
  }
  if (resume.skills?.length) {
    lines.push(`Skills: ${resume.skills.map((s) => s.name).slice(0, 20).join(', ')}`);
  }
  if (resume.certifications?.length) {
    lines.push(`Certifications: ${resume.certifications.map((c) => c.name).join(', ')}`);
  }
  return lines.join('\n').slice(0, 6000);
}

export const SYSTEM = [
  'You are an expert cover letter writer.',
  'Write in first person as the candidate, plainly and specifically, with no clichés or filler.',
  'Never invent facts that are not supported by the candidate material.',
  'Return only what is asked for, with no preamble, labels or markdown.',
].join(' ');

interface Ctx {
  resume: string;
  job: string;
  context: ContextItem[];
  style: StyleSettings;
}

function contextBlock(ctx: Ctx): string {
  const extra = ctx.context
    .filter((c) => c.text.trim())
    .map((c) => `--- ${c.label} ---\n${c.text.slice(0, 4000)}`)
    .join('\n\n');
  const style = [ctx.style.chips.join(', '), ctx.style.custom].filter(Boolean).join('. ');
  return [
    `CANDIDATE RESUME:\n${ctx.resume}`,
    `ROLE / JOB DESCRIPTION:\n${ctx.job.slice(0, 8000)}`,
    extra && `ADDITIONAL CONTEXT:\n${extra}`,
    style && `REQUESTED TONE AND STYLE: ${style}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function stylePrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

Suggest 6 short tone/style options (one to two words each, e.g. "formal", "warm", "technical") that suit this candidate and this role. Answer as JSON: {"styles":["..."]}`;
}

export function draftPrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

Write a complete cover letter of 4 to 5 paragraphs. No greeting, no sign-off, no addresses — body paragraphs only. Answer as JSON: {"paragraphs":["...","..."]}`;
}

export function editPrompt(
  ctx: Ctx,
  mode: 'rephrase' | 'regenerate',
  paragraph: string,
  letter: string,
): string {
  const instruction =
    mode === 'rephrase'
      ? 'Rewrite the target paragraph in different words, keeping its meaning, facts and sentiment exactly.'
      : 'Replace the target paragraph with a fresh one. You may change its content and angle, as long as it strengthens the letter and does not repeat the other paragraphs.';
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

TARGET PARAGRAPH:\n${paragraph}

${instruction} Return the new paragraph as plain text only.`;
}

export function insertPrompt(ctx: Ctx, letter: string, position: number): string {
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

Write one new paragraph to be inserted as paragraph ${position + 1} of the letter. It must add something the letter does not already say. Return the paragraph as plain text only.`;
}

export function promptWithInstruction(ctx: Ctx, letter: string, instruction: string, locked: string[]): string {
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

${locked.length ? `These paragraphs are locked and must be returned unchanged, word for word:\n${locked.join('\n---\n')}\n` : ''}
USER INSTRUCTION: ${instruction}

Apply the instruction and return the full revised letter. Answer as JSON: {"paragraphs":["...","..."]}`;
}

export function reviewPrompt(ctx: Ctx, letter: string): string {
  return `${contextBlock(ctx)}

LETTER:\n${letter}

Give a short assessment (max 150 words) of how well this letter serves this candidate for this role: what works, what is weak or missing, and the single most useful change. No score or rating. Plain text.`;
}

export function parseResumePrompt(text: string): string {
  return `Convert the resume below into JSON matching exactly this shape (use empty strings or empty arrays where information is missing, and never invent facts):

{"basics":{"name":"","email":"","phone":"","website":"","linkedin":"","summary":"","location":{"address":"","city":"","state":"","country":"","postalCode":""}},"work":[{"company":"","position":"","website":"","startDate":"","endDate":"","isCurrentRole":false,"summary":"","highlights":[""]}],"education":[{"institution":"","url":"","area":"","studyType":"","startDate":"","endDate":"","score":"","courses":[]}],"skills":[{"name":"","level":"","keywords":[]}],"projects":[],"volunteer":[],"awards":[],"certifications":[{"name":"","issuer":"","date":"","url":""}],"interests":[],"languages":[{"language":"","fluency":""}]}

RESUME:
${text.slice(0, 20000)}`;
}

export function lettersToText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => p.text.trim()).filter(Boolean).join('\n\n');
}
