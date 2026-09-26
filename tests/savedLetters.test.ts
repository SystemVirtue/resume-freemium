import { describe, expect, it } from 'vitest';
import { FlagKind } from '@/lib/coverLetter';
import {
  LETTER_SESSION_VERSION,
  SavedLetterRow,
  emptySession,
  mostRecentDraft,
  sanitiseDecisions,
  sanitiseParagraphs,
  savedLetterSummary,
  sessionFromRow,
  sessionToPayload,
} from '@/lib/savedLetters';

/** A fully worked letter, as the editor would hold it. */
const session = () => ({
  ...emptySession(),
  title: 'Operations manager, Brightfold',
  resumeId: 'resume-1',
  resumeText: 'Name: Alex Doyle\nExperience:\n- Operations Manager at Brightfold',
  job: 'Brightfold is hiring an operations manager to run three depots.',
  appeals: 'I want to work at a company that runs its own logistics.',
  contextItems: [
    { id: 'c1', label: 'Old letter', text: 'I like small teams.', role: 'style_only' as const },
    { id: 'c2', label: 'Reference', text: 'They opened a fourth depot.', role: 'research' as const },
  ],
  style: { custom: 'plain and direct', english: 'us' as const },
  rules: 'no em dashes\nkeep it under 350 words',
  requirements: ['Runs several depots at once', 'Leads a team of dispatchers'],
  requirementsSource: 'Brightfold is hiring an operations manager to run three depots.',
  requirementsStatus: 'edited' as const,
  paragraphs: [
    {
      id: 'p1',
      text: 'Dear hiring manager,',
      locked: true,
    },
    {
      id: 'p2',
      text: 'I ran three depots at Northwind.',
      locked: false,
      unsupported: ['three depots'],
      misattributed: ['depot expansion - belongs to: Northwind'],
      echoes: ['runs its own logistics'],
      scope: ['ran three depots'],
      employer: ['Brightfold runs its own logistics'],
      pivot: ['what I like about the work is that it is public'],
      unresolved: ['keeping projects moving'],
      needsInput: ['How many depots did you cover?'],
      repetition: ['"depots" repeats within a few words'],
      ruleFlags: [{ rule: 'no em dashes', fragment: 'em — dash' }],
      sources: [{ claim: 'I ran three depots', source: 'Operations Manager at Northwind' }],
    },
  ],
  decisions: { 'scope:ran three depots': 'dismissed' as const, 'echo:logistics': 'approved' as const },
  instructions: ['make it shorter', 'lead with the depot example'],
  notices: ['Your rules mention US English, but the selector is UK.'],
  wouldTouch: ['Dear hiring manager,'],
  openQuestions: ['How many depots did you cover?'],
  ruleOffersDismissed: ['employer' as const, 'not-a-kind' as unknown as FlagKind],
});

const asRow = (over: Partial<SavedLetterRow> = {}): SavedLetterRow => ({
  id: 'letter-1',
  title: 'Operations manager, Brightfold',
  job_description: 'Brightfold is hiring an operations manager to run three depots.',
  resume_id: 'resume-1',
  context_items: {},
  style_settings: {},
  paragraphs: [],
  history: {},
  updated_at: '2026-09-23T09:00:00.000Z',
  created_at: '2026-09-22T09:00:00.000Z',
  ...over,
});

describe('a saved letter round trip', () => {
  it('writes a whole session into the existing columns', () => {
    const payload = sessionToPayload(session());
    expect(payload.title).toBe('Operations manager, Brightfold');
    expect(payload.resume_id).toBe('resume-1');
    expect(payload.job_source).toBe('crafter');
    const context = payload.context_items as Record<string, unknown>;
    expect(context.version).toBe(LETTER_SESSION_VERSION);
    expect(String(context.resumeText)).toContain('Alex Doyle');
    const history = payload.history as Record<string, unknown>;
    expect(history.instructions).toEqual(['make it shorter', 'lead with the depot example']);
  });

  it('reads back everything a returning user needs', () => {
    const payload = sessionToPayload(session());
    const restored = sessionFromRow(asRow({ ...payload, id: 'letter-1' }));
    const original = session();

    expect(restored.title).toBe(original.title);
    expect(restored.resumeId).toBe(original.resumeId);
    expect(restored.resumeText).toBe(original.resumeText);
    expect(restored.job).toBe(original.job);
    expect(restored.appeals).toBe(original.appeals);
    expect(restored.contextItems).toEqual(original.contextItems);
    expect(restored.style).toEqual(original.style);
    expect(restored.rules).toBe(original.rules);
    expect(restored.requirements).toEqual(original.requirements);
    expect(restored.requirementsStatus).toBe('edited');
    expect(restored.requirementsSource).toBe(original.requirementsSource);
    expect(restored.decisions).toEqual(original.decisions);
    expect(restored.instructions).toEqual(original.instructions);
    expect(restored.notices).toEqual(original.notices);
    expect(restored.wouldTouch).toEqual(original.wouldTouch);
    expect(restored.openQuestions).toEqual(original.openQuestions);
    expect(restored.ruleOffersDismissed).toEqual(['employer']);
  });

  it('brings paragraphs back with their lock, flags and sources', () => {
    const payload = sessionToPayload(session());
    const restored = sessionFromRow(asRow(payload));
    expect(restored.paragraphs).toHaveLength(2);
    const [first, second] = restored.paragraphs;
    expect(first.locked).toBe(true);
    expect(second.text).toBe('I ran three depots at Northwind.');
    expect(second.locked).toBe(false);
    expect(second.sources).toEqual([{ claim: 'I ran three depots', source: 'Operations Manager at Northwind' }]);
    expect(second.unsupported).toEqual(['three depots']);
    expect(second.misattributed).toEqual(['depot expansion - belongs to: Northwind']);
    expect(second.ruleFlags).toEqual([{ rule: 'no em dashes', fragment: 'em — dash' }]);
    expect(second.needsInput).toEqual(['How many depots did you cover?']);
  });

  it('keeps the rules field out of the write when a letter has none', () => {
    const bare = { ...session(), rules: '' };
    const restored = sessionFromRow(asRow(sessionToPayload(bare)));
    // An empty rules column must not be read as "the user has no rules".
    expect(restored.rules).toBe('');
  });
});

describe('rows written before reopening existed', () => {
  const legacy = asRow({
    title: null as unknown as string,
    job_description: 'A creative director role at Studio Vale.',
    resume_id: 'resume-7',
    context_items: {
      items: [{ id: 'x', label: 'Past letter', text: 'I like making things.', role: 'style_only' }],
      requirements: ['Leads a studio team', 'Directs brand campaigns'],
      appeals: '',
      openQuestions: [],
    },
    style_settings: { chips: ['warm', 'plain'], custom: 'no cliches', english: 'us', rules: 'keep it under 300 words' },
    paragraphs: [{ id: 'a', text: 'I led a brand refresh at Vale.', locked: false }],
    history: [],
  });

  it('still opens, with the requirements ready and the chips folded into the tone field', () => {
    const restored = sessionFromRow(legacy);
    expect(restored.title).toBe('Untitled cover letter');
    expect(restored.requirements).toEqual(['Leads a studio team', 'Directs brand campaigns']);
    expect(restored.requirementsStatus).toBe('ready');
    expect(restored.requirementsSource).toBe(legacy.job_description);
    expect(restored.style).toEqual({ custom: 'no cliches. warm, plain', english: 'us' });
    expect(restored.rules).toBe('keep it under 300 words');
    expect(restored.paragraphs).toHaveLength(1);
    // Background predates being stored: the editor rebuilds it from resume_id.
    expect(restored.resumeText).toBe('');
  });

  it('opens an untouched, empty row without complaining', () => {
    const restored = sessionFromRow(asRow({ title: '', job_description: null, resume_id: null }));
    expect(restored).toEqual(emptySession());
  });

  it('survives junk in every column', () => {
    const junk = sessionFromRow(
      asRow({
        title: '',
        context_items: [],
        style_settings: 'not an object',
        paragraphs: [null, 42, {}, 'a string', { text: 'Real paragraph' }],
        history: [1, 2, 3],
      }),
    );
    expect(junk.title).toBe('Untitled cover letter');
    expect(junk.style).toEqual({ custom: '', english: 'uk' });
    expect(junk.paragraphs).toHaveLength(1);
    expect(junk.paragraphs[0].text).toBe('Real paragraph');
    expect(junk.instructions).toEqual([]);
    expect(sessionFromRow(null)).toEqual(emptySession());
  });

  it('drops decisions and context roles it does not understand', () => {
    expect(sanitiseDecisions({ a: 'approved', b: 'dismissed', c: 'maybe', d: 1 })).toEqual({
      a: 'approved',
      b: 'dismissed',
    });
    const items = sessionFromRow(
      asRow({ context_items: { items: [{ label: 'X', text: 'Y', role: 'nonsense' }] } }),
    ).contextItems;
    expect(items[0].role).toBe('background');
    expect(items[0].id).toBeTruthy();
  });

  it('gives every paragraph an id even when the row never had one', () => {
    const [p] = sanitiseParagraphs([{ text: 'A paragraph with no id.', locked: false }]);
    expect(p.id).toBeTruthy();
  });
});

describe('the list of saved letters', () => {
  it('summarises a row for the picker', () => {
    const s = savedLetterSummary(
      asRow({
        title: 'Ops manager',
        job_description: 'x'.repeat(300),
        paragraphs: [{ id: 'a', text: 'One two three four five.', locked: false }],
      }),
    );
    expect(s.title).toBe('Ops manager');
    expect(s.words).toBe(5);
    expect(s.paragraphs).toBe(1);
    expect(s.preview.length).toBeLessThanOrEqual(120);
    expect(s.preview.endsWith('…')).toBe(true);
  });

  it('handles a row that was saved before any draft was written', () => {
    const s = savedLetterSummary(asRow({ title: '', paragraphs: [] }));
    expect(s.title).toBe('Untitled cover letter');
    expect(s.paragraphs).toBe(0);
    expect(s.words).toBe(0);
  });

  it('offers the most recent letter that actually has a draft', () => {
    const older = asRow({ id: 'old', updated_at: '2026-09-01T00:00:00.000Z', paragraphs: [{ id: 'p', text: 'A draft.', locked: false }] });
    const newerEmpty = asRow({ id: 'new', updated_at: '2026-09-23T00:00:00.000Z', paragraphs: [] });
    expect(mostRecentDraft([newerEmpty, older])?.id).toBe('old');
    expect(mostRecentDraft([newerEmpty])).toBeNull();
  });
});
