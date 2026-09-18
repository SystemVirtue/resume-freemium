import { ResumeData } from '@/types/resume';

export type ContextRole = 'style_only' | 'research' | 'background';

export interface Paragraph {
  id: string;
  text: string;
  locked: boolean;
  /** Resume lines/entries the claims in this paragraph rest on. */
  sources?: string[];
  /** Sentences the assistant could not ground in the candidate material. */
  unsupported?: string[];
  /** Phrases lifted from the job ad. */
  echoes?: string[];
}

export interface ContextItem {
  id: string;
  label: string;
  text: string;
  role: ContextRole;
}

export interface StyleSettings {
  chips: string[];
  custom: string;
  /** Things the user will not claim or mention, one per entry. */
  constraints?: string[];
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const CONTEXT_ROLES: { id: ContextRole; label: string; hint: string }[] = [
  {
    id: 'style_only',
    label: 'My past cover letters — style only',
    hint: 'Used for how you write, never for what you claim.',
  },
  {
    id: 'research',
    label: 'Company or role research',
    hint: 'Facts about the employer, never about you.',
  },
  {
    id: 'background',
    label: 'My own extra background',
    hint: 'Treated like your resume: a valid source of claims about you.',
  },
];

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
  'You are an expert cover letter writer working under strict evidence rules.',
  'Write in first person as the candidate, plainly and specifically, with no clichés or filler.',
  '',
  'EVIDENCE RULES (absolute):',
  '1. The only sources of claims about the candidate are the CANDIDATE RESUME and any section marked "EXTRA BACKGROUND". Nothing else.',
  '2. Never take facts, dates, numbers, achievements or skills from a PAST COVER LETTER section. Those are examples of the candidate\'s voice only.',
  '3. Never move, merge, split or re-attribute a fact between employers, roles or periods. A responsibility or achievement stays with the exact employer the source attaches it to. If a source sentence groups two employers together, do not separate them and do not attach the group\'s detail to one of them.',
  '4. Never state a duration, total, count or number (such as years of experience) unless that exact number appears in the resume or extra background.',
  '5. Never turn a requirement or responsibility from the job ad into a claim about the candidate. If the resume does not support it, leave it out entirely rather than hedging.',
  '6. Never invent a skill by combining a word from the resume with a word from the ad.',
  '7. Do not reuse the job ad\'s wording. Answer its requirements in the candidate\'s own words, using the candidate\'s own evidence.',
  '',
  'Return only what is asked for, with no preamble, labels or markdown.',
].join('\n');

interface Ctx {
  resume: string;
  job: string;
  context: ContextItem[];
  style: StyleSettings;
}

const ROLE_HEADINGS: Record<ContextRole, string> = {
  style_only: 'PAST COVER LETTERS (VOICE AND PHRASING ONLY — NOT A SOURCE OF FACTS)',
  research: 'COMPANY / ROLE RESEARCH (FACTS ABOUT THE EMPLOYER ONLY)',
  background: 'EXTRA BACKGROUND ABOUT THE CANDIDATE (VALID SOURCE OF CLAIMS)',
};

function roleSection(items: ContextItem[], role: ContextRole): string {
  const list = items.filter((c) => c.role === role && c.text.trim());
  if (!list.length) return '';
  const body = list.map((c) => `[${c.label}]\n${c.text.slice(0, 4000)}`).join('\n\n');
  return `<<< ${ROLE_HEADINGS[role]} >>>\n${body}\n<<< END >>>`;
}

export function constraintsBlock(style: StyleSettings): string {
  const list = (style.constraints || []).map((c) => c.trim()).filter(Boolean);
  if (!list.length) return '';
  return `MUST NOT CLAIM OR MENTION (absolute, applies to every sentence):\n${list
    .map((c) => `- ${c}`)
    .join('\n')}`;
}

function contextBlock(ctx: Ctx): string {
  const style = [ctx.style.chips.join(', '), ctx.style.custom].filter(Boolean).join('. ');
  return [
    `<<< CANDIDATE RESUME (PRIMARY SOURCE OF CLAIMS) >>>\n${ctx.resume}\n<<< END >>>`,
    `<<< JOB ADVERTISEMENT (WHAT THEY WANT — NOT EVIDENCE ABOUT THE CANDIDATE) >>>\n${ctx.job.slice(
      0,
      8000,
    )}\n<<< END >>>`,
    roleSection(ctx.context, 'background'),
    roleSection(ctx.context, 'research'),
    roleSection(ctx.context, 'style_only'),
    style && `REQUESTED TONE AND STYLE: ${style}`,
    constraintsBlock(ctx.style),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function stylePrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

Suggest 6 short tone/style options (one to two words each, e.g. "formal", "warm", "technical") that suit this candidate and this role. Answer as JSON: {"styles":["..."]}`;
}

/** Requirements in the ad that the candidate material does not support, offered as "don't claim" chips. */
export function constraintSuggestionPrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

List up to 8 specific capabilities, tools or claims the job advertisement asks for that the candidate material does NOT clearly support. Use short phrases in the candidate's terms. Do not include anything the resume supports. Answer as JSON: {"items":["..."]}`;
}

export function draftPrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

Write a complete cover letter of 4 to 5 paragraphs. No greeting, no sign-off, no addresses — body paragraphs only. Every claim must trace to a specific line of the resume or extra background; leave out anything you cannot trace. Answer as JSON: {"paragraphs":["...","..."]}`;
}

export function editPrompt(
  ctx: Ctx,
  mode: 'rephrase' | 'regenerate',
  paragraph: string,
  letter: string,
): string {
  const instruction =
    mode === 'rephrase'
      ? 'Rewrite the target paragraph in different words, keeping its meaning, facts, attributions and sentiment exactly.'
      : 'Replace the target paragraph with a fresh one, drawing only on the resume and extra background. You may change its angle, as long as it strengthens the letter and does not repeat the other paragraphs.';
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

TARGET PARAGRAPH:\n${paragraph}

${instruction} Return the new paragraph as plain text only.`;
}

export function insertPrompt(ctx: Ctx, letter: string, position: number): string {
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

Write one new paragraph to be inserted as paragraph ${position + 1} of the letter. It must add something the letter does not already say, and every claim in it must trace to the resume or extra background. Return the paragraph as plain text only.`;
}

export function promptWithInstruction(ctx: Ctx, letter: string, instruction: string, locked: string[]): string {
  return `${contextBlock(ctx)}

CURRENT LETTER:\n${letter}

${locked.length ? `These paragraphs are locked and must be returned unchanged, word for word:\n${locked.join('\n---\n')}\n` : ''}
USER INSTRUCTION: ${instruction}

Apply the instruction and return the full revised letter. Answer as JSON: {"paragraphs":["...","..."]}`;
}

/** Trace every paragraph back to the resume, and flag what cannot be traced. */
export function groundingPrompt(ctx: Ctx, paragraphs: string[]): string {
  return `<<< CANDIDATE RESUME AND EXTRA BACKGROUND >>>\n${ctx.resume}\n${ctx.context
    .filter((c) => c.role === 'background' && c.text.trim())
    .map((c) => c.text.slice(0, 3000))
    .join('\n')}\n<<< END >>>

<<< JOB ADVERTISEMENT >>>\n${ctx.job.slice(0, 6000)}\n<<< END >>>

${constraintsBlock(ctx.style)}

LETTER PARAGRAPHS:
${paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}

For each paragraph, in order, report:
- "sources": the short resume/background lines each claim rests on (quote 3-8 words each). Empty if the paragraph makes no claims.
- "unsupported": any sentence making a claim that the candidate material does not support, or that attributes something to the wrong employer or period. Quote the sentence.
- "echoes": any phrase of four or more words taken from the job advertisement.

Answer as JSON: {"paragraphs":[{"sources":["..."],"unsupported":["..."],"echoes":["..."]}]}`;
}

export function reviewPrompt(ctx: Ctx, letter: string): string {
  return `${contextBlock(ctx)}

LETTER:\n${letter}

Check this letter and report in this exact order, using short headings and bullets:
1. Statements not supported by the candidate material.
2. Facts attached to the wrong employer, role or period.
3. Phrases that echo the job advertisement's wording.
4. Anything breaching the "must not claim or mention" list.
Then one short paragraph (max 80 words) on what works and the single most useful change. No score or rating. Plain text.`;
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
