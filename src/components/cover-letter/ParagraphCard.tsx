import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowDown, ArrowUp, Bell, Eye, Flag, Lock, LockOpen, Plus, Quote, RefreshCw, Repeat, Scale, Sparkles, Trash2 } from 'lucide-react';
import { Paragraph } from '@/lib/coverLetter';

interface ParagraphCardProps {
  paragraph: Paragraph;
  index: number;
  total: number;
  busy: boolean;
  showMarkup: boolean;
  onDismiss: (key: string) => void;
  onEdit: (text: string) => void;
  onToggleLock: () => void;
  onMove: (dir: -1 | 1) => void;
  onRephrase: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onInsertAbove: () => void;
}

export const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, index, total, busy, showMarkup, onDismiss, onEdit, onToggleLock, onMove, onRephrase, onRegenerate, onRemove, onInsertAbove }) => {
  const dismissed = new Set(paragraph.dismissedFlags || []);
  const unsupported = (paragraph.unsupported || []).filter((value) => value && !dismissed.has(`unsupported:${value}`));
  const misattributed = (paragraph.misattributed || []).filter((value) => value && !dismissed.has(`misattributed:${value}`));
  const echoes = (paragraph.echoes || []).filter((value) => value && !dismissed.has(`echoes:${value}`));
  const scopeInflation = (paragraph.scopeInflation || []).filter((value) => value && !dismissed.has(`scopeInflation:${value}`));
  const employerDescriptions = (paragraph.employerDescriptions || []).filter((value) => value && !dismissed.has(`employerDescriptions:${value}`));
  const pivots = (paragraph.pivots || []).filter((value) => value && !dismissed.has(`pivots:${value}`));
  const emptyOpenings = (paragraph.emptyOpenings || []).filter((value) => value && !dismissed.has(`emptyOpenings:${value}`));
  const structureFlags = (paragraph.structureFlags || []).filter((value) => value && !dismissed.has(`structureFlags:${value}`));
  const ruleFlags = (paragraph.ruleFlags || []).filter((value) => (value.rule || value.fragment) && !dismissed.has(`rules:${value.rule}|${value.fragment}`));
  const repetition = (paragraph.repetition || []).filter((value) => value && !dismissed.has(`repetition:${value}`));
  const sources = (paragraph.sources || []).filter((source) => source.source || source.claim);
  const hasFindings = Boolean(unsupported.length || misattributed.length || echoes.length || scopeInflation.length || employerDescriptions.length || pivots.length || emptyOpenings.length || structureFlags.length || ruleFlags.length || repetition.length);
  const hasInspection = hasFindings || sources.length > 0;
  const hasDismissedText = Boolean(paragraph.dismissedFlags?.length);
  const factual = Boolean(unsupported.length || misattributed.length || echoes.length || scopeInflation.length || employerDescriptions.length);

  const section = (label: string, values: string[], keyFor: (value: string) => string, icon: React.ReactNode, tone: string) => values.length > 0 && (
    <div key={label}>
      <p className={`flex items-center gap-1 text-xs font-medium ${tone}`}>{icon}{label}</p>
      {values.map((value) => {
        const key = keyFor(value);
        return <div key={key} className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{value}</p>
          <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-[10px]" onClick={() => onDismiss(key)}>Dismiss</Button>
        </div>;
      })}
    </div>
  );

  return <Card className={paragraph.locked ? 'border-primary/50' : showMarkup && factual ? 'border-destructive/40' : showMarkup && hasFindings ? 'border-amber-500/30' : undefined}>
    <CardContent className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">Paragraph {index + 1}</span>
          {hasInspection && <span title={`${hasFindings ? 'Checks' : ''}${hasFindings && sources.length ? ' and ' : ''}${sources.length ? 'sources' : ''} to inspect`}><Eye className={`h-3.5 w-3.5 ${hasFindings ? 'text-amber-600' : 'text-muted-foreground'}`} /></span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onInsertAbove} title="Insert a new paragraph above"><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"><ArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onToggleLock} title={paragraph.locked ? 'Unlock' : 'Lock'}>{paragraph.locked ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4" />}</Button>
        </div>
      </div>
      <Textarea value={paragraph.text} rows={5} readOnly={paragraph.locked || hasDismissedText} onChange={(event) => onEdit(event.target.value)} />

      {showMarkup && hasFindings && <div className={`space-y-2 rounded-md border p-3 ${factual ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
        {section('Unsupported claims', unsupported.map((value) => `“${value}” — check or remove`), (value) => `unsupported:${value.replace(/^“|” — check or remove$/g, '')}`, <AlertTriangle className="h-3.5 w-3.5" />, 'text-destructive')}
        {section('Misattributed facts', misattributed, (value) => `misattributed:${value}`, <Scale className="h-3.5 w-3.5" />, 'text-destructive')}
        {section('Ad echoes', echoes.map((value) => `“${value}”`), (value) => `echoes:${value.slice(1, -1)}`, <Flag className="h-3.5 w-3.5" />, 'text-destructive')}
        {section('Scope inflation', scopeInflation, (value) => `scopeInflation:${value}`, <Scale className="h-3.5 w-3.5" />, 'text-destructive')}
        {section('Employer description', employerDescriptions, (value) => `employerDescriptions:${value}`, <Flag className="h-3.5 w-3.5" />, 'text-destructive')}
        {section('Pivot constructions', pivots, (value) => `pivots:${value}`, <Flag className="h-3.5 w-3.5" />, 'text-amber-700 dark:text-amber-400')}
        {section('Empty openings', emptyOpenings, (value) => `emptyOpenings:${value}`, <AlertTriangle className="h-3.5 w-3.5" />, 'text-amber-700 dark:text-amber-400')}
        {section('Letter structure', structureFlags, (value) => `structureFlags:${value}`, <AlertTriangle className="h-3.5 w-3.5" />, 'text-amber-700 dark:text-amber-400')}
        {section('Rule conflicts', ruleFlags.map((value) => value.fragment ? `Breaks your rule “${value.rule}”: “${value.fragment}”` : `Breaks your rule: ${value.rule}`), (value) => {
          const match = ruleFlags.find((flag) => value === (flag.fragment ? `Breaks your rule “${flag.rule}”: “${flag.fragment}”` : `Breaks your rule: ${flag.rule}`));
          return match ? `rules:${match.rule}|${match.fragment}` : `rules:${value}`;
        }, <Bell className="h-3.5 w-3.5" />, 'text-primary')}
        {section('Repetition', repetition, (value) => `repetition:${value}`, <Repeat className="h-3.5 w-3.5" />, 'text-amber-700 dark:text-amber-400')}
      </div>}

      {showMarkup && sources.length > 0 && <div className="space-y-1 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">Sources</p>
        {sources.map((source, sourceIndex) => <p key={sourceIndex} className="flex items-start gap-1 text-xs text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0" /><span>{source.claim ? `“${source.claim}” — ${source.source}` : source.source}</span></p>)}
      </div>}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy || paragraph.locked || hasDismissedText} onClick={onRephrase}><Sparkles className="mr-1 h-4 w-4" />Rephrase</Button>
        <Button variant="outline" size="sm" disabled={busy || paragraph.locked || hasDismissedText} onClick={onRegenerate}><RefreshCw className="mr-1 h-4 w-4" />Regenerate</Button>
        <Button variant="outline" size="sm" disabled={paragraph.locked || hasDismissedText} className="text-destructive hover:text-destructive" onClick={onRemove}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
      </div>
    </CardContent>
  </Card>;
};
