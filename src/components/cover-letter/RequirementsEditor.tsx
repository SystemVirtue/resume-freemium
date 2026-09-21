import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export type RequirementsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'edited'
  | 'stale'
  | 'too-thin';

interface RequirementsEditorProps {
  items: string[];
  status: RequirementsStatus;
  busy: boolean;
  onChange: (items: string[]) => void;
  onMarkEdited: () => void;
  onRefresh: () => void;
  onDismissStale: () => void;
}

function move(items: string[], from: number, to: number): string[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The letter is written to this list — one paragraph per requirement, in order.
 * Not an approval gate: visible, obviously editable, used by those who care.
 */
export const RequirementsEditor: React.FC<RequirementsEditorProps> = ({
  items,
  status,
  busy,
  onChange,
  onMarkEdited,
  onRefresh,
  onDismissStale,
}) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  if (status === 'idle' || status === 'loading') return null;

  if (status === 'too-thin') {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
        This ad looks too thin to extract requirements from — a job title and a line or two. Paste
        the full advertisement (or position description) above and it will try again.
      </div>
    );
  }

  if (!items.length) return null;
  const stale = status === 'stale';

  return (
    <div className="space-y-2">
      {stale && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-400">
            The role field has changed since you edited these. Your edits are kept.
          </span>
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={onRefresh} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Refresh from the ad
          </Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onDismissStale}>
            Keep mine
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-primary" />
              What the role asks for
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {items.length} requirement{items.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            The letter is written to this list — one paragraph each, in this order. Edit freely; it
            is yours.
          </p>

          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    className="text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => {
                      onChange(move(items, i, i - 1));
                      onMarkEdited();
                    }}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    className="text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
                    disabled={i === items.length - 1}
                    onClick={() => {
                      onChange(move(items, i, i + 1));
                      onMarkEdited();
                    }}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  value={item}
                  className="h-8 text-sm"
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = e.target.value;
                    onChange(next);
                    onMarkEdited();
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-destructive/60 hover:text-destructive"
                  aria-label="Remove requirement"
                  onClick={() => {
                    onChange(items.filter((_, idx) => idx !== i));
                    onMarkEdited();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={draft}
                className="h-8 text-sm"
                placeholder="e.g. Manages workflow across an in-house team and external freelancers"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    onChange([...items, draft.trim()]);
                    onMarkEdited();
                    setDraft('');
                    setAdding(false);
                  }
                  if (e.key === 'Escape') setAdding(false);
                }}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  if (draft.trim()) {
                    onChange([...items, draft.trim()]);
                    onMarkEdited();
                  }
                  setDraft('');
                  setAdding(false);
                }}
              >
                Add
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-7" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add requirement
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
