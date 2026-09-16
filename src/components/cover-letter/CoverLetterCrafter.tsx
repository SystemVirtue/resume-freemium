import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  ContextItem,
  Paragraph,
  StyleSettings,
  SYSTEM,
  draftPrompt,
  editPrompt,
  insertPrompt,
  lettersToText,
  newId,
  promptWithInstruction,
  resumeSummary,
  reviewPrompt,
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

export const CoverLetterCrafter: React.FC<CoverLetterCrafterProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { run, isBusy } = useAi();

  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [job, setJob] = useState('');
  const [contextText, setContextText] = useState('');
  const [style, setStyle] = useState<StyleSettings>({ chips: [], custom: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [title, setTitle] = useState('Untitled cover letter');
  const [letterId, setLetterId] = useState<string | null>(null);
  const [review, setReview] = useState('');
  const [instruction, setInstruction] = useState('');
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
      context: (contextText.trim() ? [{ id: 'ctx', label: 'Notes and references', text: contextText }] : []) as ContextItem[],
      style,
    }),
    [resumeText, job, contextText, style],
  );

  const letterText = lettersToText(paragraphs);

  const pickSavedResume = (r: SavedResume) => {
    setResumeId(r.id);
    try {
      setResumeText(resumeSummary(r.content as ResumeData));
    } catch {
      setResumeText('');
    }
  };

  const ready = resumeText.trim().length > 40 && job.trim().length > 40;

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

  const generate = async () => {
    const text = await run({ prompt: draftPrompt(ctx), system: SYSTEM, json: true }, 'draft');
    if (!text) return;
    const parsed = parseJsonAnswer<{ paragraphs: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    commit(list.map((t) => ({ id: newId(), text: t.trim(), locked: false })));
    setReview('');
  };

  const editParagraph = async (index: number, mode: 'rephrase' | 'regenerate') => {
    const text = await run(
      { prompt: editPrompt(ctx, mode, paragraphs[index].text, letterText), system: SYSTEM },
      mode,
    );
    if (!text) return;
    const next = [...paragraphs];
    next[index] = { ...next[index], text: text.trim() };
    commit(next);
  };

  const insertAbove = async (index: number) => {
    const text = await run({ prompt: insertPrompt(ctx, letterText, index), system: SYSTEM }, 'insert');
    if (!text) return;
    const next = [...paragraphs];
    next.splice(index, 0, { id: newId(), text: text.trim(), locked: false });
    commit(next);
  };

  const applyInstruction = async () => {
    if (!instruction.trim()) return;
    const locked = paragraphs.filter((p) => p.locked).map((p) => p.text);
    const text = await run(
      { prompt: promptWithInstruction(ctx, letterText, instruction, locked), system: SYSTEM, json: true },
      'revising',
    );
    if (!text) return;
    const parsed = parseJsonAnswer<{ paragraphs: string[] }>(text);
    const list = parsed?.paragraphs?.length ? parsed.paragraphs : text.split(/\n{2,}/).filter(Boolean);
    commit(
      list.map((t, i) => ({
        id: paragraphs[i]?.id || newId(),
        text: paragraphs[i]?.locked ? paragraphs[i].text : t.trim(),
        locked: paragraphs[i]?.locked ?? false,
      })),
    );
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
      context_items: ctx.context as any,
      style_settings: style as any,
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
            <CardContent>
              <SourceInput value={job} onChange={setJob} placeholder="Paste the job description here." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Extra context (optional)</CardTitle>
              <CardDescription>Company research, earlier cover letters, recruiter emails.</CardDescription>
            </CardHeader>
            <CardContent>
              <SourceInput value={contextText} onChange={setContextText} rows={5} placeholder="Anything else that helps." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Style and tone</CardTitle>
              <CardDescription>Get suggestions, tap the ones you want, and add your own notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <div>
                <Label htmlFor="tone">Your own tone instructions</Label>
                <Textarea
                  id="tone"
                  rows={3}
                  value={style.custom}
                  onChange={(e) => setStyle((s) => ({ ...s, custom: e.target.value }))}
                  placeholder="e.g. confident but understated, mention my move into healthcare"
                />
              </div>
              <Button className="w-full" disabled={!ready || isBusy} onClick={generate}>
                {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                {paragraphs.length ? 'Write a new draft' : 'Write my cover letter'}
              </Button>
              {!ready && (
                <p className="text-xs text-muted-foreground">
                  Add your background and the job description to start.
                </p>
              )}
            </CardContent>
          </Card>
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
                Review
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
                <CardTitle className="text-base">Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review}</p>
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
                  <CardDescription>Locked paragraphs are left untouched.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
