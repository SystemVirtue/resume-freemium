import { ResumeData } from '@/types/resume';

export type ContextRole = 'style_only' | 'research' | 'background';

export interface SourceRef {
  /** The claim the paragraph makes, quoted briefly. */
  claim: string;
  /** The resume/background line it rests on, quoted briefly. */
  source: string;
}

export interface RuleFlag {
  /** The rule from the saved rules the paragraph conflicts with. */
  rule: string;
  /** The words in the paragraph that break or override it. */
  fragment: string;
}

export interface Paragraph {
  id: string;
  text: string;
  locked: boolean;
  /** Claim-by-claim sources: only what this paragraph actually uses. */
  sources?: SourceRef[];
  /** Specific unsupported words or phrases — not whole sentences. */
  unsupported?: string[];
  /** Facts credited to the wrong employer, role or period. */
  misattributed?: string[];
  /** Phrases lifted from the job ad. */
  echoes?: string[];
  /** Conflicts with the saved rules found in this paragraph. */
  ruleFlags?: RuleFlag[];
  /** Code-detected repetition (words, sentence/paragraph openings). Flag only. */
  repetition?: string[];
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
  "You write cover letters. You receive a candidate's CV, a job ad, a requirements list, optional extra content, a style and tone description, an English variant, saved rules, and any change instructions. The sections marked with <<< >>> carry those inputs.",
  '',
  'PRIORITY. Where instructions conflict, follow this order: change instructions, then saved rules, then the requirements list, then the job ad, then everything else in this prompt.',
  '',
  "STRUCTURE. Build the letter around the requirements list, not the order of the CV. Every requirement must be covered. Two requirements can share a paragraph where they naturally belong together. Use the list as provided, including any user edits. Within a paragraph, draw on whichever parts of the candidate's background best support the point, from more than one employer where that helps — keeping each fact attributed to the employer or context it belongs to.",
  '',
  'SELECTION. Include what supports a requirement, directly or indirectly. Transferable and adjacent experience is legitimate, and sometimes it is the strongest evidence a candidate has: where the link to the requirement is not obvious, make it explicit. Leave out material that supports no requirement, however true or impressive. Early roles, portfolio links, dates and general tool lists usually belong on the CV. Mention a qualification, registration or tool when the ad asks for it.',
  '',
  'ACCURACY. Do not claim anything the CV or extra content does not support, and attribute each fact to the right employer or context. Where there is room, show a claim with a concrete example rather than simply asserting it. Where a requirement is not supported by anything in the background, leave it out rather than implying it.',
  '',
  'EVIDENCE SOURCES. Claims about the candidate may come only from the CANDIDATE RESUME and from extra content marked "EXTRA BACKGROUND ABOUT THE CANDIDATE". Sections marked "PAST COVER LETTERS" show how the candidate writes: never take facts, dates, numbers or achievements from them. Sections marked "COMPANY / ROLE RESEARCH" hold facts about the employer only. Never state a number — years of experience, team sizes, totals — unless that exact number appears in the resume or extra background, and never turn a requirement from the ad into a claim about the candidate.',
  '',
  "THE AD. Using the ad's keywords is good practice, since readers and screening systems look for them. Every point taken from the ad should be something the candidate can genuinely stand behind. Use the ad's terms without the letter reading like the ad handed back.",
  '',
  'THE EMPLOYER. Showing knowledge of the organisation and a real reason for wanting to work there strengthens a letter. Make it specific and connected to the candidate: a genuine interest in the work, direct experience of the organisation or its products, or something particular about the role. Generic praise, or repeating the employer\'s own marketing language back to them, adds nothing.',
  '',
  'MOTIVATION. Include at least one sentence on why this role appeals, drawn from the candidate\'s own material where it exists.',
  '',
  'ACTIVE VOICE. The candidate is the subject of their own sentences. They did the work. Constructions like "X entrusted me with" or "Y placed me in charge of" weaken the letter and can introduce errors about who did what.',
  '',
  'SPECIFICS. Where the CV gives a number, scale or concrete detail, prefer it to a general description. Never invent one.',
  '',
  'PARAGRAPH OPENINGS. A topic sentence should carry information. An opening that announces a point without saying anything specific, such as "Balancing multiple projects is second nature to me", should be replaced by the concrete point itself.',
  '',
  'GENERIC LANGUAGE. Occasional professional vocabulary is normal. A letter dense with phrases that could appear in any letter for any job becomes interchangeable with every other letter. Avoid clichés.',
  '',
  'REPETITION. Avoid repeating a word within a short distance. Vary how sentences and paragraphs open, including avoiding a run of sentences that start with "I". Use each piece of evidence once.',
  '',
  "STYLE AND TONE. Follow the style and tone description as a description of how the writing should sound, not as a list of things to avoid. Where it says what the writing is not, find the positive version. Use any previous letters in the extra content as a guide to how the candidate writes. Do not copy lines from the CV word for word. Vary sentence length.",
  '',
  'CONSISTENCY. Keep choices consistent throughout: comma style, spelling of recurring terms, how employers are named, and tense, present for current work and past for previous roles. Use the selected English variant.',
  '',
  'FORM. Use the named contact in the greeting if the ad gives one, otherwise a generic greeting. Name the role in the opening line. Close with one plain sentence. Keep the letter between 250 and 400 words unless the ad or the rules say otherwise.',
  '',
  "CONFLICTS. Saved rules are standing defaults. If a change instruction contradicts a saved rule, follow the change instruction for this letter and all its later revisions, and report the override in the \"notices\" field of your answer. Do not treat the saved rule as changed. This applies to claims as well as style; the user is the authority on their own career. If a new change conflicts with an earlier one, follow the new one and keep the rest. Do not edit locked paragraphs to satisfy a change; apply it elsewhere and report the locked paragraph it would affect in the \"wouldTouch\" field. If the rules conflict with the English variant selector, follow the selector and report the mismatch in \"notices\". If two rules contradict each other, follow the more specific one and report it. Never modify the saved rules. All flags and notices go in the \"notices\" field, never into the letter text.",
  '',
  'BEFORE RETURNING, CHECK:',
  '- Every requirement is covered.',
  "- The letter would not make sense with a different company's name in it.",
  '- Every claim is supported and correctly attributed.',
  '- Anything indirect has its link to a requirement made explicit.',
  '- No paragraph opens with an empty topic sentence.',
  '- There is at least one sentence of motivation.',
  '- No word is repeated close together, no run of sentences opens the same way, and no evidence is used twice.',
  '- The length fits the limit.',
  '- Every saved rule has been followed, or its override reported.',
  '- No notice or flag has been written into the letter itself.',
  '',
  'ON REVISION, treat all instructions as a set to satisfy together, not a queue, and run the checks above before returning.',
  '',
  'Answer in the JSON shape each request specifies. No preamble, labels or markdown.',
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
    "Treat every line below as a standing instruction from the user. Never drop or dilute it on a revision; where it conflicts with your own defaults or anything else in this prompt, it wins — except where the PRIORITY order or the English variant selector says otherwise, and report any conflict in \"notices\".",
    '--- RULES BEGIN ---',
    text,
    '--- RULES END ---',
  ].join('\n');
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

/**
 * Document 2 — the requirements prompt. Replaces any earlier version entirely.
 */
export function requirementsPrompt(ctx: Ctx): string {
  return `You read a job ad and work out what the role actually needs the person to do.

Process:
1. Read the whole ad, including the responsibilities and the about-you section.
2. Notice what it returns to, spends the most words on, or lists as essential.
3. Boil that down to the three or four things the person will mainly be doing or bringing.

Write each one as a short, plain line of about ten words or fewer, in ordinary language. One idea per line. Do not combine unrelated things, and do not list channels, platforms or tools inside a line. Name a specific tool only if the whole role depends on it.

This list is a working tool the user reads at a glance and edits, so clarity matters more than completeness.

Right shape:
- Manages several projects and deadlines at once
- Leads and mentors junior designers
- Presents and explains design decisions to stakeholders
- Adapts work for different audiences and markets

Wrong shape:
- Develop creative concepts and execute integrated campaigns across digital, social, retail, print and e-commerce channels from brief to completion

If the ad does not contain enough information to identify genuine requirements, answer {"tooThin": true} instead of producing a list. Do not invent plausible requirements to fill the count.

<<< JOB ADVERTISEMENT >>>
${ctx.job.slice(0, 8000)}
<<< END >>>

Answer as JSON: {"requirements":["...","..."]}`;
}

export function draftPrompt(ctx: Ctx): string {
  const reqs = requirementsBlock(ctx.requirements);
  return `${contextBlock(ctx)}${reqs ? `\n\n${reqs}` : ''}

Plan silently first: for each requirement on the list (or, if there is no list, the three or four things THIS role asks for), pick the strongest evidence — one employer's example, several combined with correct attributions, or a point that stands without naming an employer. Deliberately leave out everything the ad does not call for.

Then write the letter to that plan: greeting line on its own, the role named as advertised in the opening, one paragraph per requirement in the order given, and a plain closing line plus the candidate's name.

Report any conflict between the saved rules and anything else (including the English variant selector) in "notices" — never in the letter text.

Answer as JSON: {"paragraphs":["...","..."],"notices":["..."]}`;
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

If a change cannot be applied without editing a locked paragraph, apply it everywhere else and list the locked paragraphs it would affect in "wouldTouch" (quote each paragraph's opening words). Report overrides of the saved rules and any conflict between the rules and the English variant selector in "notices". Never put notices or flags into the letter text.

Also keep every standing rule: candidate as the subject of their own sentences, evidence only from the pool, nothing the advertisement does not ask for, no restating the ad, the RULES block still binding and undiluted, and the ${englishBlock(ctx.style)} unchanged.

Return the full revised letter. Answer as JSON: {"paragraphs":["...","..."],"notices":["..."],"wouldTouch":["..."]}`;
}

/** Trace every paragraph back to the resume, and flag what cannot be traced. */
export function groundingPrompt(ctx: Ctx, paragraphs: string[]): string {
  return `<<< CANDIDATE RESUME AND EXTRA BACKGROUND >>>\n${ctx.resume}\n${ctx.context
    .filter((c) => c.role === 'background' && c.text.trim())
    .map((c) => c.text.slice(0, 3000))
    .join('\n')}\n<<< END >>>

<<< JOB ADVERTISEMENT >>>
${ctx.job.slice(0, 6000)}
<<< END >>>

${rulesBlock(ctx.rules)}

LETTER PARAGRAPHS:
${paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}

For each paragraph, in order, report:
- "sources": for each claim the paragraph actually makes, the short background line it rests on (quote 3-8 words each). List only sources this paragraph uses — none for material it does not contain. Empty if the paragraph makes no claims.
- "unsupported": the specific unsupported words or short phrase — not the whole sentence — for any claim the candidate material does not support. Quote the fragment exactly as it appears.
- "misattributed": any fact credited to the wrong employer, role or period, even though the fact exists somewhere in the background. Quote the fragment, then " - belongs to: " and where it actually belongs.
- "echoes": any phrase of four or more words taken from the job advertisement, including requirements restated as prose.
- "rules": any breach of a line in the RULES block visible in this paragraph, as {"rule":"the rule","fragment":"the words that break it"}. Ignore spelling-variant and punctuation rules — those are enforced in code.

Answer as JSON: {"paragraphs":[{"sources":[{"claim":"...","source":"..."}],"unsupported":["..."],"misattributed":["..."],"echoes":["..."],"rules":[{"rule":"...","fragment":"..."}]}]}`;
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
6. Anything breaching the saved rules, the selected English variant, or the greeting/role/closing structure.
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
  [/\bstandardize(s|d)?\b/g, 'standardise$1'],
  [/\bcustomize(s|d)?\b/g, 'customise$1'],
  [/\boptimize(s|d)?\b/g, 'optimise$1'],
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

/**
 * Which English variant the user's rules text names, if any. The selector wins
 * on conflict, but the mismatch is reported to the user.
 */
export function rulesVariant(rules: string): EnglishVariant | null {
  const r = (rules || '').toLowerCase();
  if (!r) return null;
  const ukish = /\b(nz|new zealand|australian|australia|uk|british|britain|england|au)\b/.test(r);
  const usish = /\b(us|u\.s\.|usa|american|america|united states)\b/.test(r);
  if (ukish && !usish) return 'uk';
  if (usish && !ukish) return 'us';
  return null;
}

/** Characters the user may have banned in their rules, with their ASCII substitutes. */
const BANNED_CHARS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'em dash', pattern: /\u2014/g, replacement: '-' },
  { name: 'em dashes', pattern: /\u2014/g, replacement: '-' },
  { name: 'en dash', pattern: /\u2013/g, replacement: '-' },
  { name: 'en dashes', pattern: /\u2013/g, replacement: '-' },
  { name: 'curly apostrophe', pattern: /[\u2018\u2019]/g, replacement: "'" },
  { name: 'curly quotes', pattern: /[\u201C\u201D]/g, replacement: '"' },
  { name: 'non-breaking hyphen', pattern: /\u2011/g, replacement: '-' },
  { name: 'ellipsis', pattern: /\u2026/g, replacement: '...' },
];

const CHAR_NEGATION =
  /(no|never|without|don'?t|do not|avoid|ban(?:ned)?|exclud\w*|instead of|stop using|not use|not using)\s+(?:use\s+|using\s+|of\s+)?(?:\w+\s+){0,3}$/i;

/**
 * Enforce in code what code can enforce. Detects which characters the user has
 * banned in their rules text and substitutes them out of the letter, regardless
 * of what the model was asked to do. A character is only treated as banned when
 * the rules negate it ("no em dashes") — merely mentioning it is not a ban.
 */
export function enforceBannedChars(text: string, rules: string): string {
  const r = (rules || '').toLowerCase();
  if (!r) return text;
  let out = text;
  for (const { name, pattern, replacement } of BANNED_CHARS) {
    const match = new RegExp(name.replace(/ /g, '\\s+'), 'i').exec(r);
    if (!match) continue;
    const before = r.slice(Math.max(0, match.index - 30), match.index);
    if (CHAR_NEGATION.test(before)) out = out.replace(pattern, replacement);
  }
  return out;
}

/** Words too common to be worth flagging when they repeat. */
const REPETITION_STOP = new Set([
  'that', 'this', 'with', 'from', 'they', 'them', 'then', 'than', 'have', 'been',
  'were', 'their', 'there', 'these', 'those', 'which', 'would', 'could', 'should',
  'about', 'into', 'also', 'more', 'most', 'some', 'such', 'when', 'while', 'where',
  'what', 'your', 'you', 'our', 'will', 'and', 'the', 'for', 'are', 'was', 'has',
  'had', 'not', 'but', 'all', 'can', 'its', "it's", 'here', 'over', 'both', 'each',
  'after', 'before', 'because', 'being', 'under', 'across', 'every', 'very', 'just',
  'like', 'make', 'made', 'take', 'took', 'give', 'gave', 'well', 'only', 'even',
  'much', 'many', 'onto', 'upon', 'within', 'without', 'through', 'during', 'my',
  'me', 'he', 'she', 'his', 'her', 'him', 'who', 'whom', 'how', 'why', 'any',
]);

/**
 * Code-side repetition check: flag words repeated within a short distance, and
 * sentences that open the same way. Flags only — never auto-corrects.
 */
export function flagRepetition(text: string): string[] {
  const flags: string[] = [];
  const clean = normaliseModelText(text || '');
  if (!clean.trim()) return flags;

  // Words repeated within ~40 words of each other.
  const words = clean.toLowerCase().match(/[a-z']+/g) || [];
  const lastSeen = new Map<string, number>();
  const repeats = new Set<string>();
  words.forEach((w, i) => {
    if (w.length < 4 || REPETITION_STOP.has(w)) return;
    const prev = lastSeen.get(w);
    if (prev !== undefined && i - prev <= 40) repeats.add(w);
    lastSeen.set(w, i);
  });
  for (const w of Array.from(repeats).slice(0, 3)) {
    flags.push(`"${w}" repeats within a few words`);
  }

  // Sentences that open with the same word.
  const sentences = clean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const firstWords = new Map<string, number>();
  for (const s of sentences) {
    const opening = (s.match(/^[A-Za-z']+/) || [''])[0].toLowerCase();
    if (opening.length < 3) continue;
    firstWords.set(opening, (firstWords.get(opening) || 0) + 1);
  }
  for (const [w, n] of firstWords) {
    if (n >= 3) flags.push(`${n} sentences start with "${w}"`);
  }
  return flags.slice(0, 4);
}

/**
 * Cross-paragraph check: paragraphs that open with the same word. Each paragraph
 * is flagged against earlier ones only, so a pair produces one flag.
 */
export function flagParagraphOpenings(texts: string[]): string[][] {
  const firsts = texts.map(
    (t) => (normaliseModelText(t || '').trim().match(/^[A-Za-z']+/)?.[0] || '').toLowerCase(),
  );
  return texts.map((_, i) => {
    const flags: string[] = [];
    if (!firsts[i]) return flags;
    for (let j = 0; j < i; j++) {
      if (firsts[j] && firsts[j] === firsts[i]) {
        flags.push(`opens the same way as paragraph ${j + 1}`);
        break;
      }
    }
    return flags;
  });
}

export function lettersToText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => normaliseModelText(p.text).trim()).filter(Boolean).join('\n\n');
}
