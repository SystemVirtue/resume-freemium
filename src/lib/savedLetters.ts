import { Json } from '@/integrations/supabase/types';
import {
  ContextItem,
  ContextRole,
  FlagDecision,
  FlagDecisions,
  FlagKind,
  Paragraph,
  SourceRef,
  StyleSettings,
  FLAG_KIND_META,
  letterWordCount,
  migrateStyleSettings,
  newId,
} from '@/lib/coverLetter';

/**
 * Reading a saved letter back.
 *
 * Saving used to be a one-way trip: the row was written and nothing ever read
 * it. Everything needed to carry on working lives in the existing columns —
 * nothing new in the schema — so a reopened letter restores the background, the
 * ad, the appeals note, the requirements list, the extra content, the style and
 * rules, the paragraphs with their flags, and the decisions on those flags.
 *
 * Rows written before this module existed (no resume text, `history` an empty
 * array) must still open, so every read is defensive.
 */

/** Bumped when the payload shape changes; older rows stay readable. */
export const LETTER_SESSION_VERSION = 2;

/** Where the requirements list stands when a letter is reopened. */
export type SavedRequirementsStatus = 'idle' | 'ready' | 'edited' | 'stale' | 'too-thin';

/** Everything a cover letter session needs in order to be picked up again. */
export interface LetterSession {
  title: string;
  resumeId: string | null;
  /** The exact background text the letter was written from. */
  resumeText: string;
  job: string;
  appeals: string;
  contextItems: ContextItem[];
  style: StyleSettings;
  rules: string;
  requirements: string[];
  /** The ad text the current requirements list was extracted from. */
  requirementsSource: string;
  requirementsStatus: SavedRequirementsStatus;
  paragraphs: Paragraph[];
  decisions: FlagDecisions;
  /** Every change instruction applied so far — revisions satisfy the whole set. */
  instructions: string[];
  notices: string[];
  wouldTouch: string[];
  review: string;
  openQuestions: string[];
  ruleOffersDismissed: FlagKind[];
}

export const emptySession = (): LetterSession => ({
  title: 'Untitled cover letter',
  resumeId: null,
  resumeText: '',
  job: '',
  appeals: '',
  contextItems: [],
  style: { custom: '', english: 'uk' },
  rules: '',
  requirements: [],
  requirementsSource: '',
  requirementsStatus: 'idle',
  paragraphs: [],
  decisions: {},
  instructions: [],
  notices: [],
  wouldTouch: [],
  review: '',
  openQuestions: [],
  ruleOffersDismissed: [],
});

/** The columns a saved letter is written to and read from. */
export interface SavedLetterRow {
  id: string;
  title: string;
  job_description: string | null;
  resume_id: string | null;
  context_items: unknown;
  style_settings: unknown;
  paragraphs: unknown;
  history: unknown;
  updated_at: string;
  created_at?: string | null;
}

export interface LetterSavePayload {
  title: string;
  resume_id: string | null;
  job_description: string;
  job_source: string;
  context_items: Json;
  style_settings: Json;
  paragraphs: Json;
  history: Json;
}

/** A row boiled down for the list of saved letters. */
export interface SavedLetterSummary {
  id: string;
  title: string;
  updatedAt: string;
  words: number;
  paragraphs: number;
  /** First line of the ad, so a title alone is not the only handle on a letter. */
  preview: string;
}

/** A row read as an object, whatever the column actually held. */
type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};

const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((s) => text(s).trim())
        .filter(Boolean)
    : [];

const ROLES: ContextRole[] = ['style_only', 'research', 'background'];

export function sanitiseContextItems(raw: unknown): ContextItem[] {
  const source = Array.isArray(raw) ? raw : [];
  return source
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const item = c as Raw;
      return {
        id: text(item.id) || newId(),
        label: text(item.label),
        text: text(item.text),
        role: ROLES.includes(item.role as ContextRole) ? (item.role as ContextRole) : 'background',
      };
    })
    .filter((c) => c.text.trim().length > 0 || c.label.trim().length > 0);
}

function sanitiseSources(raw: unknown): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (typeof s === 'string') return s.trim() ? { claim: '', source: s.trim() } : null;
      if (!s || typeof s !== 'object') return null;
      const entry = s as Raw;
      const claim = text(entry.claim).trim();
      const source = text(entry.source ?? entry.quote).trim();
      return source || claim ? { claim, source } : null;
    })
    .filter(Boolean) as SourceRef[];
}

function sanitiseRuleFlags(raw: unknown): { rule: string; fragment: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (typeof r === 'string') return r.trim() ? { rule: r.trim(), fragment: '' } : null;
      if (!r || typeof r !== 'object') return null;
      const entry = r as Raw;
      const rule = text(entry.rule).trim();
      const fragment = text(entry.fragment).trim();
      return rule || fragment ? { rule, fragment } : null;
    })
    .filter(Boolean) as { rule: string; fragment: string }[];
}

const STRING_FLAGS = [
  'unsupported',
  'misattributed',
  'echoes',
  'repetition',
  'scope',
  'employer',
  'pivot',
  'unresolved',
  'needsInput',
] as const;

/** Paragraphs come back exactly as the editor left them: text, lock, flags and sources. */
export function sanitiseParagraphs(raw: unknown): Paragraph[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object')
    .map((p) => {
      const entry = p as Raw;
      // A paragraph is only a paragraph if it carries text, even empty text: a row
      // holding something else in this column is not worth showing.
      if (!Object.prototype.hasOwnProperty.call(entry, 'text')) return null;
      const flagFields: Partial<Record<(typeof STRING_FLAGS)[number], string[]>> = {};
      for (const key of STRING_FLAGS) {
        const flags = list(entry[key]);
        if (flags.length) flagFields[key] = flags;
      }
      const sources = sanitiseSources(entry.sources);
      const rules = sanitiseRuleFlags(entry.ruleFlags);
      const paragraph: Paragraph = {
        id: text(entry.id) || newId(),
        text: text(entry.text).trim(),
        locked: Boolean(entry.locked),
        ...flagFields,
        ...(sources.length ? { sources } : {}),
        ...(rules.length ? { ruleFlags: rules } : {}),
      };
      return paragraph;
    })
    .filter(Boolean) as Paragraph[];
}

export function sanitiseDecisions(raw: unknown): FlagDecisions {
  const out: FlagDecisions = {};
  for (const [id, value] of Object.entries(obj(raw))) {
    if (value === 'approved' || value === 'dismissed') out[id] = value as FlagDecision;
  }
  return out;
}

function sanitiseKinds(raw: unknown): FlagKind[] {
  const known = Object.keys(FLAG_KIND_META) as FlagKind[];
  return list(raw).filter((k): k is FlagKind => known.includes(k as FlagKind));
}

const STATUSES: SavedRequirementsStatus[] = ['idle', 'ready', 'edited', 'stale', 'too-thin'];

/**
 * The columns are typed as the database's Json. Our structures are JSON in every
 * sense that matters; TypeScript just cannot give an interface an index signature.
 */
const asJson = (value: unknown): Json => value as Json;

/** Split a whole session across the columns that hold it. */
export function sessionToPayload(session: LetterSession): LetterSavePayload {
  return {
    title: session.title.trim() || 'Untitled cover letter',
    resume_id: session.resumeId,
    job_description: session.job,
    job_source: 'crafter',
    context_items: asJson({
      version: LETTER_SESSION_VERSION,
      resumeText: session.resumeText,
      appeals: session.appeals,
      items: session.contextItems,
      requirements: session.requirements,
      requirementsSource: session.requirementsSource,
      requirementsStatus: session.requirementsStatus,
      openQuestions: session.openQuestions,
    }),
    style_settings: asJson({
      custom: session.style.custom,
      english: session.style.english === 'us' ? 'us' : 'uk',
      rules: session.rules,
      flagDecisions: session.decisions,
    }),
    paragraphs: asJson(session.paragraphs),
    history: asJson({
      version: LETTER_SESSION_VERSION,
      instructions: session.instructions,
      notices: session.notices,
      wouldTouch: session.wouldTouch,
      review: session.review,
      ruleOffersDismissed: session.ruleOffersDismissed,
    }),
  };
}

/**
 * Rebuild a session from a saved row. Anything missing — a row written before
 * this existed, a hand-edited row, a column that never got filled in — falls
 * back to a sane default rather than throwing.
 */
export function sessionFromRow(row: Partial<SavedLetterRow> | null | undefined): LetterSession {
  const base = emptySession();
  if (!row) return base;

  const ctx = obj(row.context_items);
  const style = obj(row.style_settings);
  const history = obj(row.history);
  const requirements = list(ctx.requirements);
  const requirementsSource = text(ctx.requirementsSource);
  const stored = ctx.requirementsStatus as SavedRequirementsStatus;
  const status = STATUSES.includes(stored)
    ? stored
    : requirements.length
      ? 'ready'
      : 'idle';

  const paragraphs = sanitiseParagraphs(row.paragraphs);

  return {
    title: text(row.title).trim() || base.title,
    resumeId: text(row.resume_id) || null,
    // Older rows predate the background being stored: that is what resume_id is for.
    resumeText: text(ctx.resumeText),
    job: text(row.job_description),
    appeals: text(ctx.appeals),
    contextItems: sanitiseContextItems(ctx.items),
    style: migrateStyleSettings(style),
    // Rules are a standing setting, so an empty one must not wipe the field.
    rules: text(style.rules),
    requirements,
    requirementsSource: requirementsSource || text(row.job_description),
    requirementsStatus: status,
    paragraphs,
    decisions: sanitiseDecisions(style.flagDecisions),
    instructions: list(history.instructions),
    notices: list(history.notices),
    wouldTouch: list(history.wouldTouch),
    review: text(history.review),
    openQuestions: list(ctx.openQuestions),
    ruleOffersDismissed: sanitiseKinds(history.ruleOffersDismissed),
  };
}

/** What the list of saved letters shows for one row. */
export function savedLetterSummary(row: Partial<SavedLetterRow>): SavedLetterSummary {
  const paragraphs = sanitiseParagraphs(row.paragraphs);
  const job = text(row.job_description).replace(/\s+/g, ' ').trim();
  return {
    id: text(row.id),
    title: text(row.title).trim() || 'Untitled cover letter',
    updatedAt: text(row.updated_at),
    words: paragraphs.length ? letterWordCount(paragraphs) : 0,
    paragraphs: paragraphs.length,
    preview: job.length > 120 ? `${job.slice(0, 117).trimEnd()}…` : job,
  };
}

/**
 * The one a returning user most likely wants: the most recently updated letter,
 * but only when it actually has a draft to carry on with.
 */
export function mostRecentDraft(rows: Partial<SavedLetterRow>[]): SavedLetterRow | null {
  const withDraft = rows.filter((r) => sanitiseParagraphs(r.paragraphs).length > 0);
  if (!withDraft.length) return null;
  return [...withDraft].sort(
    (a, b) => new Date(text(b.updated_at)).getTime() - new Date(text(a.updated_at)).getTime(),
  )[0] as SavedLetterRow;
}
