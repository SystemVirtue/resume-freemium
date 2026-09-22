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
import { AiAssistantButton } from '@/components/ai/AiAssistantButton';
import { ParagraphCard } from './ParagraphCard';
import { SourceInput } from './SourceInput';
import { ContextItemList } from './ContextItemList';
import { RequirementsEditor, RequirementsStatus } from './RequirementsEditor';
import {
  RULES_STORAGE_KEY,
  ContextItem,
  ENGLISH_VARIANTS,
  Paragraph,
  RuleFlag,
  SourceRef,
  StyleSettings,
  SYSTEM,
  convertVariant,
  detectVariant,
  draftPrompt,
  editPrompt,
  enforceBannedChars,
  flagParagraphOpenings,
  flagRepetition,
  groundingPrompt,
  insertPrompt,
  lettersToText,
  newId,
  normaliseModelText,
  promptWithInstruction,
  requirementsPrompt,
  resumeSummary,
  reviewPrompt,
  rulesVariant,
  stylePrompt,
} from '@/lib/coverLetter';
import { ResumeData } from '@/types/resume';

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

const cleanGrounding = (g: any): Grounding => ({
  sources: (g?.sources || []).map(toSourceRef).filter(Boolean) as SourceRef[],
  unsupported: (g?.unsupported || []).map((s: any) => String(s)).filter(Boolean),
  misattributed: (g?.misattributed || []).map((s: any) => String(s)).filter(Boolean),
  echoes: (g?.echoes || []).map((s: any) => String(s)).filter(Boolean),
  ruleFlags: (g?.rules || g?.ruleFlags || []).map(toRuleFlag).filter(Boolean) as RuleFlag[],
});

const emptyGrounding = (): Grounding => ({
  sources: [],
  unsupported: [],
  misattributed: [],
  echoes: [],
  ruleFlags: [],
});

export const CoverLetterCrafter: React.FC<CoverLetterCrafterProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { run, isBusy } = useAi();

  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [job, setJob] = useState('');
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [style, setStyle] = useState<StyleSettings>({ chips: [], custom: '', english: 'uk' });

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
  const [review, setReview] = useState('');
  /** Style suggestions from the model, offered as chips in step 4. */
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  /** Every instruction applied so far — revisions satisfy the whole set, not just the newest. */
  const [instructionHistory, setInstructionHistory] = useState<string[]>([]);
  /** Letter-wide notices: rule overrides, selector mismatches. Never inside the letter text. */
  const [notices, setNotices] = useState<string[]>([]);
  /** Locked paragraphs a change could not be applied to. */
  const [wouldTouch, setWouldTouch] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);

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

  const ctx = useMemo(
    () => ({
      resume: resumeText.slice(0, 6000),
      job,
      context: contextItems,
      style,
      rules,
      requirements,
    }),
    [resumeText, job, contextItems, style, rules, requirements],
  );

  const letterText = lettersToText(paragraphs);

  // FIELD 1: rules persist between sessions — save as the user edits them.
  useEffect(() => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, rules);
    } catch {
      /* storage unavailable */
    }
  }, [rules]);

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
          { prompt: requirementsPrompt({ ...ctx, job: text }), system: SYSTEM, json: true },
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
    const text = await run({ prompt: stylePrompt(ctx), system: SYSTEM, json: true }, 'styles');
    if (!text) return;
    const parsed = parseJsonAnswer<{ styles: string[] }>(text);
    if (parsed?.styles?.length) setSuggestions(parsed.styles.slice(0, 8));
  };

  const toggleChip = (chip: string) =>
    setStyle((s) => ({
      ...s,
      chips: s.chips.includes(chip) ? s.chips.filter((c) => c !== chip) : [...s.chips, chip],
    }));

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
   * and extra background, and flag what cannot be traced or is misattributed.
   */
  const ground = useCallback(
    async (base: Paragraph[]): Promise<Paragraph[]> => {
      if (!base.length) return base;
      const text = await run(
        { prompt: groundingPrompt(ctx, base.map((p) => p.text)), system: SYSTEM, json: true },
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

  const generate = async () => {
    const text = await run({ prompt: draftPrompt(ctx), system: SYSTEM, json: true }, 'draft');
    if (!text) return;
    const parsed = parseJsonAnswer<{ paragraphs: string[]; notices?: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    const base: Paragraph[] = list.map((t) => ({ id: newId(), text: String(t).trim(), locked: false }));
    setNotices([...(parsed?.notices || []).map(String), ...variantMismatchNotice()]);
    setWouldTouch([]);
    setReview('');
    setInstructionHistory([]);
    commit(postProcess(await ground(base)));
  };

  const editParagraph = async (index: number, mode: 'rephrase' | 'regenerate') => {
    const text = await run(
      { prompt: editPrompt(ctx, mode, paragraphs[index].text, letterText), system: SYSTEM },
      mode,
    );
    if (!text) return;
    const clean = enforce(text.trim()) ?? text.trim();
    const next = [...paragraphs];
    next[index] = { ...paragraphs[index], text: clean, ...emptyGrounding() };
    commit(postProcess(await ground([next[index]])));
  };

  const insertAbove = async (index: number) => {
    const text = await run({ prompt: insertPrompt(ctx, letterText, index), system: SYSTEM }, 'insert');
    if (!text) return;
    const fresh: Paragraph = { id: newId(), text: enforce(text.trim()) ?? text.trim(), locked: false };
    const [grounded] = await ground([fresh]);
    const next = [...paragraphs];
    next.splice(index, 0, postProcess([grounded])[0]);
    commit(next);
  };

  const applyInstruction = async () => {
    if (!instruction.trim()) return;
    const locked = paragraphs.filter((p) => p.locked).map((p) => p.text);
    const text = await run(
      {
        prompt: promptWithInstruction(ctx, letterText, instruction, locked, instructionHistory),
        system: SYSTEM,
        json: true,
      },
      'revising',
    );
    if (!text) return;
    const parsed = parseJsonAnswer<{ paragraphs: string[]; notices?: string[]; wouldTouch?: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    const revised: Paragraph[] = list.map((t, i) => ({
      id: paragraphs[i]?.id || newId(),
      text: paragraphs[i]?.locked ? paragraphs[i].text : String(t).trim(),
      locked: paragraphs[i]?.locked ?? false,
      ...(paragraphs[i]?.locked ? {} : emptyGrounding()),
    }));
    // Post-passes apply to every paragraph, locked included; grounding refreshes the rest.
    const processed = postProcess(revised);
    const changed = processed.filter((p) => !p.locked);
    const grounded = await ground(changed);
    let gi = 0;
    commit(processed.map((p) => (p.locked ? p : grounded[gi++] || p)));
    setNotices([...(parsed?.notices || []).map(String), ...variantMismatchNotice()]);
    setWouldTouch((parsed?.wouldTouch || []).map(String).filter(Boolean));
    setInstructionHistory((h) => [...h, instruction.trim()]);
    setInstruction('');
  };

  const runReview = async () => {
    const text = await run({ prompt: reviewPrompt(ctx, letterText), system: SYSTEM }, 'review');
    if (text) setReview(text.trim());
  };

  const save = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      resume_id: resumeId,
      title,
      job_description: job,
      job_source: 'crafter',
      context_items: { items: contextItems, requirements } as any,
      style_settings: { ...style, rules } as any,
      paragraphs: paragraphs as any,
      history: [] as any,
    };
    const query = letterId
      ? supabase.from('cover_letters').update(payload).eq('id', letterId).select('id').single()
      : supabase.from('cover_letters').insert(payload).select('id').single();
    const { data, error } = await query;
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    setLetterId(data.id);
    toast({ title: 'Saved', description: 'Your cover letter is stored in your account.' });
  };

  const download = () => {
    const blob = new Blob([letterText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><head><title>${title}</title><style>body{font-family:Georgia,serif;max-width:44rem;margin:3rem auto;line-height:1.6}p{margin:0 0 1rem}</style></head><body>${paragraphs
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
              <CardDescription>Get suggestions, tap the ones you want, and add your own notes.</CardDescription>
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
                      variant={style.chips.includes(s) ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => toggleChip(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div>
                  <Label htmlFor="tone">Your own tone instructions</Label>
                  <Textarea
                    id="tone"
                    rows={2}
                    className="mt-1"
                    value={style.custom}
                    onChange={(e) => setStyle((s) => ({ ...s, custom: e.target.value }))}
                    placeholder="e.g. confident but understated"
                  />
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
              <Button variant="outline" size="sm" disabled={!paragraphs.length || isBusy} onClick={runReview}>
                Fact check
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
              <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={save}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={download}>
                <Download className="h-4 w-4 mr-1" />
                .txt
              </Button>
              <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={print}>
                <Printer className="h-4 w-4 mr-1" />
                Print / PDF
              </Button>
            </CardContent>
          </Card>

          {review && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fact check</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review}</p>
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
                    onChange={(e) => setInstruction(e.target.value)}
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
