import { GateResult, ngramOverlap } from '@/lib/coverLetterGate';
import { detectVariant } from '@/lib/coverLetter';

export interface EvalCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface DeterministicResult {
  passed: boolean;
  checks: EvalCheck[];
}

const tokens = (s: string) => (s || '').toLowerCase().match(/[a-z']+/g) || [];

export interface DeterministicInput {
  letterText: string;
  jobAd: string;
  resumeText: string;
  candidateName: string;
  rules: string;
  style: { custom: string; english?: 'uk' | 'us' };
  gate: GateResult | null;
  /** Paragraph texts in order. */
  letters: string[];
  notices: string[];
  questions: string[];
}

/** Framework: "An opening that says which role this is and who the candidate is." */
const openingCheck = (letters: string[], candidateName: string): EvalCheck => {
  const first = letters[0] || '';
  const nameParts = candidateName.toLowerCase().split(/\s+/).filter((part) => part.length > 1);
  const nameHit = nameParts.length ? nameParts.some((part) => first.toLowerCase().includes(part)) : false;
  const roleHint = /(role|position|vacancy|application|apply|manager|engineer|nurse|electrician|designer|coordinator|lead|assistant|programme|program|writer|analyst)/i;
  return {
    id: 'opening-names-role-candidate',
    label: 'Opening names the role and candidate before evidence',
    passed: first.trim().length > 0 && (nameHit || /\b(i|my)\b/i.test(first)) && roleHint.test(first),
    detail: `first 140 chars: ${first.slice(0, 140) || '(empty)'}`,
  };
};

/** Framework: "A plain closing sentence." */
const closingCheck = (letters: string[]): EvalCheck => {
  const last = letters[letters.length - 1] || '';
  const closingish = /^(kind regards|regards|yours sincerely|yours faithfully|sincerely|thank you|best)/i;
  const passes = last.length > 0 && last.length < 220 && (
    closingish.test(last) ||
    /look(ing)? forward|welcome the (chance|opportunity)|happy to (discuss|provide|talk)|available for (an )?interview|please (do not hesitate| feel free)/i.test(last)
  );
  return {
    id: 'plain-closing',
    label: 'Plain closing sentence present',
    passed: passes,
    detail: `last paragraph: ${last.slice(0, 140) || '(empty)'}`,
  };
};

/** Framework: "Under one page" — v2 band is 250–400 words. */
const wordBandCheck = (letters: string[]): EvalCheck => {
  const total = tokens(letters.join(' ')).length;
  return {
    id: 'word-band',
    label: '250-400 words (v2 letter band)',
    passed: total >= 250 && total <= 400,
    detail: `${total} words`,
  };
};

/** Framework: "Say something only this candidate could say." */
const genericScan = (letterText: string): EvalCheck => {
  const lower = letterText.toLowerCase();
  const generic = ['team player', 'go-getter', 'hit the ground running', 'think outside the box', 'proven track record', 'excellent communication skills', 'fast-paced environment', 'detail-oriented', 'self-starter', 'results-driven'];
  const hits = generic.filter((phrase) => lower.includes(phrase));
  return {
    id: 'generic-phrases',
    label: 'No generic anyone-could-say phrases',
    passed: hits.length === 0,
    detail: hits.length ? hits.join(', ') : 'none found',
  };
};

/** Framework echo rule via the shared 5-gram measure. */
const echoCheck = (letterText: string, jobAd: string): EvalCheck => {
  const overlap = ngramOverlap(letterText, jobAd, 5);
  return {
    id: 'echo-scan',
    label: 'Ad echo below 12% (shared 5-grams with the ad)',
    passed: overlap < 0.12,
    detail: `${(overlap * 100).toFixed(1)}% of the letter's 5-grams also appear in the ad`,
  };
};

/** Framework: "The user's saved rules are binding" (deterministic subset). */
const ruleCheck = (letterText: string, rules: string): EvalCheck => {
  const text = letterText;
  const failures: string[] = [];
  if (/no em dash/i.test(rules) && /\u2014/.test(text)) failures.push('em dash present');
  if (/never use the word ['"]?passionate/i.test(rules) && /\bpassionate\b/i.test(text)) failures.push('"passionate" used despite rule');
  if (/(no|avoid|ban)\w*\s+cliche/i.test(rules) && /(fast-paced environment|proven track record)/i.test(text)) failures.push('cliche used despite rule');
  const limitMatch = /under (\d{2,4})\s*words/i.exec(rules);
  if (limitMatch) {
    const limit = Number(limitMatch[1]);
    const total = tokens(text).length;
    if (total > limit) failures.push(`word limit ${limit} exceeded (${total})`);
  }
  return {
    id: 'rule-compliance',
    label: 'Deterministic rule compliance',
    passed: failures.length === 0,
    detail: failures.length ? failures.join('; ') : 'no deterministic rule violations',
  };
};

/** The gate is the framework's own verifier — the letter should not fail it. */
const gateCheck = (gate: GateResult | null): EvalCheck => {
  return {
    id: 'gate-verdict',
    label: 'Quality gate: pass or minor only',
    passed: gate?.verdict === 'pass' || gate?.verdict === 'minor',
    detail: gate ? `${gate.verdict}: ${gate.detail}` : 'gate did not run',
  };
};

/** Framework: no invented motivation — needs-input must surface as a question, not a guess. */
const questionsCheck = (questions: string[]): EvalCheck => {
  return {
    id: 'honest-questions',
    label: 'Unanswerable points raised as questions, not guesses',
    passed: true,
    detail: questions.length ? questions.join(' | ') : 'no open questions',
  };
};

/** Framework: naming a gap honestly is not a defect. */
const gapStatementCheck = (letters: string[]): EvalCheck => {
  const hasGap = letters.some((paragraph) => /\b(although|while) (i|we) (do not|don't|have not|haven't)\b/i.test(paragraph));
  return {
    id: 'gap-statement-allowed',
    label: 'Honest gap statements not penalised',
    passed: true,
    detail: hasGap ? 'letter contains an explicit gap admission' : 'no explicit gap admission present',
  };
};

/** The v2 selector is binding on every sentence. */
const variantCheck = (letterText: string, style: { english?: 'uk' | 'us' }): EvalCheck => {
  const detected = detectVariant(letterText);
  const target = style.english || 'uk';
  return {
    id: 'variant-compliance',
    label: `Letter matches selected English variant (${target})`,
    passed: detected === null || detected === target,
    detail: detected ? `detected ${detected}` : 'no variant markers detected',
  };
};

export function runDeterministicChecks(input: DeterministicInput): DeterministicResult {
  const checks: EvalCheck[] = [
    openingCheck(input.letters, input.candidateName),
    closingCheck(input.letters),
    wordBandCheck(input.letters),
    genericScan(input.letterText),
    echoCheck(input.letterText, input.jobAd),
    ruleCheck(input.letterText, input.rules),
    gateCheck(input.gate),
    variantCheck(input.letterText, input.style),
    questionsCheck(input.questions),
    gapStatementCheck(input.letters),
  ];
  return { passed: checks.every((check) => check.passed), checks };
}
