import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Lock,
  LockOpen,
  Plus,
  Quote,
  RefreshCw,
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
  const echoes = paragraph.echoes?.filter(Boolean) || [];
  const sources = paragraph.sources?.filter(Boolean) || [];

  return (
    <Card
      className={
        unsupported.length ? 'border-destructive/60' : paragraph.locked ? 'border-primary/50' : undefined
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

        {unsupported.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Not supported by your background — check or remove
            </p>
            {unsupported.map((s, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                “{s}”
              </p>
            ))}
          </div>
        )}

        {echoes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Echoes the ad's wording: {echoes.map((e) => `“${e}”`).join(', ')}
          </p>
        )}

        {sources.length > 0 && (
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <Quote className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Sources: {sources.join(' · ')}</span>
          </p>
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
