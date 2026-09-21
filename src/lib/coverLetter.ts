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

export type EnglishVariant = 'uk' | 'us';

export interface StyleSettings {
  chips: string[];
  custom: string;
  /** Things the user will not claim or mention, one per entry. */
  constraints?: string[];
  /** Spelling/grammar variant held across every call and revision. */
  english?: EnglishVariant;
}

/** Persistent, verbatim rules the user wants followed on every letter. */
export interface LetterRules {
  text: string;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const ENGLISH_VARIANTS: { id: EnglishVariant; label: string; hint: string }[] = [
  { id: 'uk', label: 'UK / Australian English', hint: 'organise, colour, programme' },
  { id: 'us', label: 'US English', hint: 'organize, color, program' },
];

export const CONTEXT_ROLES: { id: ContextRole; label: string; hint: string }[] = [
  {
    id: 'style_only',
    label: 'My past cover letters — style only',
    hint: 'These are examples of how you write. Never used as a source of facts, dates, numbers or claims.',
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

export const RULES_STORAGE_KEY = 'cover-letter-rules';

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
  'You write cover letters. You are given a candidate\'s CV, a job advertisement, and a description of the voice to write in. Extra sources may be supplied, each marked with what it may be used for.',
  '',
  'THE JOB AD DECIDES THE STRUCTURE. The CV is evidence, not an outline. Before writing, identify the three or four things this specific role is asking for. Give each one a paragraph. Within a paragraph, use whatever from the candidate\'s background proves it, drawing on more than one employer if that serves the point — keeping each fact attributed to the employer it belongs to — or naming no employer at all if the point stands without one.',
  '',
  'A REQUIREMENTS LIST may be supplied. The letter is written to that list, one paragraph per requirement, in the order given, using the list exactly as supplied — including any user edits. Do not substitute your own reading of the advertisement, and do not add paragraphs for requirements that are not on the list.',
  '',
  'Never organise the letter by employer, and never work backwards through a career. If each paragraph covers one job in reverse chronological order, you have written a CV with joining words. Start again.',
  '',
  'SELECT, DO NOT COVER. Most of a CV does not belong in the letter. Leave out anything that does not answer something the ad (or the requirements list) asks for, however true or impressive it is. Completeness is not the goal and is actively harmful: qualifications, early roles, portfolio links, dates and tool inventories belong on the CV. Name a tool only when the ad asks for it specifically.',
  '',
  'Accuracy and relevance are both required and they pull against each other. Everything in the letter must come from the CV (and "EXTRA BACKGROUND", where supplied). Most of the CV must not appear in the letter.',
  '',
  'WRITE ABOUT THE CANDIDATE, NOT THE EMPLOYER. Never describe the employer\'s business, brand, mission, values, market or customers back to them. They know. Never restate the ad\'s requirements as prose; listing their own requirements back is not evidence of fit. Show the fit by what the candidate has done.',
  '',
  'The candidate is the subject of their own sentences. They did the work. Employers did not bestow it on them. Constructions like "X entrusted me with" or "Y placed me in charge of" are wrong and frequently introduce factual errors about who did what.',
  '',
  'EVIDENCE RULES (absolute):',
  '1. The only sources of claims about the candidate are the CANDIDATE RESUME and any section marked "EXTRA BACKGROUND". Nothing else.',
  '2. Never take facts, dates, numbers, achievements or skills from a PAST COVER LETTER section. Those show voice only.',
  '3. Keep each fact with the employer, role and period its source attaches it to. Drawing on several employers to prove one point is fine; moving a detail from one employer to another, or splitting a grouped sentence apart, is not.',
  '4. Never state a duration, total, count or number (such as years of experience) unless that exact number appears in the resume or extra background.',
  '5. Never turn a requirement from the ad into a claim about the candidate. If the evidence does not support it, leave it out rather than hedging. Never invent a skill by combining a word from the resume with a word from the ad.',
  '',
  'VOICE. Follow the supplied voice description. Do not copy phrasing from the CV word for word, and do not reuse phrasing from the candidate\'s other letters; a phrase that worked once becomes a stock phrase on repetition. Vary how sentences and paragraphs open. Vary sentence length: a paragraph of uniformly long sentences is as monotonous as one of uniformly short ones, and a letter needs at least one short sentence to land a point.',
  '',
  'FORM. Always include a greeting line on its own ("Dear …", or "Dear Hiring Team" if the ad names no one), the role named exactly as the advertisement titles it in the opening paragraph — never an internal position name or a hashtag — and a plain closing sentence plus the candidate\'s name. Use the ENGLISH VARIANT stated in the request and hold it throughout, including on revision. Use ordinary hyphens and apostrophes; never special characters such as en dashes, em dashes or curly quotes.',
  '',
  'BEFORE RETURNING, CHECK. Would this letter still make sense with a different company\'s name in it? If yes, it has failed: rewrite it around what this role actually asks for. Does every paragraph answer something in the ad or on the requirements list? Does any sentence tell the employer about themselves? Is every claim supported by the CV?',
  '',
  'USER RULES. When a RULES block is supplied, every line is binding. Treat it as the user\'s standing instructions for all their letters: follow it on the first draft and on every revision, never drop or dilute it, and where it conflicts with your own defaults or with anything else in this prompt, the RULES block wins. Where a rule names a spelling or grammar variant, or characters or constructions the user will not use, apply it in every sentence.',
  '',
  'On a revision, treat all instructions as a set to satisfy together, not a queue. Apply the new instruction without breaking any earlier one, and verify the earlier ones still hold before returning.',
  '',
  'Return only what is asked for, with no preamble, labels or markdown.',
].join('\n');

interface Ctx {
  resume: string;
  job: string;
  context: ContextItem[];
  style: StyleSettings;
  /** Persistent user rules, passed verbatim and binding. */
  rules?: string;
  /** Requirements list driving the letter's structure, in order. */
  requirements?: string[];
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

/** The user's persistent rules, fenced and marked binding, sent verbatim with every call. */
function rulesBlock(rules?: string): string {
  const text = (rules || '').trim();
  if (!text) return '';
  return [
    '<<< RULES (BINDING — SUPPLIED BY THE USER, APPLY TO EVERY SENTENCE AND EVERY REVISION) >>>',
    'Treat every line below as a standing instruction from the user. Never drop or dilute it on a revision; where it conflicts with your own defaults or anything else in this prompt, it wins.',
    '--- RULES BEGIN ---',
    text,
    '--- RULES END ---',
  ].join('\n');
}

export function constraintsBlock(style: StyleSettings): string {
  const list = (style.constraints || []).map((c) => c.trim()).filter(Boolean);
  if (!list.length) return '';
  return `MUST NOT CLAIM OR MENTION (absolute, applies to every sentence):\n${list
    .map((c) => `- ${c}`)
    .join('\n')}`;
}

function englishBlock(style: StyleSettings): string {
  return `ENGLISH VARIANT (hold in every sentence, including on revision): ${
    style.english === 'us' ? 'US English' : 'UK/Australian English'
  }`;
}

function contextBlock(ctx: Ctx): string {
  const style = [ctx.style.chips.join(', '), ctx.style.custom].filter(Boolean).join('. ');
  return [
    `<<< CANDIDATE RESUME (EVIDENCE POOL — NOT A TEMPLATE FOR THE LETTER) >>>\n${ctx.resume}\n<<< END >>>`,
    `<<< JOB ADVERTISEMENT (DECIDES STRUCTURE, SELECTION AND TAILORING) >>>\n${ctx.job.slice(
      0,
      8000,
    )}\n<<< END >>>`,
    roleSection(ctx.context, 'background'),
    roleSection(ctx.context, 'research'),
    roleSection(ctx.context, 'style_only'),
    style && `REQUESTED TONE AND STYLE: ${style}`,
    englishBlock(ctx.style),
    rulesBlock(ctx.rules),
    constraintsBlock(ctx.style),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The requirements list, fenced, with instructions to use it exactly as supplied. */
function requirementsBlock(requirements?: string[]): string {
  const list = (requirements || []).map((r) => r.trim()).filter(Boolean);
  if (!list.length) return '';
  return [
    '<<< REQUIREMENTS (THE LETTER IS WRITTEN TO THIS LIST — ONE PARAGRAPH PER ITEM, IN THIS ORDER) >>>',
    'Use this list exactly as given, including any edits the user has made. Do not substitute your own reading of the advertisement and do not add or remove items.',
    ...list.map((r, i) => `${i + 1}. ${r}`),
    '<<< END >>>',
  ].join('\n');
}

export function stylePrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

Suggest 6 short tone/style options (one to two words each, e.g. "formal", "warm", "technical") that suit this candidate and this role. Answer as JSON: {"styles":["..."]}`;
}

/** Requirements the ad asks for that the candidate material does not support, offered as "don't claim" chips. */
export function constraintSuggestionPrompt(ctx: Ctx): string {
  return `${contextBlock(ctx)}

List up to 8 specific capabilities, tools or claims the job advertisement asks for that the candidate material does NOT clearly support. Use short phrases in the candidate's terms. Do not include anything the resume supports. Answer as JSON: {"items":["..."]}`;
}

/**
 * Read the advertisement and return the three or four things the role asks for,
 * one line each, written as requirements rather than topics. Favours what the ad
 * weights most heavily. Says so when the ad is too thin to work from.
 */
export function requirementsPrompt(ctx: Ctx): string {
  return `<<< JOB ADVERTISEMENT >>>
${ctx.job.slice(0, 8000)}
<<< END >>>

Identify the three or four things this role is asking for, drawn from the whole advertisement: responsibilities, the about-you section, and anything the ad returns to or weights most heavily.

Write each as a REQUIREMENT — what the person must do or be — not a topic. "Manages workflow across an in-house team and external freelancers" is a requirement. "Design" is not.

If the advertisement is too thin to work from (only a job title and a line or two), answer {"tooThin": true} with no other fields. Do not invent plausible requirements to fill the count.

Answer as JSON: {"requirements":["...","..."]}`;
}

export function draftPrompt(ctx: Ctx): string {
  const reqs = requirementsBlock(ctx.requirements);
  return `${contextBlock(ctx)}${reqs ? `\n\n${reqs}` : ''}

Plan silently first: for each requirement on the list (or, if there is no list, the three or four things THIS role asks for), pick the strongest evidence — one employer's example, several combined with correct attributions, or a point that stands without naming an employer. Deliberately leave out everything the ad does not call for.

Then write the letter to that plan and output only it: greeting line on its own, the role named as advertised in the opening, one paragraph per requirement in the order given, and a plain closing line plus the candidate's name.

Answer as JSON: {"paragraphs":["...","..."]}`;
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
      : 'Replace the target paragraph with a fresh one that answers its requirement, drawing only on the evidence pool. You may change its angle, as long as it strengthens the letter and does not repeat the other paragraphs.';
  return `${contextBlock(ctx)}

CURRENT LETTER:
${letter}

TARGET PARAGRAPH:
${paragraph}

${instruction}
Keep the candidate as the subject of their own sentences, keep the ${englishBlock(ctx.style)}, and leave out anything the advertisement does not ask for. Return the new paragraph as plain text only.`;
}

export function insertPrompt(ctx: Ctx, letter: string, position: number): string {
  return `${contextBlock(ctx)}

CURRENT LETTER:
${letter}

Write one new paragraph to be inserted as paragraph ${position + 1} of the letter. It must answer something the advertisement asks for that the letter does not yet cover, using evidence from the pool — not repeat what the ad already says. Keep the candidate as the subject of their full sentences, and keep the ${englishBlock(ctx.style)}. Return the paragraph as plain text only.`;
}

/**
 * Revisions are a SET of instructions to satisfy together, not a queue.
 * `pastInstructions` carries every instruction already applied to this letter.
 * The requirements list and the rules block travel with the letter so neither is
 * reset or diluted by a revision.
 */
export function promptWithInstruction(
  ctx: Ctx,
  letter: string,
  instruction: string,
  locked: string[],
  pastInstructions: string[] = [],
): string {
  const all = [...pastInstructions, instruction];
  const reqs = requirementsBlock(ctx.requirements);
  return `${contextBlock(ctx)}${reqs ? `\n\n${reqs}` : ''}

CURRENT LETTER:
${letter}

INSTRUCTIONS THIS LETTER MUST SATISFY TOGETHER (a set, not a queue — satisfying the newest one at the cost of an earlier one is a failure):
${all.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Apply every instruction at once, and before returning, check each one still holds in the finished letter. Locked paragraphs must be returned unchanged, word for word:
${locked.length ? locked.join('\n---\n') : '(none)'}

Also keep every standing rule: candidate as the subject of their own sentences, evidence only from the pool, nothing the advertisement does not ask for, no restating the ad, the RULES block still binding and undiluted, and the ${englishBlock(ctx.style)} unchanged.

Return the full revised letter. Answer as JSON: {"paragraphs":["...","..."]}`;
}

/** Trace every paragraph back to the resume, and flag what cannot be traced. */
export function groundingPrompt(ctx: Ctx, paragraphs: string[]): string {
  return `<<< CANDIDATE RESUME AND EXTRA BACKGROUND >>>\n${ctx.resume}\n${ctx.context
    .filter((c) => c.role === 'background' && c.text.trim())
    .map((c) => c.text.slice(0, 3000))
    .join('\n')}\n<<< END >>>

<<< JOB ADVERTISEMENT >>>
${ctx.job.slice(0, 6000)}\n<<< END >>>

${constraintsBlock(ctx.style)}

LETTER PARAGRAPHS:
${paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}

For each paragraph, in order, report:
- "sources": the short resume/background lines each claim rests on (quote 3-8 words each). Empty if the paragraph makes no claims.
- "unsupported": any sentence making a claim that the candidate material does not support, or that attributes something to the wrong employer or period. Quote the sentence.
- "echoes": any phrase of four or more words taken from the job advertisement, including requirements restated as prose.

Answer as JSON: {"paragraphs":[{"sources":["..."],"unsupported":["..."],"echoes":["..."]}]}`;
}

export function reviewPrompt(ctx: Ctx, letter: string): string {
  const reqs = requirementsBlock(ctx.requirements);
  return `${contextBlock(ctx)}${reqs ? `\n\n${reqs}` : ''}

LETTER:
${letter}

Check this letter and report in this exact order, using short headings and bullets:
1. Selection and structure — does the letter follow the requirements list, one paragraph per requirement in order? Is anything transcribing the resume, following its order, or listing software/tools the ad never calls for? Name the paragraphs.
2. Statements not supported by the candidate material.
3. Facts attached to the wrong employer, role or period.
4. Phrases that echo the job advertisement's wording, or requirements restated as prose, or the employer's own business described back to them.
5. The substitution test: if the employer's name were swapped for another, would the letter still read the same? If yes, say what is missing that ties it to THIS role.
6. Anything breaching the "must not claim or mention" list, the RULES block, the English variant, or the greeting/title/closing structure.
Then one short paragraph (max 80 words) on what works and the single most useful change. No score or rating. Plain text.`;
}

export function parseResumePrompt(text: string): string {
  return `Convert the resume below into JSON matching exactly this shape (use empty strings or empty arrays where information is missing, and never invent facts):

{"basics":{"name":"","email":"","phone":"","website":"","linkedin":"","summary":"","location":{"address":"","city":"","state":"","country":"","postalCode":""}},"work":[{"company":"","position":"","website":"","startDate":"","endDate":"","isCurrentRole":false,"summary":"","highlights":[""]}],"education":[{"institution":"","url":"","area":"","studyType":"","startDate":"","endDate":"","score":"","courses":[]}],"skills":[{"name":"","level":"","keywords":[]}],"projects":[],"volunteer":[],"awards":[],"certifications":[{"name":"","issuer":"","date":"","url":""}],"interests":[],"languages":[{"language":"","fluency":""}]}

RESUME:
${text.slice(0, 20000)}`;
}

/**
 * Normalise model output punctuation: non-breaking and typographic hyphens/dashes
 * become plain "-", curly quotes become straight. Runs on every AI answer before
 * it reaches the letter, so the junk never survives into a PDF.
 */
export function normaliseModelText(text: string): string {
  return (text || '')
    .replace(/[\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/**
 * Convert between English variants in code. Covers the words users actually hit:
 * -ise/-ize families, -our/-or, -re/-er, and a few high-frequency spellings.
 * A rule like "use NZ English" becomes a real conversion, not a hope.
 */
const UK_TO_US: [RegExp, string][] = [
  [/\b(\w+?)isations?\b/g, '$1izations'],
  [/\b(\w+?)isation\b/g, '$1ization'],
  [/\b(\w+?)ised\b/g, '$1ized'],
  [/\b(\w+?)ises\b/g, '$1izes'],
  [/\b(\w+?)ise\b/g, '$1ize'],
  [/\b(\w+?)ising\b/g, '$1izing'],
  [/\bcolour(s|ed|ful|fully|ing|ings|ism|ite|ites)?\b/g, 'color$1'],
  [/\bflavour(s|ful|fuly|ings?|ite)?\b/g, 'flavor$1'],
  [/\bbehaviour(s|al|ally)?\b/g, 'behavior$1'],
  [/\bhonour(s|able|ably|ing|ed)?\b/g, 'honor$1'],
  [/\blabour(s|ed|er|ers|ing)?\b/g, 'labor$1'],
  [/\bneighbour(s|hood|hoods|ing)?\b/g, 'neighbor$1'],
  [/\bcentre(s|d)?\b/g, 'center$1'],
  [/\btheatre(s|s'\u2019?|tical)?\b/g, 'theater$1'],
  [/\bmetre(s)?\b/g, 'meter$1'],
  [/\bfibre(s|d)?\b/g, 'fiber$1'],
  [/\blicence(s|d)?\b/g, 'license$1'],
  [/\bdefence(s|less|lessly)?\b/g, 'defense$1'],
  [/\boffence(s)?\b/g, 'offense$1'],
  [/\bprogramme(s|d|rs?|rs'\u2019?|ming)?\b/g, 'program$1'],
  [/\bcatalogue(s|d|ing)?\b/g, 'catalog$1'],
  [/\bdialogue(s|d|ing)?\b/g, 'dialog$1'],
  [/\btravelled\b/g, 'traveled'],
  [/\btravelling\b/g, 'traveling'],
  [/\btraveller(s)?\b/g, 'traveler$1'],
  [/\bcancelled\b/g, 'canceled'],
  [/\bcancelling\b/g, 'canceling'],
  [/\blabelled\b/g, 'labeled'],
  [/\bmodelling\b/g, 'modeling'],
  [/\bcounsellor(s)?\b/g, 'counselor$1'],
  [/\bjewellery\b/g, 'jewelry'],
  [/\bwhilst\b/g, 'while'],
  [/\bamongst\b/g, 'among'],
  [/\banalyse(d|s)?\b/g, 'analyze$1'],
  [/\bparalyse(d|s)?\b/g, 'paralyze$1'],
  [/\borganise(s|d|r|rs)?\b/g, 'organize$1'],
  [/\brealise(s|d)?\b/g, 'realize$1'],
  [/\brecognise(s|d)?\b/g, 'recognize$1'],
  [/\bminimise(s|d)?\b/g, 'minimize$1'],
  [/\bmaximise(s|d)?\b/g, 'maximize$1'],
  [/\bprioritise(s|d)?\b/g, 'prioritize$1'],
  [/\bspecialise(s|d)?\b/g, 'specialize$1'],
  [/\bsummarise(s|d)?\b/g, 'summarize$1'],
  [/\bstandardise(s|d)?\b/g, 'standardize$1'],
  [/\bcustomise(s|d)?\b/g, 'customize$1'],
  [/\boptimise(s|d)?\b/g, 'optimize$1'],
  [/\bapologise(s|d)?\b/g, 'apologize$1'],
  [/\butilise(s|d)?\b/g, 'utilize$1'],
  [/\bcriticism(s)?\b/g, 'criticism$1'],
];

const US_TO_UK: [RegExp, string][] = [
  [/\b(\w+?)izations?\b/g, '$1isations'],
  [/\b(\w+?)ization\b/g, '$1isation'],
  [/\b(\w+?)ized\b/g, '$1ised'],
  [/\b(\w+?)izes\b/g, '$1ises'],
  [/\b(\w+?)izing\b/g, '$1ising'],
  [/\b(\w+?)ize\b/g, '$1ise'],
  [/\bcolor(s|ed|ful|fully|ing|ings|ism|ite|ites)?\b/g, 'colour$1'],
  [/\bflavor(s|ful|ings?|ite)?\b/g, 'flavour$1'],
  [/\bbehavior(s|al|ally)?\b/g, 'behaviour$1'],
  [/\bhonor(s|able|ably|ing|ed)?\b/g, 'honour$1'],
  [/\blabor(s|ed|er|ers|ing)?\b/g, 'labour$1'],
  [/\bneighbor(s|hood|hoods|ing)?\b/g, 'neighbour$1'],
  [/\bcenter(s|d|ing)?\b/g, 'centre$1'],
  [/\btheater(s)?\b/g, 'theatre$1'],
  [/\bmeter(s)?\b/g, 'metre$1'],
  [/\bfiber(s|d)?\b/g, 'fibre$1'],
  [/\bdefense(s|less)?\b/g, 'defence$1'],
  [/\boffense(s)?\b/g, 'offence$1'],
  [/\bprogram(s|d|rs?|ming)?\b/g, 'programme$1'],
  [/\bcatalog(s|d|ing)?\b/g, 'catalogue$1'],
  [/\btraveled\b/g, 'travelled'],
  [/\btraveling\b/g, 'travelling'],
  [/\btraveler(s)?\b/g, 'traveller$1'],
  [/\bcanceled\b/g, 'cancelled'],
  [/\bcanceling\b/g, 'cancelling'],
  [/\blabeled\b/g, 'labelled'],
  [/\bmodeling\b/g, 'modelling'],
  [/\bcounselor(s)?\b/g, 'counsellor$1'],
  [/\bjewelry\b/g, 'jewellery'],
  [/\bwhile\b/g, 'whilst'],
  [/\bamong\b/g, 'amongst'],
  [/\banalyze(d|s)?\b/g, 'analyse$1'],
  [/\borganize(s|d|r|rs)?\b/g, 'organise$1'],
  [/\brealize(s|d)?\b/g, 'realise$1'],
  [/\brecognize(s|d)?\b/g, 'recognise$1'],
  [/\bminimize(s|d)?\b/g, 'minimise$1'],
  [/\bmaximize(s|d)?\b/g, 'maximise$1'],
  [/\bprioritize(s|d)?\b/g, 'prioritise$1'],
  [/\bspecialize(s|d)?\b/g, 'specialise$1'],
  [/\bsummarize(s|d)?\b/g, 'summarise$1'],
  [/\bstandardize(s|d)?\b/g, 'standardize$1'],
  [/\bcustomize(s|d)?\b/g, 'customize$1'],
  [/\boptimize(s|d)?\b/g, 'optimize$1'],
  [/\bapologize(s|d)?\b/g, 'apologise$1'],
  [/\butilize(s|d)?\b/g, 'utilise$1'],
];

/** Convert the letter's spelling from one variant to the other, preserving case. */
export function convertVariant(text: string, to: EnglishVariant): string {
  const table = to === 'us' ? UK_TO_US : US_TO_UK;
  let out = text;
  for (const [re, rep] of table) {
    out = out.replace(re, (match: string) => {
      const replaced = match.replace(new RegExp(re.source, re.flags), rep);
      return match[0] === match[0].toUpperCase()
        ? replaced.charAt(0).toUpperCase() + replaced.slice(1)
        : replaced;
    });
  }
  return out;
}

/** Which variant the text currently leans towards, by counting marker spellings. */
export function detectVariant(text: string): EnglishVariant | null {
  const uk = (text.match(/\b(colour|organise|centre|programme|realise|recognise|behaviour|licence|defence|whilst|amongst|analyse|travelled|cancelled)\w*\b/gi) || []).length;
  const us = (text.match(/\b(color|organize|center|program|realize|recognize|behavior|license|defense|while|among|analyze|traveled|canceled)\w*\b/gi) || []).length;
  if (uk === us) return null;
  return uk > us ? 'uk' : 'us';
}

export type BannedCharMode = 'dashes' | 'quotes' | 'both';

/** Characters the user may have banned in their rules, with their ASCII substitutes. */
const BANNED_CHARS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'em dash', pattern: /\u2014/g, replacement: '-' },
  { name: 'en dash', pattern: /\u2013/g, replacement: '-' },
  { name: 'curly apostrophe', pattern: /[\u2018\u2019]/g, replacement: "'" },
  { name: 'curly quotes', pattern: /[\u201C\u201D]/g, replacement: '"' },
  { name: 'non-breaking hyphen', pattern: /\u2011/g, replacement: '-' },
  { name: 'ellipsis', pattern: /\u2026/g, replacement: '...' },
];

/**
 * Enforce in code what code can enforce. Detects which characters the user has
 * banned in their rules text and substitutes them out of the letter, regardless
 * of what the model was asked to do.
 */
export function enforceBannedChars(text: string, rules: string): string {
  const r = (rules || '').toLowerCase();
  if (!r) return text;
  let out = text;
  for (const { name, pattern, replacement } of BANNED_CHARS) {
    // Match the character name in the rules, allowing for plurals and "no X"/"never use X".
    const banned = new RegExp(
      `(no|never|without|don'?t|do not|avoid|ban|banned)\\s+(?:use\\s+|using\\s+|of\\s+)?(?:\\w+\\s+){0,3}${name}s?`,
      'i',
    ).test(r) || new RegExp(`${name}`, 'i').test(r);
    if (banned) out = out.replace(pattern, replacement);
  }
  return out;
}

export function lettersToText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => normaliseModelText(p.text).trim()).filter(Boolean).join('\n\n');
}
