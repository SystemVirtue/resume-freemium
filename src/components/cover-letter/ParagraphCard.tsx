import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  Eye,
  CornerDownRight,
  Flag,
  Info,
  Lock,
  LockOpen,
  Plus,
  Quote,
  RefreshCw,
  MessageSquare,
  Repeat,
  Scale,
  Sparkles,
  Split,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  Flag as LetterFlag,
  FlagDecision,
  FlagDecisions,
  FlagKind,
  FLAG_KIND_META,
  Paragraph,
  visibleFlags,
} from '@/lib/coverLetter';

interface ParagraphCardProps {
  paragraph: Paragraph;
  index: number;
  total: number;
  busy: boolean;
  decisions: FlagDecisions;
  onDecision: (flagId: string, decision: FlagDecision | null) => void;
  onAskInput: (question: string) => void;
  onEdit: (text: string) => void;
  onToggleLock: () => void;
  onMove: (dir: -1 | 1) => void;
  onRephrase: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onInsertAbove: () => void;
}

/** One icon per flag kind, so the kinds are told apart without reading the label. */
const KIND_ICON: Record<FlagKind, React.ComponentType<{ className?: string }>> = {
  unsupported: AlertTriangle,
  misattributed: Scale,
  echo: Flag,
  rule: Bell,
  employer: Eye,
  pivot: Split,
  unresolved: CornerDownRight,
  scope: TrendingUp,
  needsInput: MessageSquare,
  gapStatement: Info,
  repetition: Repeat,
};

const KIND_COLOR: Record<FlagKind, string> = {
  unsupported: 'text-destructive',
  misattributed: 'text-destructive',
  echo: 'text-destructive',
  rule: 'text-primary',
  employer: 'text-amber-700 dark:text-amber-400',
  pivot: 'text-amber-700 dark:text-amber-400',
  unresolved: 'text-amber-700 dark:text-amber-400',
  scope: 'text-muted-foreground',
  needsInput: 'text-primary',
  gapStatement: 'text-primary',
  repetition: 'text-muted-foreground',
};

const KIND_BORDER: Record<FlagKind, string> = {
  unsupported: 'border-destructive/40',
  misattributed: 'border-destructive/40',
  echo: 'border-destructive/40',
  rule: 'border-primary/40',
  employer: 'border-amber-500/40',
  pivot: 'border-amber-500/40',
  unresolved: 'border-amber-500/40',
  scope: 'border-border',
  needsInput: 'border-primary/40',
  gapStatement: 'border-primary/40',
  repetition: 'border-border',
};

/**
 * One card per paragraph. Flags are grouped by kind so each kind reads as its own
 * thing, and every flag carries Approve and Dismiss: dismissed flags are not shown
 * again and their wording is protected on the next revision.
 */
export const ParagraphCard: React.FC<ParagraphCardProps> = ({
  paragraph,
  index,
  total,
  busy,
  decisions,
  onDecision,
  onAskInput,
  onEdit,
  onToggleLock,
  onMove,
  onRephrase,
  onRegenerate,
  onRemove,
  onInsertAbove,
}) => {
  const flags = visibleFlags(paragraph, decisions);
  const sources = paragraph.sources?.filter((s) => s.source || s.claim) || [];

  // Group in priority order; visibleFlags is already sorted.
  const groups: { kind: FlagKind; items: LetterFlag[] }[] = [];
  for (const f of flags) {
    const last = groups[groups.length - 1];
    if (last && last.kind === f.kind) last.items.push(f);
    else groups.push({ kind: f.kind, items: [f] });
  }

  const topTone = groups[0]?.kind;

  return (
    <Card
      className={
        topTone
          ? KIND_BORDER[topTone]
          : paragraph.locked
            ? 'border-primary/50'
            : undefined
      }
    >
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Paragraph {index + 1}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={onInsertAbove} title="Insert a new paragraph above">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)} title="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleLock} title={paragraph.locked ? 'Unlock' : 'Lock'}>
              {paragraph.locked ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Textarea
          value={paragraph.text}
          rows={5}
          readOnly={paragraph.locked}
          onChange={(e) => onEdit(e.target.value)}
        />

        {groups.length > 0 && (
          <div className="space-y-2">
            {groups.map(({ kind, items }) => {
              const meta = FLAG_KIND_META[kind];
              const Icon = KIND_ICON[kind];
              return (
                <div key={kind} className={`rounded-md border p-3 space-y-2 ${KIND_BORDER[kind]}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`flex items-center gap-1 text-xs font-medium ${KIND_COLOR[kind]}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{meta.hint}</span>
                  </div>

                  {items.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-start gap-2">
                      <p className="flex-1 min-w-[200px] text-xs text-muted-foreground">
                        {kind === 'needsInput' ? (
                          <>{f.fragment}</>
                        ) : (
                          <>
                            “<span className="bg-yellow-200/60 dark:bg-yellow-500/20">{f.fragment}</span>”
                            {f.detail !== f.fragment && <span className="ml-1">— {f.detail}</span>}
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        {kind === 'needsInput' && (
                          <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onAskInput(f.fragment || f.detail)}>
                            Answer
                          </Button>
                        )}
                        {f.decision === 'approved' ? (
                          <Badge variant="secondary" className="h-6 text-[11px] font-normal">
                            <Check className="h-3 w-3 mr-1" />
                            Approved — will be addressed
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            title="Address this in the next revision"
                            onClick={() => onDecision(f.id, 'approved')}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          title="This is fine — do not flag it again"
                          onClick={() => onDecision(f.id, 'dismissed')}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Sources</p>
            {sources.map((s, i) => (
              <p key={`s${i}`} className="flex items-start gap-1 text-xs text-muted-foreground">
                <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  {s.claim ? (
                    <>
                      “{s.claim}” — {s.source}
                    </>
                  ) : (
                    s.source
                  )}
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy || paragraph.locked} onClick={onRephrase}>
            <Sparkles className="h-4 w-4 mr-1" />
            Rephrase
          </Button>
          <Button variant="outline" size="sm" disabled={busy || paragraph.locked} onClick={onRegenerate}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Regenerate
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={paragraph.locked}
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
