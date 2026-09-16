import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowDown,
  ArrowUp,
  Lock,
  LockOpen,
  Plus,
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
}) => (
  <Card className={paragraph.locked ? 'border-primary/50' : undefined}>
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
