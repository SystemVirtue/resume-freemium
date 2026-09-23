import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Bell,
  Download,
  FileText,
  Loader2,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Undo2,
  Wand2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAi } from '@/hooks/useAi';
import { parseJsonAnswer } from '@/lib/ai/client';
import { downloadLetterPdf } from '@/lib/letterPdf';
import {
  CRITIC_SYSTEM,
  Critique,
  FAILURE_LABELS,
  critiqueInstructions,
  critiquePrompt,
  critiqueSummaryLine,
  findingSignature,
  hasBlockingFindings,
  mustFixFindings,
  parseCritique,
  shouldFixFindings,
} from '@/lib/coverLetterCritic';
import {
  LetterPlan,
  PLAN_SYSTEM,
  STRENGTH_LABELS,
  mapCoverage,
  mapQuestions,
  evidenceMapBlock,
  parseEvidenceMap,
  planIsStale,
  planPrompt,
} from '@/lib/coverLetterPlan';
import { GATE_META, failureLine, qualityGate } from '@/lib/coverLetterGate';
import { AiAssistantButton } from '@/components/ai/AiAssistantButton';
import { ParagraphCard } from './ParagraphCard';
import { SavedLetters } from './SavedLetters';
import { SourceInput } from './SourceInput';
import { ContextItemList } from './ContextItemList';
import { RequirementsEditor, RequirementsStatus } from './RequirementsEditor';
import {
  FLAG_DECISIONS_STORAGE_KEY,
  FLAG_KIND_META,
  GROUNDING_SYSTEM,
  LETTER_SYSTEM,
  REQUIREMENTS_SYSTEM,
  RULES_STORAGE_KEY,
  ContextItem,
  Ctx,
  ENGLISH_VARIANTS,
  FlagDecision,
  FlagDecisions,
  FlagKind,
  Paragraph,
  RuleFlag,
  SourceRef,
  StyleSettings,
  approvedInstructions,
  contextBlock,
  convertVariant,
  detectVariant,
  dismissalCounts,
  dismissedFragments,
  draftPrompt,
  editPrompt,
  enforceBannedChars,
  flagParagraphOpenings,
  flagRepetition,
  groundingPrompt,
  insertPrompt,
  letterWordCount,
  lettersToText,
  mergeQuestions,
  newId,
  normaliseModelText,
  promptWithInstruction,
  requirementsPrompt,
  resumeSummary,
  rulesVariant,
  stylePrompt,
  suggestedRule,
} from '@/lib/coverLetter';
import { ResumeData } from '@/types/resume';
import {
  LetterSession,
  SavedLetterRow,
  mostRecentDraft,
  savedLetterSummary,
  sessionFromRow,
  sessionToPayload,
} from '@/lib/savedLetters';

interface SavedResume {
  id: string;
  title: string;
  content: any;
}

interface CoverLetterCrafterProps {
  onBack: () => void;
}

/** The per-paragraph grounding report returned by groundingPrompt. */
interface Grounding {
  sources: SourceRef[];
  unsupported: string[];
  misattributed: string[];
  echoes: string[];
  ruleFlags: RuleFlag[];
  scope: string[];
  employer: string[];
  pivot: string[];
  unresolved: string[];
  needsInput: string[];
}

/** Model answers may return sources/rules as strings or objects — accept both. */
const toSourceRef = (s: any): SourceRef | null => {
  if (typeof s === 'string') return s.trim() ? { claim: '', source: s.trim() } : null;
  if (s && typeof s === 'object') {
    const source = String(s.source || s.quote || '').trim();
    const claim = String(s.claim || '').trim();
    if (!source && !claim) return null;
    return { claim, source };
  }
  return null;
};

const toRuleFlag = (r: any): RuleFlag | null => {
  if (typeof r === 'string') return r.trim() ? { rule: r.trim(), fragment: '' } : null;
  if (r && typeof r === 'object') {
    const rule = String(r.rule || '').trim();
    const fragment = String(r.fragment || '').trim();
    if (!rule && !fragment) return null;
    return { rule, fragment };
  }
  return null;
};

const strings = (v: any): string[] =>
  (Array.isArray(v) ? v : []).map((s: any) => String(s).trim()).filter(Boolean);

const cleanGrounding = (g: any): Grounding => ({
  sources: (g?.sources || []).map(toSourceRef).filter(Boolean) as SourceRef[],
  unsupported: strings(g?.unsupported),
  misattributed: strings(g?.misattributed),
  echoes: strings(g?.echoes),
  ruleFlags: (g?.rules || g?.ruleFlags || []).map(toRuleFlag).filter(Boolean) as RuleFlag[],
  scope: strings(g?.scope),
  employer: strings(g?.employer),
  pivot: strings(g?.pivot),
  unresolved: strings(g?.unresolved),
  needsInput: strings(g?.needsInput),
});

const emptyGrounding = (): Grounding => ({
  sources: [],
  unsupported: [],
  misattributed: [],
  echoes: [],
  ruleFlags: [],
  scope: [],
  employer: [],
  pivot: [],
  unresolved: [],
  needsInput: [],
});

/** No more than two "needs your input" questions reach the user per draft. */
const NEEDS_INPUT_LIMIT = 2;

const collectQuestions = (list: Paragraph[], already: string[] = []): string[] =>
  mergeQuestions(already, list.flatMap((p) => strings(p.needsInput)), NEEDS_INPUT_LIMIT);

/** How the quality gate is painted, by verdict. */
const GATE_CARD: Record<'good' | 'warning' | 'primary' | 'danger', string> = {
  good: 'border-emerald-500/50 bg-emerald-500/5',
  warning: 'border-amber-500/50 bg-amber-500/5',
  primary: 'border-primary/50 bg-primary/5',
  danger: 'border-destructive/50 bg-destructive/5',
};

/** Past letters are a guide to tone, so a suggestion becomes a sentence in the field. */
function suggestionToSentence(suggestion: string): string {
  const s = suggestion.trim().replace(/\.$/, '');
  if (!s) return '';
  const words = s.split(/\s+/).length;
  if (words > 6) return `${s}.`;
  return `Write in a ${s} tone.`;
}

function readDecisions(): FlagDecisions {
  try {
    const raw = localStorage.getItem(FLAG_DECISIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as FlagDecisions) : {};
  } catch {
    return {};
  }
}

export const CoverLetterCrafter: React.FC<CoverLetterCrafterProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { run, isBusy } = useAi();
  /** Identity, not the user object: effects must not refetch when it is rebuilt. */
  const userId = user?.id ?? null;

  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [job, setJob] = useState('');
  const [appeals, setAppeals] = useState('');
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [style, setStyle] = useState<StyleSettings>({ custom: '', english: 'uk' });

  // FIELD 1: Rules — a saved setting in its own section, pre-filled from last time.
  const [rules, setRules] = useState<string>(() => {
    try {
      return localStorage.getItem(RULES_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  // FIELD 2: Requirements — generated from the ad, editable, stale-aware.
  const [requirements, setRequirements] = useState<string[]>([]);
  const [reqStatus, setReqStatus] = useState<RequirementsStatus>('idle');
  const [reqBusy, setReqBusy] = useState(false);
  /** Snapshot of the role text the current list was generated from. */
  const reqSourceRef = useRef('');

  const [title, setTitle] = useState('Untitled cover letter');
  const [letterId, setLetterId] = useState<string | null>(null);
  /**
   * The plan: what this employer needs against what this candidate actually has.
   * Built once per ad and requirement list, then carried into every letter call.
   */
  const [plan, setPlan] = useState<LetterPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  /** The last independent review of this letter: findings, and what to keep. */
  const [critique, setCritique] = useState<Critique | null>(null);
  /**
   * Review findings the user has read and set aside. Keyed by the finding's own
   * signature, so a later review of different words cannot inherit a decision
   * made about these ones. Must-fix items cannot be set aside: they are the ones
   * that would embarrass the candidate, and they are fixed or they stay.
   */
  const [findingDecisions, setFindingDecisions] = useState<Record<string, true>>({});
  /** Style suggestions from the model, written into the tone field when tapped. */
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  /** Every instruction applied so far — revisions satisfy the whole set, not just the newest. */
  const [instructionHistory, setInstructionHistory] = useState<string[]>([]);
  /** Letter-wide notices: rule overrides, selector mismatches. Never inside the letter text. */
  const [notices, setNotices] = useState<string[]>([]);
  /** Locked paragraphs a change could not be applied to. */
  const [wouldTouch, setWouldTouch] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  /** The gate has not passed, and the user has asked for the PDF anyway. */
  const [exportOpen, setExportOpen] = useState(false);

  /** Letters read back out of the account, and the state of writing this one down. */
  const [savedLetters, setSavedLetters] = useState<SavedLetterRow[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /** The session exactly as it was last written down; null means never. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<SavedLetterRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedLetterRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  /** One write at a time: the write in flight, if any. */
  const savingRef = useRef<Promise<boolean> | null>(null);
  /** Set while a saved letter is being restored, so the restore itself is not an edit. */
  const restoredRef = useRef(false);
  /** Always the newest save, for the debounced auto-save to call. */
  const saveRef = useRef<(options?: { silent?: boolean }) => Promise<boolean>>(async () => false);

  /** Approve/dismiss decisions, keyed by flag signature so they survive revisions. */
  const [decisions, setDecisions] = useState<FlagDecisions>(readDecisions);
  /** Offered rule lines the user has waved away. */
  const [ruleOffersDismissed, setRuleOffersDismissed] = useState<FlagKind[]>([]);
  /** Questions only the user can answer: the question in the box, and the outstanding ones. */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);

  // Undo/redo over immutable paragraph snapshots.
  const [history, setHistory] = useState<Paragraph[][]>([[]]);
  const [cursor, setCursor] = useState(0);
  const paragraphs = history[cursor];

  const commit = useCallback(
    (next: Paragraph[]) => {
      setHistory((h) => [...h.slice(0, cursor + 1), next]);
      setCursor((c) => c + 1);
    },
    [cursor],
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .from('resumes')
      .select('id,title,content')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setSavedResumes(data || []));
  }, [user]);

  const ctx: Ctx = useMemo(
    () => ({
      resume: resumeText.slice(0, 6000),
      job,
      context: contextItems,
      style,
      rules,
      requirements,
      appeals,
      openQuestions,
      plan: plan?.map,
    }),
    [resumeText, job, contextItems, style, rules, requirements, appeals, openQuestions, plan],
  );

  const letterText = lettersToText(paragraphs);
  const words = useMemo(() => letterWordCount(paragraphs), [paragraphs]);

  /**
   * The whole editing session in one object, so it can be written to the account
   * and read back later. Everything a returning user needs to carry on sits here.
   */
  const session: LetterSession = useMemo(
    () => ({
      title,
      resumeId,
      resumeText,
      job,
      appeals,
      contextItems,
      style,
      rules,
      requirements,
      requirementsSource: reqSourceRef.current,
      requirementsStatus: reqStatus === 'loading' ? 'idle' : reqStatus,
      plan,
      paragraphs,
      decisions,
      instructions: instructionHistory,
      notices,
      wouldTouch,
      openQuestions,
      ruleOffersDismissed,
    }),
    [
      title,
      resumeId,
      resumeText,
      job,
      appeals,
      contextItems,
      style,
      rules,
      requirements,
      reqStatus,
      plan,
      paragraphs,
      decisions,
      instructionHistory,
      notices,
      wouldTouch,
      openQuestions,
      ruleOffersDismissed,
    ],
  );

  const sessionJson = useMemo(() => JSON.stringify(session), [session]);
  /** Anything on screen that is not what was last written down is unsaved work. */
  const dirty = paragraphs.length > 0 && sessionJson !== baseline;

  // FIELD 1: rules persist between sessions — save as the user edits them.
  useEffect(() => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, rules);
    } catch {
      /* storage unavailable */
    }
  }, [rules]);

  // Flag decisions persist across revisions and sessions.
  useEffect(() => {
    try {
      localStorage.setItem(FLAG_DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      /* storage unavailable */
    }
  }, [decisions]);

  const pickSavedResume = (r: SavedResume) => {
    setResumeId(r.id);
    try {
      setResumeText(resumeSummary(r.content as ResumeData));
    } catch {
      setResumeText('');
    }
  };

  const ready = resumeText.trim().length > 40 && job.trim().length > 40;

  /**
   * FIELD 2: generate the requirements list from the ad. Fired on commit
   * (blur or paste) of the role field — never per keystroke.
   */
  const generateRequirements = useCallback(
    async (roleText: string, force = false) => {
      const text = roleText.trim();
      // Committed text identical to what the list was built from — nothing new to read.
      if (!force && text === reqSourceRef.current && (reqStatus === 'ready' || reqStatus === 'too-thin')) {
        return;
      }
      if (text.length < 80) {
        setRequirements([]);
        setReqStatus(text.length ? 'too-thin' : 'idle');
        return;
      }
      setReqBusy(true);
      try {
        const answer = await run(
          {
            prompt: requirementsPrompt({ ...ctx, job: text }),
            system: REQUIREMENTS_SYSTEM,
            json: true,
          },
          'reading the ad',
        );
        if (!answer) return;
        const parsed = parseJsonAnswer<{ requirements?: string[]; tooThin?: boolean }>(answer);
        if (parsed?.tooThin) {
          setRequirements([]);
          setReqStatus('too-thin');
          reqSourceRef.current = text;
          return;
        }
        const list = (parsed?.requirements || []).map((r) => String(r).trim()).filter(Boolean);
        if (list.length) {
          setRequirements(list);
          setReqStatus('ready');
          reqSourceRef.current = text;
        }
      } finally {
        setReqBusy(false);
      }
    },
    [ctx, run, reqStatus],
  );

  /** Role field committed. Regenerate freely unless the user has edited the list. */
  const handleRoleCommit = (text: string) => {
    if (reqStatus === 'edited' || reqStatus === 'stale') {
      if (text.trim() && text.trim() !== reqSourceRef.current) setReqStatus('stale');
      return;
    }
    generateRequirements(text);
  };

  const refreshRequirements = () => {
    generateRequirements(job, true);
  };

  const suggestStyles = async () => {
    const text = await run({ prompt: stylePrompt(ctx), json: true }, 'styles');
    if (!text) return;
    const parsed = parseJsonAnswer<{ styles: string[] }>(text);
    if (parsed?.styles?.length) setSuggestions(parsed.styles.slice(0, 8));
  };

  /** One input, one source of truth: a suggestion becomes a sentence in the tone field. */
  const applySuggestion = (suggestion: string) => {
    const sentence = suggestionToSentence(suggestion);
    if (!sentence) return;
    setStyle((s) => {
      if (s.custom.includes(sentence)) return s;
      const custom = [s.custom.trim(), sentence].filter(Boolean).join(' ');
      return { ...s, custom };
    });
  };

  const isSuggestionApplied = (suggestion: string) => {
    const sentence = suggestionToSentence(suggestion);
    return Boolean(sentence) && style.custom.includes(sentence);
  };

  /** Notice raised in code when the rules and the variant selector disagree. The selector wins. */
  const variantMismatchNotice = useCallback((): string[] => {
    const rv = rulesVariant(rules);
    const sel = style.english || 'uk';
    if (!rv || rv === sel) return [];
    const name = (v: string) => ENGLISH_VARIANTS.find((x) => x.id === v)?.label || v;
    return [
      `Your rules mention ${name(rv)}, but the English variant selector is set to ${name(sel)}. The selector was applied — adjust either one if that is not what you want.`,
    ];
  }, [rules, style.english]);

  /**
   * Enforce in code what code can enforce, on every paragraph (locked included):
   * punctuation normalisation, the user's banned characters, and the selected
   * English variant.
   */
  const enforce = useCallback(
    (raw: string | null): string | null => {
      if (!raw) return null;
      let out = normaliseModelText(raw);
      out = enforceBannedChars(out, rules);
      const target = style.english || 'uk';
      const current = detectVariant(out);
      if (current && current !== target) out = convertVariant(out, target);
      return out;
    },
    [rules, style.english],
  );

  /**
   * Post-generation passes, in code not the prompt: banned characters, hyphens,
   * English variant, and repetition flags (flagged, never auto-corrected).
   */
  const postProcess = useCallback(
    (list: Paragraph[]): Paragraph[] => {
      const processed = list.map((p) => ({ ...p, text: enforce(p.text) ?? p.text }));
      const openings = flagParagraphOpenings(processed.map((p) => p.text));
      return processed.map((p, i) => ({
        ...p,
        repetition: [...flagRepetition(p.text), ...(openings[i] || [])],
      }));
    },
    [enforce],
  );

  /**
   * One small extra call per draft/edit: trace each claim back to the resume
   * and extra background, and flag what cannot be traced, is misattributed, is
   * bigger than its source, describes the employer, or does not finish its point.
   */
  const ground = useCallback(
    async (base: Paragraph[], useCtx: Ctx = ctx): Promise<Paragraph[]> => {
      if (!base.length) return base;
      const text = await run(
        { prompt: groundingPrompt(useCtx, base.map((p) => p.text)), system: GROUNDING_SYSTEM, json: true },
        'checking sources',
      );
      if (!text) return base;
      const parsed = parseJsonAnswer<{ paragraphs: any[] }>(text);
      const list = parsed?.paragraphs;
      if (!Array.isArray(list)) return base;
      return base.map((p, i) => ({ ...p, ...cleanGrounding(list[i]) }));
    },
    [ctx, run],
  );

  /**
   * The planning stage. It runs once per ad and requirement list, not per draft:
   * the letter can be rewritten all afternoon without re-planning what evidence
   * belongs in it, and the reviewer needs the same map the writer used.
   */
  const buildPlan = useCallback(
    async (force = false): Promise<LetterPlan | null> => {
      if (!ready) return null;
      if (!force && plan && !planIsStale(plan, job, requirements)) return plan;
      setPlanBusy(true);
      try {
        const text = await run(
          {
            prompt: planPrompt({
              // The planner reads exactly what the writer will read, minus its own map.
              context: contextBlock({ ...ctx, plan: undefined }),
              requirements,
            }),
            system: PLAN_SYSTEM,
            json: true,
          },
          'planning',
        );
        if (!text) return plan;
        const map = parseEvidenceMap(parseJsonAnswer<any>(text), requirements);
        if (!map) return plan;
        const next: LetterPlan = { map, source: job, requirements: [...requirements] };
        setPlan(next);
        setPlanOpen(true);
        // A gap the plan found is a question for the user, and only they can answer it.
        setOpenQuestions((prev) => mergeQuestions(prev, mapQuestions(map), NEEDS_INPUT_LIMIT));
        return next;
      } finally {
        setPlanBusy(false);
      }
    },
    [ctx, job, plan, ready, requirements, run],
  );

  /**
   * The critic: an independent, adversarial read of the letter as it stands. It
   * reports findings and never rewrites, so what the writer produced and what the
   * reviewer thinks of it stay separate in the user's hands.
   */
  const critiqueLetter = useCallback(
    async (list: Paragraph[], useCtx: Ctx = ctx): Promise<Critique | null> => {
      if (!list.length) return null;
      const text = await run(
        {
          prompt: critiquePrompt({
            context: contextBlock({ ...useCtx, plan: undefined }),
            letter: lettersToText(list),
            planBlock: useCtx.plan ? evidenceMapBlock(useCtx.plan) : '',
          }),
          system: CRITIC_SYSTEM,
          json: true,
        },
        'reviewing',
      );
      if (!text) return null;
      return parseCritique(parseJsonAnswer<any>(text));
    },
    [ctx, run],
  );

  const generate = async () => {
    const activePlan = await buildPlan();
    const draftCtx: Ctx = { ...ctx, plan: activePlan?.map };
    const text = await run(
      { prompt: draftPrompt(draftCtx), system: LETTER_SYSTEM, json: true },
      'draft',
    );
    if (!text) return;
    const parsed = parseJsonAnswer<{
      paragraphs: string[];
      notices?: string[];
      questions?: string[];
    }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    const base: Paragraph[] = list.map((t) => ({ id: newId(), text: String(t).trim(), locked: false }));
    setNotices([...(parsed?.notices || []).map(String), ...variantMismatchNotice()]);
    setWouldTouch([]);
    setCritique(null);
    setInstructionHistory([]);
    const grounded = postProcess(await ground(base, draftCtx));
    commit(grounded);
    setOpenQuestions((prev) => collectQuestions(grounded, [...prev, ...strings(parsed?.questions)]));

    // The writer is never the last word on its own work. One independent review
    // runs before the gate, and a finding that blocks the letter is repaired
    // once, automatically. Anything it finds after that is shown rather than
    // looped on: the user decides whether to fix it.
    const crit = await critiqueLetter(grounded, draftCtx);
    setCritique(crit);
    if (hasBlockingFindings(crit)) {
      const repaired = await runRevision(
        'Fix the problems the review raised.',
        critiqueInstructions(crit, 'must-fix'),
        {
          record: false,
          useCtx: draftCtx,
          label: 'repairing',
          // The draft that was just reviewed, not the previous draft on screen.
          list: grounded,
        },
      );
      if (repaired) {
        // The findings describe the letter as it was. A fresh review is the only
        // honest way to know whether the repair worked, and a stale review would
        // hold the gate red for a problem that no longer exists.
        setCritique(null);
        setNotices((prev) => [
          ...prev,
          'The review raised findings that had to be repaired, and they were. Run the review again to check the result.',
        ]);
      }
    }
  };

  const editParagraph = async (index: number, mode: 'rephrase' | 'regenerate') => {
    const text = await run(
      {
        prompt: editPrompt(
          ctx,
          mode,
          paragraphs[index].text,
          letterText,
          dismissedFragments(paragraphs, decisions),
        ),
        system: LETTER_SYSTEM,
      },
      mode,
    );
    if (!text) return;
    const clean = enforce(text.trim()) ?? text.trim();
    const next = [...paragraphs];
    next[index] = { ...paragraphs[index], text: clean, ...emptyGrounding() };
    const [grounded] = postProcess(await ground([next[index]]));
    const updated = [...paragraphs];
    updated[index] = grounded;
    commit(updated);
    setOpenQuestions((prev) => collectQuestions([grounded], prev));
  };

  const insertAbove = async (index: number) => {
    const text = await run({ prompt: insertPrompt(ctx, letterText, index), system: LETTER_SYSTEM }, 'insert');
    if (!text) return;
    const fresh: Paragraph = { id: newId(), text: enforce(text.trim()) ?? text.trim(), locked: false };
    const [grounded] = await ground([fresh]);
    const next = [...paragraphs];
    next.splice(index, 0, postProcess([grounded])[0]);
    commit(next);
  };

  /**
   * One revision pass. Everything the letter has to satisfy travels together —
   * the user's instructions, the flags they approved, the findings the review
   * raised, and the wording they told the app to leave alone — because a set of
   * requirements satisfied one at a time is how earlier fixes get undone.
   */
  const runRevision = async (
    instruction: string,
    extraApproved: string[] = [],
    /** `list` is for a caller revising text it has just produced and has not seen rendered yet. */
    options: { record?: boolean; useCtx?: Ctx; label?: string; list?: Paragraph[] } = {},
  ): Promise<Paragraph[] | null> => {
    const useCtx = options.useCtx ?? ctx;
    const base = options.list ?? paragraphs;
    const locked = base.filter((p) => p.locked).map((p) => p.text);
    const text = await run(
      {
        prompt: promptWithInstruction(
          useCtx,
          lettersToText(base),
          instruction,
          locked,
          instructionHistory,
          [...approvedInstructions(base, decisions), ...extraApproved],
          dismissedFragments(base, decisions),
        ),
        system: LETTER_SYSTEM,
        json: true,
      },
      options.label || 'revising',
    );
    if (!text) return null;
    const parsed = parseJsonAnswer<{ paragraphs: string[]; notices?: string[]; wouldTouch?: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    const revised: Paragraph[] = list.map((t, i) => ({
      id: base[i]?.id || newId(),
      text: base[i]?.locked ? base[i].text : String(t).trim(),
      locked: base[i]?.locked ?? false,
      ...(base[i]?.locked ? {} : emptyGrounding()),
    }));
    // Post-passes apply to every paragraph, locked included; grounding refreshes the rest.
    const processed = postProcess(revised);
    const changed = processed.filter((p) => !p.locked);
    const grounded = await ground(changed, useCtx);
    let gi = 0;
    const finished = processed.map((p) => (p.locked ? p : grounded[gi++] || p));
    commit(finished);
    setNotices([...(parsed?.notices || []).map(String), ...variantMismatchNotice()]);
    setWouldTouch((parsed?.wouldTouch || []).map(String).filter(Boolean));
    if (options.record !== false) setInstructionHistory((h) => [...h, instruction.trim()]);
    setOpenQuestions((prev) => collectQuestions(finished.filter((p) => !p.locked), prev));
    return finished;
  };

  const applyInstruction = async () => {
    if (!instruction.trim()) return;
    // The review's findings are part of the set every revision has to satisfy.
    const finished = await runRevision(instruction, critiqueInstructions(critique, 'must-fix'));
    if (!finished) return;
    // An answered question is answered for good.
    if (pendingQuestion) {
      setOpenQuestions((prev) => prev.filter((q) => q !== pendingQuestion));
      setPendingQuestion(null);
    }
    setInstruction('');
  };

  /**
   * Repair pass driven by the review. The findings are handed over as must-fix
   * instructions, the letter is rewritten once against all of them, and the
   * findings are cleared: they described the old text, and a stale review would
   * keep the gate red for a problem that no longer exists.
   */
  const fixFromReview = async (severity: 'must-fix' | 'should-fix' = 'must-fix') => {
    const items = critiqueInstructions(critique, severity);
    if (!items.length) return;
    const finished = await runRevision(
      severity === 'must-fix'
        ? 'Fix the problems the review raised, without undoing what it said works.'
        : "Apply the review's remaining suggestions, without undoing what it said works.",
      items,
      { record: false, label: 'repairing' },
    );
    // A repair that never happened must not clear the findings that asked for it.
    if (!finished) return;
    setCritique(null);
    setNotices((prev) => [...prev, 'The review findings were applied. Run the review again to check the result.']);
  };

  /** Review the letter as it stands, on demand. */
  const runCritique = async () => {
    if (!paragraphs.length) return;
    const crit = await critiqueLetter(paragraphs);
    if (crit) setCritique(crit);
  };

  /**
   * The gate. Computed from what is on screen rather than stored, so it can never
   * disagree with the letter the user is looking at.
   */
  const gate = useMemo(
    () =>
      qualityGate({
        paragraphs,
        decisions,
        critique,
        acknowledgedFindings: Object.keys(findingDecisions),
        words,
        openQuestions,
        resume: resumeText,
      }),
    [paragraphs, decisions, critique, findingDecisions, words, openQuestions, resumeText],
  );

  /** Set a review finding aside, or take it back. */
  const toggleFinding = (signature: string) => {
    setFindingDecisions((d) => {
      const next = { ...d };
      if (next[signature]) delete next[signature];
      else next[signature] = true;
      return next;
    });
  };

  /** Requirements the plan found no evidence for, and whether the plan still fits the ad. */
  const uncovered = useMemo(() => (plan ? mapCoverage(plan.map).uncovered : []), [plan]);
  const planStale = useMemo(() => planIsStale(plan, job, requirements), [plan, job, requirements]);

  const decide = (flagId: string, decision: FlagDecision | null) => {
    setDecisions((d) => {
      const next = { ...d };
      if (decision === null) delete next[flagId];
      else next[flagId] = decision;
      return next;
    });
  };

  /** After three dismissals of the same kind, offer to make it a standing rule. */
  const ruleOffer = useMemo(() => {
    const counts = dismissalCounts(decisions);
    for (const meta of Object.values(FLAG_KIND_META)) {
      const count = counts[meta.kind] || 0;
      if (count < 3) continue;
      if (ruleOffersDismissed.includes(meta.kind)) continue;
      const line = suggestedRule(meta.kind);
      if (rules.toLowerCase().includes(line.toLowerCase())) continue;
      return { kind: meta.kind, label: meta.label, line };
    }
    return null;
  }, [decisions, ruleOffersDismissed, rules]);

  const addRuleOffer = () => {
    if (!ruleOffer) return;
    setRules((r) => [r.trim(), ruleOffer.line].filter(Boolean).join('\n'));
    setRuleOffersDismissed((d) => [...d, ruleOffer.kind]);
    toast({
      title: 'Added to your rules',
      description: 'It now travels with every letter you write.',
    });
  };

  /** Every saved letter, newest first — the list the user picks from. */
  const refreshLetters = useCallback(async () => {
    if (!userId) return;
    setLettersLoading(true);
    try {
      const { data, error } = await supabase
        .from('cover_letters')
        .select('id,title,job_description,resume_id,context_items,style_settings,paragraphs,history,updated_at,created_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setSavedLetters((data || []) as unknown as SavedLetterRow[]);
    } catch {
      // A list that will not load must not block writing a new letter.
    } finally {
      setLettersLoading(false);
    }
  }, [userId]);

  /**
   * Write the session down. Called by the Save button, and quietly by the
   * debounced auto-save once a letter exists in the account.
   */
  const save = useCallback(
    async (options: { silent?: boolean; wait?: boolean } = {}): Promise<boolean> => {
      if (!userId || !paragraphs.length) return false;
      // Never two writes at once. A caller that must not lose its place can wait
      // for the write already running, then write whatever changed since.
      if (savingRef.current) return options.wait ? savingRef.current : false;

      const written = sessionJson;
      const payload = { user_id: userId, ...sessionToPayload(session) };
      const write = (async (): Promise<boolean> => {
        setSaveState('saving');
        try {
          const query = letterId
            ? supabase.from('cover_letters').update(payload).eq('id', letterId).select('id').single()
            : supabase.from('cover_letters').insert(payload).select('id').single();
          const { data, error } = await query;
          if (error) throw error;
          setLetterId(data.id);
          setSaveState('saved');
          // Edits made during the write keep the letter unsaved, baseline untouched.
          setBaseline(written);
          setSavedLetters((rows) => {
            const stamped = { ...payload, id: data.id, updated_at: new Date().toISOString() } as SavedLetterRow;
            const others = rows.filter((r) => r.id !== data.id);
            return [stamped, ...others];
          });
          if (options.silent) return true;
          toast({ title: 'Saved', description: 'Your cover letter is stored in your account.' });
          void refreshLetters();
          return true;
        } catch (err: any) {
          setSaveState('error');
          toast({
            title: options.silent ? 'Could not save your latest changes' : 'Could not save',
            description: err?.message || 'Something went wrong.',
            variant: 'destructive',
          });
          return false;
        }
      })();

      savingRef.current = write;
      try {
        return await write;
      } finally {
        savingRef.current = null;
      }
    },
    [userId, paragraphs.length, session, sessionJson, letterId, refreshLetters],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  /** A row saved before the background was stored can still be rebuilt from the resume it used. */
  const resumeTextFor = useCallback(
    (id: string | null): string => {
      if (!id) return '';
      const match = savedResumes.find((r) => r.id === id);
      if (!match) return '';
      try {
        return resumeSummary(match.content as ResumeData);
      } catch {
        return '';
      }
    },
    [savedResumes],
  );

  /** Put a saved letter back into the editor, exactly where it was left. */
  const openLetter = useCallback(
    (row: SavedLetterRow) => {
      const restored = sessionFromRow(row);
      restoredRef.current = true;
      setLetterId(row.id);
      setTitle(restored.title);
      setResumeId(restored.resumeId);
      setResumeText(restored.resumeText || resumeTextFor(restored.resumeId));
      setJob(restored.job);
      setAppeals(restored.appeals);
      setContextItems(restored.contextItems);
      setStyle(restored.style);
      if (restored.rules) setRules(restored.rules);
      setRequirements(restored.requirements);
      reqSourceRef.current = restored.requirementsSource;
      setReqStatus(restored.requirementsStatus);
      setHistory([restored.paragraphs]);
      setCursor(0);
      setSuggestions([]);
      setPlan(restored.plan);
      setPlanOpen(false);
      setCritique(null);
      setInstruction('');
      setPendingQuestion(null);
      setNotices(restored.notices);
      setWouldTouch(restored.wouldTouch);
      setInstructionHistory(restored.instructions);
      setOpenQuestions(restored.openQuestions);
      setRuleOffersDismissed(restored.ruleOffersDismissed);
      // Decisions are kept for the account as a whole, so a letter's own record adds to them.
      setDecisions((d) => ({ ...d, ...restored.decisions }));
      setSaveState('saved');
      toast({ title: 'Letter reopened', description: restored.title });
    },
    [resumeTextFor],
  );

  /** Opening another letter would drop unsaved work, so it is asked about first. */
  const requestOpen = (row: SavedLetterRow) => {
    if (row.id === letterId) return;
    if (dirty) setPendingOpen(row);
    else openLetter(row);
  };

  const openAndReplace = async (keepChanges: boolean) => {
    const row = pendingOpen;
    setPendingOpen(null);
    if (!row) return;
    if (keepChanges && !(await save({ wait: true }))) return;
    openLetter(row);
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    setPendingDelete(null);
    if (!row) return;
    const { error } = await supabase.from('cover_letters').delete().eq('id', row.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    setSavedLetters((rows) => rows.filter((r) => r.id !== row.id));
    if (row.id === letterId) {
      // The draft stays on screen; it simply is not saved anywhere any more.
      setLetterId(null);
      setSaveState('idle');
    }
    const wasOpen = row.id === letterId;
    toast({
      title: 'Letter deleted',
      description: wasOpen
        ? 'The draft is still on screen, but it is no longer saved anywhere.'
        : savedLetterSummary(row).title,
    });
  };

  /**
   * A new letter keeps the standing inputs — background, style, rules — and
   * clears the material that belongs to the role, along with the draft.
   */
  const startNew = () => {
    setNewOpen(false);
    restoredRef.current = true;
    setLetterId(null);
    setTitle('Untitled cover letter');
    setJob('');
    setAppeals('');
    setContextItems([]);
    setRequirements([]);
    setReqStatus('idle');
    reqSourceRef.current = '';
    setHistory([[]]);
    setCursor(0);
    setSuggestions([]);
    setPlan(null);
    setPlanOpen(false);
    setCritique(null);
    setInstruction('');
    setInstructionHistory([]);
    setNotices([]);
    setWouldTouch([]);
    setOpenQuestions([]);
    setPendingQuestion(null);
    setSaveState('idle');
    setBaseline(null);
  };

  // Letters are read back on arrival: saving them used to be a one-way trip.
  useEffect(() => {
    void refreshLetters();
  }, [refreshLetters]);

  /**
   * The way back in for someone returning to the app: the newest letter that
   * actually has a draft, offered while nothing is open.
   */
  const continueLetterId = useMemo(
    () => (letterId ? null : mostRecentDraft(savedLetters)?.id ?? null),
    [letterId, savedLetters],
  );

  // A letter just restored is, by definition, what was saved: it starts clean.
  useEffect(() => {
    if (!restoredRef.current) return;
    restoredRef.current = false;
    setBaseline(sessionJson);
  }, [sessionJson]);

  /**
   * Once a letter exists in the account it keeps itself up to date, so a
   * returning user finds the letter as they left it rather than as they saved it.
   */
  useEffect(() => {
    if (!letterId || !userId || !dirty) return;
    const timer = setTimeout(() => void saveRef.current({ silent: true }), 2500);
    return () => clearTimeout(timer);
  }, [dirty, letterId, userId, sessionJson]);

  const download = () => {
    const blob = new Blob([letterText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    try {
      await downloadLetterPdf({ title, paragraphs });
      toast({ title: 'PDF downloaded', description: 'A4, with selectable text.' });
    } catch (err: any) {
      toast({
        title: 'Could not build the PDF',
        description: err?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><head><title>${title}</title><style>@page{size:A4;margin:20mm}body{font-family:Georgia,serif;max-width:44rem;margin:0 auto;line-height:1.6}p{margin:0 0 1rem}</style></head><body>${paragraphs
        .map((p) => `<p>${p.text.replace(/</g, '&lt;')}</p>`)
        .join('')}</body></html>`,
    );
    w.document.close();
    w.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Cover Letter Crafter</h1>
              <p className="text-sm text-muted-foreground">Write, refine and export a letter paragraph by paragraph</p>
            </div>
          </div>
          <AiAssistantButton />
        </div>
      </header>

      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Inputs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Your background</CardTitle>
              <CardDescription>Pick a saved resume, or upload / paste one here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedResumes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {savedResumes.map((r) => (
                    <Badge
                      key={r.id}
                      variant={resumeId === r.id ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => pickSavedResume(r)}
                    >
                      {r.title}
                    </Badge>
                  ))}
                </div>
              )}
              <SourceInput
                value={resumeText}
                onChange={(t) => {
                  setResumeId(null);
                  setResumeText(t);
                }}
                placeholder="Paste your resume, or upload a PDF / Word file above."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. The role</CardTitle>
              <CardDescription>Paste the job description, upload the posting, or import it from a link.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SourceInput
                value={job}
                onChange={setJob}
                onCommit={handleRoleCommit}
                mode="job"
                placeholder="Paste the job description here."
              />

              {/* Optional, beside the ad: the only permitted basis for motivation. */}
              <div className="space-y-1">
                <Label htmlFor="appeals">What appeals about this role? (optional)</Label>
                <Textarea
                  id="appeals"
                  rows={3}
                  value={appeals}
                  onChange={(e) => setAppeals(e.target.value)}
                  placeholder="In your own words — why this job, this employer, this kind of work."
                />
                <p className="text-xs text-muted-foreground">
                  Fill this in and the letter will use it for the reason you want the job. Leave it
                  empty and the letter looks for a preference you have stated in a past letter, and
                  says nothing about motivation if there is none.
                </p>
              </div>

              {reqBusy && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Reading the role…
                </p>
              )}
              {/* FIELD 2: requirements, output attached to step 2 — not a numbered step. */}
              <RequirementsEditor
                items={requirements}
                status={reqStatus}
                busy={reqBusy}
                onChange={setRequirements}
                onMarkEdited={() => setReqStatus((s) => (s === 'ready' ? 'edited' : s === 'stale' ? 'stale' : 'edited'))}
                onRefresh={refreshRequirements}
                onDismissStale={() => setReqStatus('edited')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Extra content (optional)</CardTitle>
              <CardDescription>
                Tag each source with what it may be used for — old letters teach style, never facts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContextItemList items={contextItems} onChange={setContextItems} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Style and tone</CardTitle>
              <CardDescription>
                Get suggestions, tap the ones you want, then edit the sentence it writes for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" disabled={!ready || isBusy} onClick={suggestStyles}>
                <Sparkles className="h-4 w-4 mr-1" />
                Suggest styles
              </Button>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Badge
                      key={s}
                      variant={isSuggestionApplied(s) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => applySuggestion(s)}
                      title="Write this into your tone instructions"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tone">How it should sound</Label>
                  <Textarea
                    id="tone"
                    rows={3}
                    className="mt-1"
                    value={style.custom}
                    onChange={(e) => setStyle((s) => ({ ...s, custom: e.target.value }))}
                    placeholder="e.g. warm but formal, plain and direct, no cliches"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    One input, one source of truth. Suggestions are written in here so you can edit
                    them like anything else.
                  </p>
                </div>
                <div>
                  <Label>English variant</Label>
                  <Select
                    value={style.english || 'uk'}
                    onValueChange={(v) => setStyle((s) => ({ ...s, english: v as 'uk' | 'us' }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGLISH_VARIANTS.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ENGLISH_VARIANTS.find((v) => v.id === (style.english || 'uk'))?.hint}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FIELD 1: Rules — its own section, saved between sessions. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                5. Rules
                <Badge variant="secondary" className="text-[10px] font-normal">
                  saved setting
                </Badge>
              </CardTitle>
              <CardDescription>
                Anything you always want followed. For example: no em dashes, keep it under 350 words,
                don't mention my current employer, don't claim Figma skills.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                id="rules"
                rows={4}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="One rule per line. Left empty, nothing is enforced."
              />
              <p className="text-[11px] text-muted-foreground">
                Pre-filled from your last letter and saved automatically. Sent with every draft and
                revision and treated as binding; spelling variants and banned characters are also
                enforced in code after generation.
              </p>
            </CardContent>
          </Card>

          <Button className="w-full" disabled={!ready || isBusy} onClick={generate}>
            {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            {paragraphs.length ? 'Write a new draft' : 'Write my cover letter'}
          </Button>
          {!ready && (
            <p className="text-xs text-muted-foreground">
              Add your background and the job description to start.
            </p>
          )}
        </div>

        {/* Draft */}
        <div className="space-y-4">
          <SavedLetters
            rows={savedLetters}
            currentId={letterId}
            continueId={continueLetterId}
            loading={lettersLoading}
            dirty={dirty}
            hasWork={
              paragraphs.length > 0 ||
              title !== 'Untitled cover letter' ||
              Boolean(job.trim()) ||
              Boolean(appeals.trim()) ||
              contextItems.length > 0
            }
            onOpen={requestOpen}
            onDelete={setPendingDelete}
            onNew={() => (dirty ? setNewOpen(true) : startNew())}
            onRefresh={() => void refreshLetters()}
          />

          {(plan || planBusy) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Plan
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    evidence first
                  </Badge>
                </CardTitle>
                <CardDescription>
                  What this employer needs, and what you actually have for it. The letter is written from
                  this map, and the review checks the letter against it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {planBusy && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Reading the ad against your background…
                  </p>
                )}
                {plan && (
                  <>
                    {planStale && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        The ad or the requirements changed since this plan was built. Refresh it before the
                        next draft so the letter is written to the current list.
                      </p>
                    )}
                    {plan.map.purpose && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Hiring for: </span>
                        {plan.map.purpose}
                      </p>
                    )}
                    {plan.map.seniority && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Level: </span>
                        {plan.map.seniority}
                      </p>
                    )}
                    {plan.map.priorities.length > 0 && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Returns to: </span>
                        {plan.map.priorities.join(' · ')}
                      </p>
                    )}
                    {plan.map.whyThisRole.length > 0 && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Why this role, in your words: </span>
                        {plan.map.whyThisRole.join(' · ')}
                      </p>
                    )}
                    {plan.map.entries.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {plan.map.entries.map((e, i) => (
                          <Badge
                            key={i}
                            variant={
                              e.strength === 'strong'
                                ? 'default'
                                : e.strength === 'partial'
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="text-[10px] font-normal"
                            title={e.gap || STRENGTH_LABELS[e.strength].hint}
                          >
                            {i + 1}. {STRENGTH_LABELS[e.strength].label}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {planOpen && (
                      <div className="space-y-2 pt-1">
                        {plan.map.entries.map((e, i) => (
                          <div key={i} className="space-y-1 rounded-md border border-border p-2">
                            <p className="text-xs font-medium">{e.requirement || `Requirement ${i + 1}`}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {STRENGTH_LABELS[e.strength].label}
                              {e.source ? ` — ${e.source}` : ''}
                            </p>
                            {e.evidence && <p className="text-xs italic">“{e.evidence}”</p>}
                            {e.claim && <p className="text-xs">Safe to claim: {e.claim}</p>}
                            {e.gap && (
                              <p className="text-xs text-amber-700 dark:text-amber-400">Gap: {e.gap}</p>
                            )}
                          </div>
                        ))}
                        {uncovered.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Nothing in your background answers{' '}
                            {uncovered
                              .map((e) => e.requirement)
                              .filter(Boolean)
                              .join(', ')}
                            . Those requirements stay out of the letter unless you supply the evidence.
                          </p>
                        )}
                        {plan.map.terminology.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            Their words for your work: {plan.map.terminology.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setPlanOpen((v) => !v)}>
                        {planOpen ? 'Hide the detail' : 'Show the detail'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={planBusy || isBusy || !ready}
                        onClick={() => void buildPlan(true)}
                      >
                        Refresh the plan
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 pt-6">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-56" />
              <Button variant="outline" size="sm" disabled={cursor === 0} onClick={() => setCursor((c) => c - 1)}>
                <Undo2 className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cursor >= history.length - 1}
                onClick={() => setCursor((c) => c + 1)}
              >
                <Redo2 className="h-4 w-4 mr-1" />
                Redo
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!paragraphs.length || isBusy}
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!paragraphs.length || saveState === 'saving'}
                onClick={() => void save()}
              >
                {saveState === 'saving' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!paragraphs.length}
                onClick={() => (gate.ready ? void exportPdf() : setExportOpen(true))}
              >
                <FileText className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={download}>
                <Download className="h-4 w-4 mr-1" />
                .txt
              </Button>
              <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={print}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              {paragraphs.length > 0 && (
                <span
                  className={`ml-auto text-xs ${
                    words >= 250 && words <= 400 ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {words} words
                </span>
              )}
              {letterId && (
                <p className="w-full text-[11px] text-muted-foreground">
                  {saveState === 'saving'
                    ? 'Saving…'
                    : saveState === 'error'
                      ? 'The last save failed — press Save to try again.'
                      : dirty
                        ? 'Unsaved changes — this letter saves itself as you work.'
                        : 'Saved to your account.'}
                </p>
              )}
            </CardContent>
          </Card>

          {paragraphs.length > 0 && (
            <Card className={GATE_CARD[GATE_META[gate.verdict].tone]}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{gate.label}</p>
                  <Badge
                    variant={gate.ready ? 'default' : 'outline'}
                    className="text-[10px] font-normal"
                  >
                    {gate.ready ? 'nothing outstanding' : 'not final yet'}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{words} words</span>
                </div>
                <p className="text-xs text-muted-foreground">{gate.detail}</p>
                {gate.reasons.map((r, i) => (
                  <p key={i} className="text-xs">
                    {r}
                  </p>
                ))}
                {gate.notes.map((n, i) => (
                  <p key={`note-${i}`} className="text-[11px] text-muted-foreground">
                    {n}
                  </p>
                ))}
                {Object.keys(gate.failures).length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Flagged by category: {failureLine(gate.failures)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" disabled={isBusy} onClick={() => void runCritique()}>
                    Review as a hiring manager
                  </Button>
                  {mustFixFindings(critique).length > 0 && (
                    <Button size="sm" disabled={isBusy} onClick={() => void fixFromReview('must-fix')}>
                      Fix what the review found
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {critique && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review</CardTitle>
                <CardDescription>
                  {critiqueSummaryLine(critique)} — evidence and relevance count for more here than polished
                  prose.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {critique.findings.map((f, i) => {
                  const signature = findingSignature(f);
                  const setAside = f.severity === 'should-fix' && Boolean(findingDecisions[signature]);
                  return (
                    <div
                      key={i}
                      className={`space-y-1 rounded-md border border-border p-2 ${
                        setAside ? 'opacity-60' : ''
                      }`}
                    >
                      <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
                        <Badge
                          variant={f.severity === 'must-fix' ? 'destructive' : 'secondary'}
                          className="text-[10px] font-normal"
                        >
                          {FAILURE_LABELS[f.code]}
                        </Badge>
                        <span className="text-muted-foreground">
                          {f.paragraph > 0 ? `paragraph ${f.paragraph}` : 'the letter as a whole'}
                        </span>
                        {setAside && <span className="text-muted-foreground">set aside</span>}
                      </p>
                      {f.passage && <p className="text-xs italic">“{f.passage}”</p>}
                      {f.problem && <p className="text-xs">{f.problem}</p>}
                      {f.fix && <p className="text-xs text-muted-foreground">Instead: {f.fix}</p>}
                      {f.severity === 'should-fix' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => toggleFinding(signature)}
                        >
                          {setAside ? 'Wait, fix it' : 'Set aside'}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {critique.keep.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Leave as it is: {critique.keep.join('; ')}
                  </p>
                )}
                {critique.summary && <p className="text-xs text-muted-foreground">{critique.summary}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {mustFixFindings(critique).length > 0 && (
                    <Button size="sm" disabled={isBusy} onClick={() => void fixFromReview('must-fix')}>
                      Fix the must-fix items
                    </Button>
                  )}
                  {shouldFixFindings(critique).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void fixFromReview('should-fix')}
                    >
                      Apply the rest
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setCritique(null)}>
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Single notice area: everything not tied to one paragraph lives here, never in the letter. */}
          {(notices.length > 0 || wouldTouch.length > 0) && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Bell className="h-4 w-4" />
                  Notices
                </p>
                {notices.map((n, i) => (
                  <p key={`n${i}`} className="text-xs text-amber-700 dark:text-amber-400">
                    {n}
                  </p>
                ))}
                {wouldTouch.map((t, i) => (
                  <p key={`w${i}`} className="text-xs text-amber-700 dark:text-amber-400">
                    A change could not be applied to the locked paragraph starting “{t}” — it was applied
                    everywhere else.
                  </p>
                ))}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNotices([]); setWouldTouch([]); }}>
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {ruleOffer && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">
                  You keep dismissing “{ruleOffer.label}” flags.
                </p>
                <p className="text-xs text-muted-foreground">
                  Want it written into your rules so the letter stops doing it?
                </p>
                <p className="rounded-md border border-border bg-background p-2 text-xs">{ruleOffer.line}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addRuleOffer}>
                    Add to my rules
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRuleOffersDismissed((d) => [...d, ruleOffer.kind])}
                  >
                    No thanks
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {openQuestions.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">Waiting on you</p>
                {openQuestions.map((q) => (
                  <p key={q} className="text-xs text-muted-foreground">
                    {q}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Answer one in the change box and it will be used. Left unanswered, the next draft
                  leaves that material out rather than guessing again.
                </p>
              </CardContent>
            </Card>
          )}

          {paragraphs.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Your letter will appear here, one paragraph at a time.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {paragraphs.map((p, i) => (
                <ParagraphCard
                  key={p.id}
                  paragraph={p}
                  index={i}
                  total={paragraphs.length}
                  busy={isBusy}
                  decisions={decisions}
                  onDecision={decide}
                  onAskInput={(question) => {
                    setInstruction(question);
                    setPendingQuestion(question);
                  }}
                  onEdit={(text) => {
                    const next = [...paragraphs];
                    next[i] = { ...next[i], text };
                    commit(next);
                  }}
                  onToggleLock={() => {
                    const next = [...paragraphs];
                    next[i] = { ...next[i], locked: !next[i].locked };
                    commit(next);
                  }}
                  onMove={(dir) => {
                    const target = i + dir;
                    if (target < 0 || target >= paragraphs.length) return;
                    const next = [...paragraphs];
                    [next[i], next[target]] = [next[target], next[i]];
                    commit(next);
                  }}
                  onRephrase={() => editParagraph(i, 'rephrase')}
                  onRegenerate={() => editParagraph(i, 'regenerate')}
                  onRemove={() => commit(paragraphs.filter((_, idx) => idx !== i))}
                  onInsertAbove={() => insertAbove(i)}
                />
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ask for a change</CardTitle>
                  <CardDescription>
                    Instructions accumulate: every change is checked against all previous ones, and locked paragraphs are
                    untouched.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {instructionHistory.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {instructionHistory.map((h, i) => (
                        <Badge key={i} variant="secondary" className="max-w-full truncate text-xs font-normal">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Textarea
                    rows={3}
                    value={instruction}
                    onChange={(e) => {
                      setInstruction(e.target.value);
                      if (pendingQuestion && e.target.value !== pendingQuestion) setPendingQuestion(null);
                    }}
                    placeholder="e.g. shorter, lead with the team leadership example"
                  />
                  <Button disabled={isBusy || !instruction.trim()} onClick={applyInstruction}>
                    {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Apply
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(pendingOpen)} onOpenChange={(open) => !open && setPendingOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Opening “{pendingOpen ? savedLetterSummary(pendingOpen).title : 'that letter'}” replaces the
              draft on screen. Keep your changes first, or open the saved letter without them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void openAndReplace(false)}>Discard and open</AlertDialogAction>
            <AlertDialogAction onClick={() => void openAndReplace(true)}>Save and open</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this letter?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete ? savedLetterSummary(pendingDelete).title : 'This letter'}” will be removed
              from your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={newOpen} onOpenChange={setNewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new letter?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes to this draft will be lost. Your background, style and rules stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startNew}>Start new</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* A letter does not become final by being downloaded: the gate is asked first. */}
      <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This letter has not passed the gate</AlertDialogTitle>
            <AlertDialogDescription>
              {gate.label}.{' '}
              {gate.reasons[0] || 'Something is still outstanding.'} You can download it now and keep
              working, or fix that first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExportOpen(false);
                void exportPdf();
              }}
            >
              Download anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This discards the current draft and writes a fresh letter. You can still undo afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResetOpen(false);
                generate();
              }}
            >
              Rewrite it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
