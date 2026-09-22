import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Flag,
  Lock,
  LockOpen,
  Plus,
  Quote,
  RefreshCw,
  Repeat,
  Scale,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Paragraph } from '@/lib/coverLetter';

interface ParagraphCardProps {
  paragraph: Paragraph;
  index: number;
  total: number;
  busy: boolean;
  onEdit: (text: string) => void;
  onToggleLock: () => void;
  onMove: (dir: -1 | 1) => void;
  onRephrase: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onInsertAbove: () => void;
}

/**
 * One flag area, three distinct kinds of problem told apart at a glance:
 * red for factual problems (unsupported, misattributed, ad echoes),
 * primary for rule conflicts, amber for repetition flags.
 */
export const ParagraphCard: React.FC<ParagraphCardProps> = ({
  paragraph,
  index,
  total,
  busy,
  onEdit,
  onToggleLock,
  onMove,
  onRephrase,
  onRegenerate,
  onRemove,
  onInsertAbove,
}) => {
  const unsupported = paragraph.unsupported?.filter(Boolean) || [];
  const misattributed = paragraph.misattributed?.filter(Boolean) || [];
  const echoes = paragraph.echoes?.filter(Boolean) || [];
  const ruleFlags = paragraph.ruleFlags?.filter((r) => r.rule || r.fragment) || [];
  const repetition = paragraph.repetition?.filter(Boolean) || [];
  const sources = paragraph.sources?.filter((s) => s.source || s.claim) || [];
  const factualCount = unsupported.length + misattributed.length + echoes.length;

  return (
    <Card
      className={
        factualCount > 0
          ? 'border-destructive/60'
          : ruleFlags.length > 0 || repetition.length > 0
            ? 'border-primary/40'
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

        {(factualCount > 0 || ruleFlags.length > 0 || repetition.length > 0) && (
          <div
            className={`rounded-md border p-3 space-y-2 ${
              factualCount > 0
                ? 'border-destructive/50 bg-destructive/5'
                : ruleFlags.length > 0
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-amber-500/50 bg-amber-500/5'
            }`}
          >
            {unsupported.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Not supported by your background — check or remove
                </p>
                {unsupported.map((s, i) => (
                  <p key={`u${i}`} className="text-xs text-muted-foreground">
                    “{s}”
                  </p>
                ))}
              </div>
            )}

            {misattributed.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <Scale className="h-3.5 w-3.5" />
                  Credited to the wrong employer or context
                </p>
                {misattributed.map((s, i) => (
                  <p key={`m${i}`} className="text-xs text-muted-foreground">
                    {s}
                  </p>
                ))}
              </div>
            )}

            {echoes.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <Flag className="h-3.5 w-3.5" />
                  Echoes the ad's wording
                </p>
                {echoes.map((s, i) => (
                  <p key={`e${i}`} className="text-xs text-muted-foreground">
                    “{s}”
                  </p>
                ))}
              </div>
            )}

            {ruleFlags.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Bell className="h-3.5 w-3.5" />
                  Rule conflicts
                </p>
                {ruleFlags.map((r, i) => (
                  <p key={`r${i}`} className="text-xs text-muted-foreground">
                    {r.fragment ? (
                      <>
                        Breaks your rule “{r.rule}”: “{r.fragment}”
                      </>
                    ) : (
                      <>Breaks your rule: {r.rule}</>
                    )}
                  </p>
                ))}
              </div>
            )}

            {repetition.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Repeat className="h-3.5 w-3.5" />
                  Repetition
                </p>
                {repetition.map((s, i) => (
                  <p key={`p${i}`} className="text-xs text-muted-foreground">
                    {s}
                  </p>
                ))}
              </div>
            )}
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
