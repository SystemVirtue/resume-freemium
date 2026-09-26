/**
 * Calibrating the yardstick.
 *
 * The live corpus needs a model and a key, and it reports differences in a
 * penalty score. A number nobody has calibrated is worthless: if the measurement
 * cannot tell a tailored letter from a generic one, or from a copy of the resume,
 * then a lower average in the report means nothing.
 *
 * So this file takes one real corpus case and feeds the measuring half of the
 * harness hand-written letters — one tailored, one generic, one that is the
 * resume, one that is the ad — plus injected validator failures. Nothing here
 * calls a model, and nothing here judges prose quality. It asserts only that the
 * instrument sees each failure class, in the right direction, and that the gate
 * reaches the same conclusion from its own side.
 */
import { describe, expect, it } from 'vitest';
import { CORPUS, type CorpusCase } from './corpus/cases';
import { measure, planCoverage, GENERIC, type Sample } from '../scripts/eval-corpus';
import type { EvidenceMap } from '@/lib/coverLetterPlan';
import { corpusById } from './corpus/cases';
import { qualityGate } from '@/lib/coverLetterGate';
import { FAILURE_CODES, type Critique, type FailureCode } from '@/lib/coverLetterCritic';
import { normaliseModelText, type Paragraph } from '@/lib/coverLetter';

const corpusCase = CORPUS.find((c) => c.id === 'technical') as CorpusCase;

/**
 * A letter written to this ad: one named employer, the requirement's own work
 * described in the candidate's terms, a result, and a reason for applying that
 * comes from the candidate rather than from the employer's marketing.
 */
const TAILORED = `I am applying for the Senior Backend Engineer role on the payments platform. I have spent eight years on payment and data services in Python and Go, most recently at Ledgerly, where I look after the service that settles transactions for our retail partners and chair the weekly incident review.

The work you describe — designing a service from schema through deployment, then living with it on call — is work I already do. At Ledgerly I designed the settlement schema and its migrations, shipped the service with Terraform onto AWS, and carried the on-call rota for it. When reconciliation started failing for a subset of brands, I traced it to a timezone assumption in the retry logic and shipped a fix with a test that has since caught two regressions. Holding the pager for a service that cannot fail quietly has made me careful about precisely the things this role is careful about.

Mentoring is the part of this role I would most look forward to. At Brightfold I moved forty endpoints off a monolith and paired with two engineers through the change; both later owned migrations of their own. Reviewing code is a daily habit for me rather than a ceremony, and I would rather explain a design decision to a mid-level engineer than quietly fix it myself.

Settling for two hundred retail brands is close to the scale I work at now, so the reliability problem here will look familiar rather than novel. I am in Manchester and happy with the hybrid pattern you describe. I would be glad to walk through how I approach schema design on a service where a silent failure is not survivable.`;

/** Could be posted to any employer, in any role, unchanged. */
const GENERIC_LETTER = `I am writing to express my strong interest in the Senior Backend Engineer position. As a results-driven and detail-oriented professional with a proven track record in fast-paced environments, I am confident that I would hit the ground running as a valuable team player from day one.

I am a passionate problem solver who thinks outside the box, and I thrive when given the opportunity to make a real impact. Throughout my career I have developed excellent communication skills and the ability to work both independently and as part of a collaborative team. I am a self-starter who takes ownership of my work and consistently delivers to a high standard.

I believe my background demonstrates that I am a strategic thinker and a strong leader who would be a real asset to your organisation. I am excited about the opportunity to bring my dynamic and multifaceted skill set to your team.

Thank you for considering my application. I look forward to the opportunity to discuss my qualifications further.`;

/** The letter is the resume, reformatted. */
const RESUME_COPY = corpusCase.resume;

/** The letter is the advertisement, sent back. */
const AD_COPY = corpusCase.job;

/**
 * The tailored letter, padded past the length band. Every sentence is
 * reasonable; there are simply too many of them, which is the failure class the
 * length check exists to catch.
 */
const PADDED = `${TAILORED}

I would also mention that I have worked with a range of teams over the years, in companies of different sizes and with different ways of working. Each environment taught me something about how to communicate, how to plan work and how to deal with the unexpected. I have found that most problems are easier to solve once you understand the constraints the other people in the room are working under, and I try to bring that to every team I join. There is a great deal to learn about an unfamiliar codebase, and I am looking forward to that part of the work as well as the parts I already know how to do.

Beyond the technical work, I care about how a team decides things. I have seen projects go well when the person closest to the problem is allowed to propose the solution, and go badly when decisions are made far from the detail. I would want to understand how your team settles questions like that, and where the on-call engineer's judgement is trusted and where it is checked. I would also want to understand what happens after an incident: whether the response is a blameless review that changes something, or a note in a document that nobody reads again. Those things tell you more about a team than any description of its stack.`;

const splitParagraphs = (letter: string, flags?: Partial<Paragraph>[]): Paragraph[] =>
  normaliseModelText(letter)
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `p${i}`, text, locked: false, ...(flags?.[i] || {}) }));

/** Score one letter exactly the way the live harness scores a generation. */
function score(
  letter: string,
  extra: { failures?: Partial<Record<FailureCode, number>>; verdict?: Sample['verdict'] } = {},
): Sample {
  return measure({
    caseId: corpusCase.id,
    mode: 'pipeline',
    letter,
    c: corpusCase,
    verdict: extra.verdict ?? null,
    failures: extra.failures ?? {},
    questions: 0,
    repaired: false,
  });
}

const penalty = (letter: string, extra?: Parameters<typeof score>[1]) => score(letter, extra).penalty;

const finding = (code: FailureCode, severity: 'must-fix' | 'should-fix' = 'must-fix'): Critique => ({
  findings: [
    {
      code,
      paragraph: 0,
      passage: 'a passage',
      problem: 'a problem',
      fix: 'a fix',
      severity,
    },
  ],
  keep: [],
  summary: '',
});

describe('the eval yardstick', () => {
  it('reads a tailored letter as clean', () => {
    const s = score(TAILORED);
    expect(s.words).toBeGreaterThanOrEqual(250);
    expect(s.words).toBeLessThanOrEqual(400);
    expect(s.lengthOk).toBe(true);
    expect(s.generic).toBe(0);
    expect(s.adEcho).toBeLessThan(0.1);
    expect(s.resumeEcho).toBeLessThan(0.1);
  });

  it('scores every failure class worse than the tailored letter', () => {
    const clean = penalty(TAILORED);
    const generic = penalty(GENERIC_LETTER);
    const resumeCopy = penalty(RESUME_COPY);
    const adCopy = penalty(AD_COPY);
    const padded = penalty(PADDED);
    const unsupported = penalty(TAILORED, {
      failures: { UNSUPPORTED_CLAIM: 1 },
      verdict: 'regenerate',
    });

    for (const [name, p] of Object.entries({ generic, resumeCopy, adCopy, padded, unsupported })) {
      expect(p, `${name} should score worse than a tailored letter`).toBeGreaterThan(clean);
    }
    // A wholly generic letter trips many faults at once, so it outweighs a
    // tailored letter carrying a single bad claim. The categories are compared
    // one-for-one below, which is what a weight actually means.
    expect(generic).toBeGreaterThan(unsupported);
  });

  it('detects each failure through its own signal, not a general penumbra', () => {
    const clean = score(TAILORED);
    const generic = score(GENERIC_LETTER);
    const resumeCopy = score(RESUME_COPY);
    const adCopy = score(AD_COPY);
    const padded = score(PADDED);

    expect(generic.generic).toBeGreaterThanOrEqual(5);
    expect(GENERIC.filter((g) => TAILORED.toLowerCase().includes(g))).toEqual([]);

    // Copying the resume shows up as resume echo and not as ad echo, and vice versa.
    expect(resumeCopy.resumeEcho).toBeGreaterThan(0.5);
    expect(resumeCopy.adEcho).toBeLessThan(0.1);
    expect(adCopy.adEcho).toBeGreaterThan(0.5);
    expect(adCopy.resumeEcho).toBeLessThan(0.1);

    expect(padded.words, 'the padded letter must leave the length band').toBeGreaterThan(400);
    expect(padded.lengthOk).toBe(false);
    expect(clean.lengthOk).toBe(true);
  });

  /**
   * The old coverage measure counted the employer's vocabulary, so the advertisement
   * scored 100% and the letter was rewarded for the wording the echo check penalises:
   * the two numbers pulled against each other. Comparing the letter's words with the
   * plan's does not help either, because the evidence for a relevant requirement is
   * bound to share vocabulary with the ad. So plan coverage counts the validator's
   * trace instead — the background lines each claim was found to rest on — and an
   * echo produces no trace at all.
   */
  it('measures the plan\u2019s evidence through the trace, not the wording', () => {
    const map: EvidenceMap = {
      purpose: 'Own the reconciliation service.',
      seniority: 'senior',
      priorities: [],
      terminology: [],
      whyThisRole: [],
      entries: [
        {
          requirement: 'Designs and builds backend services end to end',
          need: '',
          evidence: 'owns the reconciliation service, writes the schema migrations',
          strength: 'strong',
          source: 'Ledgerly',
          claim:
            'I own the reconciliation service, from its schema through to what happens when it goes wrong.',
          gap: '',
        },
        {
          requirement: 'Stays on call to keep production reliable',
          need: '',
          evidence: '',
          strength: 'none',
          source: '',
          claim: '',
          gap: 'Do you carry the pager?',
        },
      ],
    };

    // The validator traced the letter's claims back to that evidence.
    const traced = [
      {
        claim: 'I own the reconciliation service and write its schema migrations',
        source: 'owns the reconciliation service, writes the schema migrations',
      },
      { claim: 'I designed the settlement schema', source: 'writes the schema migrations' },
    ];
    // Requirements the plan found no evidence for are not scored at all: leaving them
    // out is the correct behaviour, so covering them would be the fault, not the goal.
    expect(planCoverage(map, traced)).toBe(1);

    // A trace that came from the advertisement instead of the candidate's material.
    const echoed = [
      {
        claim: 'We run a service that processes reconciliation for 200 retail brands',
        source: 'Senior Backend Engineer — payments platform, hybrid in Manchester',
      },
    ];
    expect(planCoverage(map, echoed)).toBe(0);

    // A letter that used unrelated material draws on nothing the plan selected.
    expect(planCoverage(map, [{ claim: 'I taught maths for eight years', source: 'St Aiden\u2019s Academy' }])).toBe(0);

    // Nothing traced at all, and nothing to measure without a plan.
    expect(planCoverage(map, [])).toBe(0);
    expect(planCoverage(null, traced)).toBeNull();
  });

  it('orders the failure categories, one finding for one finding', () => {
    // The same letter, so the only difference is the category and its weight.
    const on = (failures: Partial<Record<FailureCode, number>>) => penalty(TAILORED, { failures });
    const clean = penalty(TAILORED);

    expect(on({ UNSUPPORTED_CLAIM: 1 })).toBeGreaterThan(on({ GENERICITY: 1 }));
    expect(on({ GENERICITY: 1 })).toBeGreaterThan(on({ WEAK_OPENING: 1 }));
    expect(on({ WEAK_OPENING: 1 })).toBeGreaterThan(on({ REPETITION: 1 }));
    expect(on({ REPETITION: 1 })).toBeGreaterThan(clean);

    // Every category in the taxonomy costs something, so a finding can never be
    // reported and then ignored by the number the report is built on.
    const free: FailureCode[] = ['MISSING_INFORMATION', 'GAP_STATEMENT'];
    for (const code of FAILURE_CODES) {
      if (free.includes(code)) continue;
      expect(on({ [code]: 1 }), `${code} should cost something`).toBeGreaterThan(clean);
    }

    // Except the two that are not defects. A question only the candidate can answer
    // is reported on its own line, not charged to the letter. A requirement named in
    // order to admit a gap is the honest alternative to implying cover for it, and it
    // is exactly what the old ad-echo measure punished: charging for it here would
    // rebuild the tension this code was introduced to remove.
    expect(on({ MISSING_INFORMATION: 1 })).toBe(clean);
    expect(on({ GAP_STATEMENT: 1 })).toBe(clean);
  });
});

/**
 * The cassette is the only way this pipeline runs without a key, so it is the
 * only thing standing between a prompt change and a silent break: if a stage
 * starts asking for an answer the cassette does not have, this fails loudly
 * rather than reporting a quieter number.
 */
describe('the staged pipeline runs offline from the cassette', () => {
  it('plans, writes, reviews, repairs and gates without a model', async () => {
    process.env.EVAL_CASSETTE = 'tests/fixtures/agent-cassette.json';
    const { runPipeline } = await import('../scripts/eval-corpus');

    const strong = await runPipeline(corpusById('technical'));
    expect(strong.verdict).toBe('minor');
    expect(strong.failures.UNSUPPORTED_CLAIM).toBeUndefined();
    expect(strong.repaired).toBe(false);

    // A must-fix finding has to send the letter through the repair stage, and the
    // gate then reads the review of the revision rather than of the draft.
    const changed = await runPipeline(corpusById('career-change'));
    expect(changed.repaired).toBe(true);
    expect(changed.failures.OVERCLAIMING).toBeUndefined();

    // The case the ad asks for something the background never establishes is the
    // one that must end by asking the candidate instead of guessing.
    const missing = await runPipeline(corpusById('missing-info'));
    expect(missing.verdict).toBe('needs-input');
    expect(missing.questions).toBeGreaterThan(0);
  });

  it('refuses to run a case the cassette cannot answer', async () => {
    process.env.EVAL_CASSETTE = 'tests/fixtures/agent-cassette.json';
    const { runPipeline } = await import('../scripts/eval-corpus');
    await expect(runPipeline(corpusById('executive'))).rejects.toThrow(/no answer for/);
  });
});

describe('the gate agrees with the yardstick', () => {
  it('passes the tailored letter and refuses the generic one', () => {
    const clean = qualityGate({
      paragraphs: splitParagraphs(TAILORED),
      critique: null,
      openQuestions: [],
      resume: corpusCase.resume,
    });
    expect(clean.verdict).toBe('pass');
    expect(clean.ready).toBe(true);

    const generic = qualityGate({
      paragraphs: splitParagraphs(GENERIC_LETTER),
      critique: finding('GENERICITY'),
      openQuestions: [],
      resume: corpusCase.resume,
    });
    expect(generic.verdict).toBe('regenerate');
    expect(generic.ready).toBe(false);
  });

  it('refuses a polished letter that a review says fits any employer', () => {
    const gate = qualityGate({
      paragraphs: splitParagraphs(TAILORED),
      critique: finding('GENERICITY'),
      openQuestions: [],
      resume: corpusCase.resume,
    });
    expect(gate.verdict).toBe('regenerate');
  });

  it('asks for the missing fact instead of inventing it', () => {
    const gate = qualityGate({
      paragraphs: splitParagraphs(TAILORED),
      critique: null,
      openQuestions: ['Did you personally own the enterprise accounts?'],
      resume: corpusCase.resume,
    });
    expect(gate.verdict).toBe('needs-input');
  });

  it('spots a letter that is only the resume, and only an editorial note is raised', () => {
    const gate = qualityGate({
      paragraphs: splitParagraphs(RESUME_COPY),
      critique: null,
      openQuestions: [],
      resume: corpusCase.resume,
    });
    expect(gate.verdict).not.toBe('pass');
    expect(gate.reasons.join(' ').toLowerCase()).toContain('resume');
  });
});
