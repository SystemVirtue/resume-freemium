import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Bell, Download, Eye, Loader2, Printer, Redo2, RotateCcw, Save, Sparkles, Undo2, Wand2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAi } from '@/hooks/useAi';
import { parseJsonAnswer } from '@/lib/ai/client';
import { AiAssistantButton } from '@/components/ai/AiAssistantButton';
import { ParagraphCard } from './ParagraphCard';
import { SourceInput } from './SourceInput';
import { ContextItemList } from './ContextItemList';
import { RequirementsEditor, RequirementsStatus } from './RequirementsEditor';
import {
  RULES_STORAGE_KEY, ContextItem, ENGLISH_VARIANTS, Paragraph,
  StyleSettings, CHECK_SYSTEM, SYSTEM, draftPrompt, editPrompt,
  insertPrompt, lettersToText, newId, normaliseModelText, promptWithInstruction,
  requirementsPrompt, resumeSummary, reviewPrompt, rulesVariant, stylePrompt,
} from '@/lib/coverLetter';
import { createPipeline, emptyGrounding } from '@/lib/cover-letter-eval/pipeline';
import { ResumeData } from '@/types/resume';

interface SavedResume { id: string; title: string; content: any }
interface CoverLetterCrafterProps { onBack: () => void }

export const CoverLetterCrafter: React.FC<CoverLetterCrafterProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { run, isBusy } = useAi();
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [job, setJob] = useState('');
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [style, setStyle] = useState<StyleSettings>({ chips: [], custom: '', english: 'uk', template: 'classic', font: 'serif', color: 'navy' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showMarkup, setShowMarkup] = useState<boolean>(() => {
    try { return localStorage.getItem('cover-letter-show-markup') === 'true'; } catch { return false; }
  });
  const [rules, setRules] = useState(() => {
    try { return localStorage.getItem(RULES_STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [requirements, setRequirements] = useState<string[]>([]);
  const [reqStatus, setReqStatus] = useState<RequirementsStatus>('idle');
  const [reqBusy, setReqBusy] = useState(false);
  const reqSourceRef = useRef('');
  const [title, setTitle] = useState('Untitled cover letter');
  const [letterId, setLetterId] = useState<string | null>(null);
  const [review, setReview] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [instructionHistory, setInstructionHistory] = useState<string[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [wouldTouch, setWouldTouch] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [history, setHistory] = useState<Paragraph[][]>([[]]);
  const [cursor, setCursor] = useState(0);
  const activeGeneration = useRef<string | null>(null);
  const paragraphs = history[cursor];

  const commit = useCallback((next: Paragraph[]) => {
    setHistory((items) => [...items.slice(0, cursor + 1), next]);
    setCursor((position) => position + 1);
  }, [cursor]);

  useEffect(() => {
    try { localStorage.setItem('cover-letter-show-markup', String(showMarkup)); } catch { /* storage unavailable */ }
  }, [showMarkup]);

  useEffect(() => {
    try { localStorage.setItem(RULES_STORAGE_KEY, rules); } catch { /* storage unavailable */ }
  }, [rules]);

  useEffect(() => {
    if (!user) return;
    supabase.from('resumes').select('id,title,content').eq('user_id', user.id)
      .order('updated_at', { ascending: false }).then(({ data }) => setSavedResumes(data || []));
  }, [user]);

  const ctx = useMemo(() => ({ resume: resumeText.slice(0, 6000), job, context: contextItems, style, rules, requirements }), [resumeText, job, contextItems, style, rules, requirements]);
  const letterText = lettersToText(paragraphs);

  const documentHtml = useMemo(() => {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const fonts = { serif: 'Georgia, "Times New Roman", serif', sans: 'Arial, Helvetica, sans-serif', humanist: 'Trebuchet MS, Arial, sans-serif' };
    const colors = { navy: '#23364d', forest: '#285747', slate: '#475569' };
    const template = style.template || 'classic';
    const accent = colors[style.color || 'navy'];
    const font = fonts[style.font || 'serif'];
    const layout = template === 'modern' ? `border-top:10px solid ${accent};padding:36px 54px 48px;` : template === 'minimal' ? 'padding:58px 62px;' : 'padding:48px 54px;';
    const pages: string[] = [];
    let pageParagraphs: string[] = [];
    let pageWords = 0;
    paragraphs.forEach((paragraph) => {
      const text = normaliseModelText(paragraph.text).trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (pageWords + wordCount > 520 && pageParagraphs.length) {
        pages.push(pageParagraphs.join(''));
        pageParagraphs = [];
        pageWords = 0;
      }
      pageParagraphs.push(`<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`);
      pageWords += wordCount;
    });
    if (pageParagraphs.length) pages.push(pageParagraphs.join(''));
    const pageMarkup = pages.map((page, index) => `<main class="letter-page ${index ? 'continuation' : ''}"><article class="letter-content">${page}</article></main>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e8eaed;color:#222}
      body{font-family:${font};font-size:11.5pt;line-height:1.65}.letter-page{width:210mm;min-height:297mm;margin:24px auto;background:#fff;${layout}}
      .letter-content{max-width:100%;color:#222}.letter-content p{margin:0 0 1em;white-space:normal}.letter-content p:first-child{color:${template === 'modern' ? accent : '#222'}}
      .continuation{padding-top:40px}
      @media print{html,body{background:#fff}.letter-page{margin:0;box-shadow:none;page-break-after:always}.letter-page:last-child{page-break-after:auto}}
    </style></head><body>${pageMarkup}</body></html>`;
  }, [paragraphs, style.template, style.font, style.color, title]);

  const pickSavedResume = (resume: SavedResume) => {
    setResumeId(resume.id);
    try { setResumeText(resumeSummary(resume.content as ResumeData)); } catch { setResumeText(''); }
  };

  const ready = resumeText.trim().length > 40 && job.trim().length > 40;

  const generateRequirements = useCallback(async (roleText: string, force = false) => {
    const text = roleText.trim();
    if (!force && text === reqSourceRef.current && (reqStatus === 'ready' || reqStatus === 'too-thin')) return;
    if (text.length < 80) {
      setRequirements([]);
      setReqStatus(text.length ? 'too-thin' : 'idle');
      return;
    }
    setReqBusy(true);
    try {
      const answer = await run({ prompt: requirementsPrompt({ ...ctx, job: text }), system: CHECK_SYSTEM, json: true }, 'reading the ad');
      if (!answer) return;
      const parsed = parseJsonAnswer<{ requirements?: string[]; tooThin?: boolean }>(answer);
      if (parsed?.tooThin) {
        setRequirements([]);
        setReqStatus('too-thin');
        reqSourceRef.current = text;
        return;
      }
      const list = (parsed?.requirements || []).map((item) => String(item).trim()).filter(Boolean);
      if (list.length) {
        setRequirements(list);
        setReqStatus('ready');
        reqSourceRef.current = text;
      }
    } finally { setReqBusy(false); }
  }, [ctx, run, reqStatus]);

  const handleRoleCommit = (text: string) => {
    if (reqStatus === 'edited' || reqStatus === 'stale') {
      if (text.trim() && text.trim() !== reqSourceRef.current) setReqStatus('stale');
      return;
    }
    generateRequirements(text);
  };
  const refreshRequirements = () => generateRequirements(job, true);
  const suggestStyles = async () => {
    const text = await run({ prompt: stylePrompt(ctx), system: CHECK_SYSTEM, json: true }, 'styles');
    if (!text) return;
    const parsed = parseJsonAnswer<{ styles: string[] }>(text);
    if (parsed?.styles?.length) setSuggestions(parsed.styles.slice(0, 8));
  };
  const toggleChip = (chip: string) => setStyle((current) => ({ ...current, chips: current.chips.includes(chip) ? current.chips.filter((item) => item !== chip) : [...current.chips, chip] }));

  const variantMismatchNotice = useCallback((): string[] => {
    const ruleVariant = rulesVariant(rules);
    const selected = style.english || 'uk';
    if (!ruleVariant || ruleVariant === selected) return [];
    const name = (variant: string) => ENGLISH_VARIANTS.find((item) => item.id === variant)?.label || variant;
    return [`Your rules mention ${name(ruleVariant)}, but the English variant selector is set to ${name(selected)}. The selector was applied — adjust either one if that is not what you want.`];
  }, [rules, style.english]);

  const pipeline = useMemo(() => createPipeline(run, ctx), [run, ctx]);

  const generate = async () => {
    const requestId = newId();
    activeGeneration.current = requestId;
    setReview('');
    setNotices([]);
    setWouldTouch([]);
    const text = await run({ prompt: draftPrompt(ctx), system: SYSTEM, json: true }, 'draft');
    if (!text || activeGeneration.current !== requestId) return;
    const parsed = parseJsonAnswer<{ paragraphs: string[]; notices?: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    const base = list.map((item) => ({ id: newId(), text: String(item).trim(), locked: false } as Paragraph));
    setWouldTouch([]);
    setReview('');
    setInstructionHistory([]);
    const repaired = await pipeline.repair(base);
    if (activeGeneration.current !== requestId) return;
    setNotices([...(parsed?.notices || []).map(String), ...variantMismatchNotice()]);
    setHistory([[], repaired]);
    setCursor(1);
    setLetterId(null);
    if (repaired.some((paragraph) => paragraph.checksIncomplete)) {
      setNotices((items) => [...items, 'Some paragraphs could not be checked. The letter is shown, but those paragraphs are not marked as verified.']);
    }
  };

  const editParagraph = async (index: number, mode: 'rephrase' | 'regenerate') => {
    const text = await run({ prompt: editPrompt(ctx, mode, paragraphs[index].text, letterText), system: SYSTEM }, mode);
    if (!text) return;
    const changed = [...paragraphs];
    changed[index] = { ...paragraphs[index], text: pipeline.enforce(text.trim()) || text.trim(), ...emptyGrounding(), checkedText: undefined, checksIncomplete: false };
    commit(await pipeline.repair(changed, new Set([changed[index].id])));
  };

  const insertAbove = async (index: number) => {
    const text = await run({ prompt: insertPrompt(ctx, letterText, index), system: SYSTEM }, 'insert');
    if (!text) return;
    const fresh: Paragraph = { id: newId(), text: pipeline.enforce(text.trim()) || text.trim(), locked: false };
    const next = [...paragraphs];
    next.splice(index, 0, fresh);
    commit(await pipeline.repair(next, new Set([fresh.id])));
  };

  const applyInstruction = async () => {
    if (!instruction.trim()) return;
    const instructionNow = instruction.trim();
    const locked = paragraphs.filter((paragraph) => paragraph.locked || paragraph.dismissedFlags?.length).map((paragraph) => `${paragraph.id}\n${paragraph.text}`);
    const text = await run({ prompt: promptWithInstruction(ctx, paragraphs.map((paragraph) => `[${paragraph.id}] ${paragraph.text}`).join('\n\n'), instructionNow, locked, instructionHistory), system: SYSTEM, json: true }, 'revising');
    if (!text) return;
    const parsed = parseJsonAnswer<{ paragraphs: { id?: string; text?: string }[]; notices?: string[]; wouldTouch?: string[] }>(text);
    if (!Array.isArray(parsed?.paragraphs)) {
      toast({ title: 'Could not apply changes', description: 'The AI response was not in the expected format. Your current letter is unchanged.', variant: 'destructive' });
      return;
    }
    const previousById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
    const revised = parsed.paragraphs.map((item) => {
      const previous = item.id ? previousById.get(item.id) : undefined;
      if (!item.text?.trim()) return null;
      if (previous?.locked || previous?.dismissedFlags?.length) return previous;
      return {
        id: previous?.id || item.id || newId(),
        text: String(item.text).trim(),
        locked: false,
        ...(previous ? { dismissedFlags: previous.dismissedFlags } : {}),
        ...emptyGrounding(),
      } as Paragraph;
    }).filter(Boolean) as Paragraph[];
    for (const previous of paragraphs.filter((paragraph) => paragraph.locked || paragraph.dismissedFlags?.length)) {
      if (!revised.some((paragraph) => paragraph.id === previous.id)) revised.push(previous);
    }
    const revisedIds = new Set(revised.filter((paragraph) => !paragraph.locked && !paragraph.dismissedFlags?.length).map((paragraph) => paragraph.id));
    const repaired = await pipeline.repair(revised, revisedIds);
    commit(repaired);
    setNotices([...(parsed.notices || []).map(String), ...variantMismatchNotice()]);
    setWouldTouch((parsed.wouldTouch || []).map(String).filter(Boolean));
    if (repaired.some((paragraph) => paragraph.checksIncomplete)) setNotices((items) => [...items, 'Some paragraphs could not be checked.']);
    setInstructionHistory((items) => [...items, instructionNow]);
    setInstruction('');
  };

  const runReview = async () => {
    const text = await run({ prompt: reviewPrompt(ctx, letterText), system: CHECK_SYSTEM }, 'review');
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const dismissFinding = (index: number, key: string) => {
    const next = [...paragraphs];
    const paragraph = next[index];
    if (paragraph.dismissedFlags?.includes(key)) return;
    next[index] = { ...paragraph, dismissedFlags: [...(paragraph.dismissedFlags || []), key] };
    commit(next);
  };

  const clearDraft = () => {
    activeGeneration.current = null;
    setHistory([[]]);
    setCursor(0);
    setLetterId(null);
    setReview('');
    setNotices([]);
    setWouldTouch([]);
    setInstructionHistory([]);
    setInstruction('');
    setResetOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Cover Letter Crafter</h1>
              <p className="text-sm text-muted-foreground">Write, refine and export a letter paragraph by paragraph</p>
            </div>
          </div>
          <AiAssistantButton />
        </div>
      </header>

      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. Your background</CardTitle><CardDescription>Pick a saved resume, or upload / paste one here.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {savedResumes.length > 0 && <div className="flex flex-wrap gap-2">{savedResumes.map((resume) => <Badge key={resume.id} variant={resumeId === resume.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => pickSavedResume(resume)}>{resume.title}</Badge>)}</div>}
              <SourceInput value={resumeText} onChange={(value) => { setResumeId(null); setResumeText(value); }} placeholder="Paste your resume, or upload a PDF / Word file above." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. The role</CardTitle><CardDescription>Paste the job description, upload the posting, or import it from a link.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <SourceInput value={job} onChange={setJob} onCommit={handleRoleCommit} mode="job" placeholder="Paste the job description here." />
              {reqBusy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Reading the role…</p>}
              <RequirementsEditor items={requirements} status={reqStatus} busy={reqBusy} onChange={setRequirements} onMarkEdited={() => setReqStatus((status) => status === 'stale' ? 'stale' : 'edited')} onRefresh={refreshRequirements} onDismissStale={() => setReqStatus('edited')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. Extra content (optional)</CardTitle><CardDescription>Tag each source with what it may be used for — old letters teach voice, never career facts.</CardDescription></CardHeader>
            <CardContent><ContextItemList items={contextItems} onChange={setContextItems} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">4. Style, tone and page design</CardTitle><CardDescription>Choose the letter's voice and appearance before drafting.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" disabled={!ready || isBusy} onClick={suggestStyles}><Sparkles className="mr-1 h-4 w-4" />Suggest styles</Button>
              {suggestions.length > 0 && <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <Badge key={suggestion} variant={style.chips.includes(suggestion) ? 'default' : 'outline'} className="cursor-pointer capitalize" onClick={() => toggleChip(suggestion)}>{suggestion}</Badge>)}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>English variant</Label><Select value={style.english || 'uk'} onValueChange={(value) => setStyle((current) => ({ ...current, english: value as 'uk' | 'us' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{ENGLISH_VARIANTS.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">{ENGLISH_VARIANTS.find((variant) => variant.id === (style.english || 'uk'))?.hint}</p></div>
                <div><Label htmlFor="tone">Your own tone instructions</Label><Textarea id="tone" rows={2} className="mt-1" value={style.custom} onChange={(event) => setStyle((current) => ({ ...current, custom: event.target.value }))} placeholder="e.g. confident but understated" /></div>
                <div><Label>Page template</Label><Select value={style.template || 'classic'} onValueChange={(value) => setStyle((current) => ({ ...current, template: value as StyleSettings['template'] }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="classic">Classic</SelectItem><SelectItem value="modern">Modern</SelectItem><SelectItem value="minimal">Minimal</SelectItem></SelectContent></Select></div>
                <div><Label>Font</Label><Select value={style.font || 'serif'} onValueChange={(value) => setStyle((current) => ({ ...current, font: value as StyleSettings['font'] }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="serif">Serif</SelectItem><SelectItem value="sans">Sans serif</SelectItem><SelectItem value="humanist">Humanist</SelectItem></SelectContent></Select></div>
                <div><Label>Accent colour</Label><Select value={style.color || 'navy'} onValueChange={(value) => setStyle((current) => ({ ...current, color: value as StyleSettings['color'] }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="navy">Navy</SelectItem><SelectItem value="forest">Forest</SelectItem><SelectItem value="slate">Slate</SelectItem></SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">5. Rules <Badge variant="secondary" className="text-[10px] font-normal">saved setting</Badge></CardTitle><CardDescription>Anything you always want followed, such as no em dashes, a word limit, or terms to avoid.</CardDescription></CardHeader>
            <CardContent className="space-y-3"><Textarea id="rules" rows={4} value={rules} onChange={(event) => setRules(event.target.value)} placeholder="One rule per line. Left empty, nothing is enforced." /><p className="text-[11px] text-muted-foreground">Saved automatically and treated as binding; spelling variants and banned characters are also enforced in code after generation.</p></CardContent>
          </Card>

          <Button className="w-full" disabled={!ready || isBusy} onClick={generate}>{isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}{paragraphs.length ? 'Write a new draft' : 'Write my cover letter'}</Button>
          {!ready && <p className="text-xs text-muted-foreground">Add your background and the job description to start.</p>}
        </div>

        <div className="space-y-4">
          <Card><CardContent className="flex flex-wrap items-center gap-2 pt-6">
            <Input aria-label="Cover letter title" value={title} onChange={(event) => setTitle(event.target.value)} className="w-56" />
            <Button variant="outline" size="sm" disabled={cursor === 0} onClick={() => setCursor((position) => position - 1)}><Undo2 className="mr-1 h-4 w-4" />Undo</Button>
            <Button variant="outline" size="sm" disabled={cursor >= history.length - 1} onClick={() => setCursor((position) => position + 1)}><Redo2 className="mr-1 h-4 w-4" />Redo</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length || isBusy} onClick={runReview}>Editorial review</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length || isBusy} onClick={() => setResetOpen(true)}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={() => setShowMarkup((visible) => !visible)}><Eye className="mr-1 h-4 w-4" />{showMarkup ? 'Hide checks & sources' : 'Show checks & sources'}</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={() => setPreviewOpen(true)}>Preview</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={save}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={download}><Download className="mr-1 h-4 w-4" />.txt</Button>
            <Button variant="outline" size="sm" disabled={!paragraphs.length} onClick={print}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
          </CardContent></Card>

          {review && <Card><CardHeader><CardTitle className="text-base">Editorial second opinion</CardTitle><CardDescription>Separate from the automated paragraph checks.</CardDescription></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{review}</p></CardContent></Card>}
          {(notices.length > 0 || wouldTouch.length > 0) && <Card className="border-amber-500/50 bg-amber-500/5"><CardContent className="space-y-2 pt-4"><p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400"><Bell className="h-4 w-4" />Notices</p>{notices.map((notice, index) => <p key={`notice-${index}`} className="text-xs text-amber-700 dark:text-amber-400">{notice}</p>)}{wouldTouch.map((text, index) => <p key={`locked-${index}`} className="text-xs text-amber-700 dark:text-amber-400">A change could not be applied to the locked paragraph starting “{text}” — it was applied everywhere else.</p>)}<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNotices([]); setWouldTouch([]); }}>Dismiss notices</Button></CardContent></Card>}

          {paragraphs.length === 0 ? <Card><CardContent className="py-16 text-center text-muted-foreground">Your letter will appear here, one paragraph at a time.</CardContent></Card> : <div className="space-y-4">
            {paragraphs.map((paragraph, index) => <ParagraphCard key={paragraph.id} paragraph={paragraph} index={index} total={paragraphs.length} busy={isBusy} showMarkup={showMarkup} onDismiss={(key) => dismissFinding(index, key)} onEdit={(text) => { const next = [...paragraphs]; next[index] = { ...next[index], text, ...emptyGrounding(), checkedText: undefined, checksIncomplete: false }; commit(next); }} onToggleLock={() => { const next = [...paragraphs]; next[index] = { ...next[index], locked: !next[index].locked }; commit(next); }} onMove={(direction) => { const target = index + direction; if (target < 0 || target >= paragraphs.length) return; const next = [...paragraphs]; [next[index], next[target]] = [next[target], next[index]]; commit(next); }} onRephrase={() => editParagraph(index, 'rephrase')} onRegenerate={() => editParagraph(index, 'regenerate')} onRemove={() => commit(paragraphs.filter((_, paragraphIndex) => paragraphIndex !== index))} onInsertAbove={() => insertAbove(index)} />)}

            <Card><CardHeader><CardTitle className="text-base">Ask for a change</CardTitle><CardDescription>Instructions accumulate and are checked together. Locked or dismissed paragraphs remain unchanged.</CardDescription></CardHeader><CardContent className="space-y-3">
              {instructionHistory.length > 0 && <div className="flex flex-wrap gap-1">{instructionHistory.map((past, index) => <Badge key={index} variant="secondary" className="max-w-full truncate text-xs font-normal">{past}</Badge>)}</div>}
              <Textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="e.g. shorter, lead with the team leadership example" />
              <Button disabled={isBusy || !instruction.trim()} onClick={applyInstruction}>{isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Apply</Button>
            </CardContent></Card>
          </div>}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{title} — preview</DialogTitle><DialogDescription>Preview uses the same formatted document as Print / PDF.</DialogDescription></DialogHeader>
          <iframe title="Cover letter preview" srcDoc={documentHtml} className="h-[75vh] w-full rounded-md border bg-white" />
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this draft?</AlertDialogTitle>
            <AlertDialogDescription>This clears the current letter while keeping your resume, role, style and rules so you can start again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction onClick={clearDraft}>Clear letter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );};
