import {
  Ctx, Paragraph, flagRepetition, flagParagraphOpenings, detectVariant,
  normaliseModelText, rulesVariant,
} from '@/lib/coverLetter';

export interface DeterministicResult {
  passed: boolean;
  checks: EvalCheck[];
}

export interface EvalCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

const words = (text: string): string[] => (normaliseModelText(text).toLowerCase().match(/[a-z']+/g) || []);

const OPENERS = /^(i am|this letter is to|i am writing|dear hiring|to whom it may concern|please accept)/i;

/** Framework: "An opening that says which role this is and who the candidate is." */
export const openingNamesRoleAndCandidate = (paragraphs: Paragraph[], resumeName: string): EvalCheck => {
  const first = paragraphs[0] ? normaliseModelText(paragraphs[0].text) : '';
  const nameParts = resumeName.toLowerCase().split(/\s+/).filter((part) => part.length > 1);
  const nameHit = nameParts.length ? nameParts.some((part) => first.toLowerCase().includes(part)) : false;
  const roleHint = /(role|position|vacancy|application|apply|manager|engineer|nurse|electrician|designer|coordinator|lead|assistant|programme|program)/i;
  const passes = first.trim().length > 0 && (nameHit || /\b(i|my)\b/i.test(first)) && roleHint.test(first);
  return {
    id: 'opening-names-role-candidate',
    label: 'Opening names role and candidate before evidence',
    passed: passes,
    detail: `first 140 chars: ${first.slice(0, 140) || '(empty)'}`,
  };
};

/** Framework: "A plain closing sentence." */
export const hasPlainClosing = (paragraphs: Paragraph[]): EvalCheck => {
  const last = paragraphs.length ? normaliseModelText(paragraphs[paragraphs.length - 1].text).trim() : '';
  const closingish = /^(kind regards|regards|yours sincerely|yours faithfully|sincerely|thank you|best)/i;
  const passes = last.length > 0 && last.length < 220 && !OPENERS.test(last) && (
    closingish.test(last) || /look(ing)? forward|welcome the (chance|opportunity)|happy to (discuss|provide|talk)|available for (an )?interview|please (do not hesitate|feel free)/i.test(last)
  );
  return {
    id: 'plain-closing',
    label: 'Plain closing sentence present',
    passed: passes,
    detail: `last paragraph: ${last.slice(0, 140) || '(empty)'}`,
  };
};

/** Framework: "Two or three paragraphs covering what the role asks for." */
export const evidenceParagraphCount = (paragraphs: Paragraph[]): EvalCheck => {
  const count = Math.max(0, paragraphs.length - 2); // opening + closing are not evidence
  return {
    id: 'evidence-paragraph-count',
    label: '2-3 evidence paragraphs between opening and closing',
    passed: count >= 2 && count <= 3 && paragraphs.length >= 4,
    detail: `${paragraphs.length} paragraphs total, ${count} counted as evidence`,
  };
};

/** Framework: "Under one page." */
export const wordLimit = (paragraphs: Paragraph[]): EvalCheck => {
  const total = paragraphs.reduce((sum, paragraph) => sum + words(paragraph.text).length, 0);
  return {
    id: 'word-limit',
    label: 'Under one page (~520 words)',
    passed: total > 0 && total <= 520,
    detail: `${total} words`,
  };
};

/** Framework: "The user's saved rules are binding" (deterministic subset). */
export const ruleCompliance = (paragraphs: Paragraph[], rules: string): EvalCheck => {
  const text = normaliseModelText(paragraphs.map((paragraph) => paragraph.text).join('\n\n'));
  const failures: string[] = [];
  if (/no em dash/i.test(rules) && /\u2014/.test(text)) failures.push('em dash present');
  if (/no en dash/i.test(rules) && /\u2013/.test(rules ? normaliseModelText(text) : text)) failures.push('en dash present');
  if (/(no|avoid|ban)\w*\s+(curly quotes?|smart quotes?)/i.test(rules) && /[\u201C\u201D\u2018\u2019]/.test(text)) failures.push('curly quote present');
  const passion = /\bpassionate\b/i.test(text);
  if (/never use the word ['"]?passionate/i.test(rules) && passion) failures.push('"passionate" used despite rule');
  const cliches = [/fast-paced environment/i, /proven track record/i];
  const clicheHit = cliches.filter((pattern) => pattern.test(text));
  if (/(no|avoid|ban)\w*\s+cliche/i.test(rules) && clicheHit.length) failures.push(`cliche used: ${clicheHit.map(String).join(', ')}`);
  const limitMatch = /under (\d{2,4})\s*words/i.exec(rules);
  if (limitMatch) {
    const limit = Number(limitMatch[1]);
    const total = words(text).length;
    if (total > limit) failures.push(`word limit ${limit} exceeded (${total} words)`);
  }
  return {
    id: 'rule-compliance',
    label: 'Deterministic rule compliance (em dashes, quotes, cliches, limits)',
    passed: failures.length === 0,
    detail: failures.length ? failures.join('; ') : 'no deterministic rule violations',
  };
};

/** Framework: "If a sentence would be true of any competent applicant, it is taking up space." */
export const genericPhraseScan = (paragraphs: Paragraph[]): EvalCheck => {
  const text = normaliseModelText(paragraphs.map((paragraph) => paragraph.text).join('\n\n'));
  const generic = [
    /\bproven track record\b/i, /\bfast-paced environment\b/i, /\bdynamic team\b/i,
    /\bhit the ground running\b/i, /\bpassionate about\b/i, /\bexcellent communication skills\b/i,
    /\bteam player\b/i, /\bthink outside the box\b/i, /\bresults-driven\b/i, /\bwears? many hats\b/i,
  ];
  const hits = generic.filter((pattern) => pattern.test(text));
  return {
    id: 'generic-phrases',
    label: 'No generic anyone-could-say phrases',
    passed: hits.length === 0,
    detail: hits.length ? hits.map(String).join(', ') : 'none found',
  };
};

/** Framework: echo rule — 4+ consecutive words shared with the ad. */
export const echoScan = (paragraphs: Paragraph[], jobAd: string): EvalCheck => {
  const letter = normaliseModelText(paragraphs.map((paragraph) => paragraph.text).join(' '));
  const ad = normaliseModelText(jobAd);
  const letterGrams = new Set<string>();
  const lw = words(letter);
  for (let i = 0; i + 4 <= lw.length; i++) letterGrams.add(lw.slice(i, i + 4).join(' '));
  const aw = words(ad);
  const hits: string[] = [];
  for (let i = 0; i + 4 <= aw.length; i++) {
    const gram = aw.slice(i, i + 4).join(' ');
    if (letterGrams.has(gram) && !hits.includes(gram)) hits.push(gram);
    if (hits.length >= 8) break;
  }
  const trivial = new Set(['with experience in the', 'in a busy', 'of the role and the']);
  const meaningful = hits.filter((hit) => !trivial.has(hit));
  return {
    id: 'echo-scan',
    label: 'Fewer than 3 shared 4-grams with the job ad (echo rule)',
    passed: meaningful.length < 3,
    detail: meaningful.length ? `${meaningful.length} shared 4-grams: "${meaningful.slice(0, 4).join('", "')}"` : 'no shared 4-grams',
  };
};

/** Post-repair flag landscape: did repair converge? */
export const flagConvergence = (before: Paragraph[], after: Paragraph[]): EvalCheck => {
  const count = (list: Paragraph[]) => list.reduce((sum, paragraph) => sum + (
    (paragraph.unsupported?.length || 0) + (paragraph.misattributed?.length || 0) + (paragraph.echoes?.length || 0) +
    (paragraph.scopeInflation?.length || 0) + (paragraph.employerDescriptions?.length || 0) + (paragraph.pivots?.length || 0) +
    (paragraph.emptyOpenings?.length || 0) + (paragraph.structureFlags?.length || 0) + (paragraph.ruleFlags?.length || 0) +
    (paragraph.repetition?.length || 0)
  ), 0);
  const beforeCount = count(before);
  const afterCount = count(after);
  return {
    id: 'flag-convergence',
    label: 'Repairs reduce or clear flagged findings',
    passed: afterCount <= beforeCount,
    detail: `${beforeCount} findings before repair, ${afterCount} after`,
  };
};

/** English variant check against the selector (framework: selector is binding). */
export const variantCompliance = (paragraphs: Paragraph[], style: Ctx['style']): EvalCheck => {
  const text = paragraphs.map((paragraph) => paragraph.text).join('\n\n');
  const detected = detectVariant(text);
  const target = style.english || 'uk';
  const passes = detected === null || detected === target;
  return {
    id: 'variant-compliance',
    label: `Letter matches selected English variant (${target})`,
    passed: passes,
    detail: detected ? `detected ${detected}` : 'no variant markers detected',
  };
};

/** Rules-vs-selector contradiction should surface as a notice (conflict-flag path). */
export const conflictNoticed = (notices: string[]): EvalCheck => {
  const relevant = notices.filter((notice) => /rules mention|selector was applied|conflict/i.test(notice));
  return {
    id: 'conflict-noticed',
    label: 'Rules/selector conflict surfaced as a notice',
    passed: relevant.length > 0,
    detail: relevant.length ? relevant.join(' | ') : 'no conflict notice',
  };
};

export const runDeterministicChecks = (
  paragraphs: Paragraph[], scenario: { style: Ctx['style']; rules: string }, jobAd: string,
  candidateName: string, options: { notices?: string[]; beforeRepair?: Paragraph[] } = {},
): DeterministicResult => {
  const checks: EvalCheck[] = [
    openingNamesRoleAndCandidate(paragraphs, candidateName),
    hasPlainClosing(paragraphs),
    evidenceParagraphCount(paragraphs),
    wordLimit(paragraphs),
    ruleCompliance(paragraphs, scenario.rules),
    genericPhraseScan(paragraphs),
    echoScan(paragraphs, jobAd),
    variantCompliance(paragraphs, scenario.style),
  ];
  if (options.notices) checks.push(conflictNoticed(options.notices));
  if (options.beforeRepair) checks.push(flagConvergence(options.beforeRepair, paragraphs));
  checks.push(...localFlagScan(paragraphs));
  return { passed: checks.every((check) => check.passed), checks };
};

/** Re-run the app's own local flaggers as eval checks (repetition, paragraph openings). */
const localFlagScan = (paragraphs: Paragraph[]): EvalCheck[] => {
  const repetition = paragraphs.flatMap((paragraph) => flagRepetition(paragraph.text));
  const openings = flagParagraphOpenings(paragraphs.map((paragraph) => paragraph.text)).flat();
  return [
    {
      id: 'repetition',
      label: 'No word repetition within 12 words (local flagger)',
      passed: repetition.length === 0,
      detail: repetition.length ? repetition.join('; ') : 'clean',
    },
    {
      id: 'paragraph-openings',
      label: 'No repeated paragraph opening words (local flagger)',
      passed: openings.length === 0,
      detail: openings.length ? openings.join('; ') : 'clean',
    },
  ];
};
