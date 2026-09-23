import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, FolderOpen, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SavedLetterRow, savedLetterSummary } from '@/lib/savedLetters';

interface SavedLettersProps {
  rows: SavedLetterRow[];
  currentId: string | null;
  /** The letter a returning user most likely wants, when they are not already in one. */
  continueId: string | null;
  loading: boolean;
  /** There is work on screen that has not been written down yet. */
  dirty: boolean;
  /** Something to clear first — a draft, or a title that was changed. */
  hasWork: boolean;
  onOpen: (row: SavedLetterRow) => void;
  onDelete: (row: SavedLetterRow) => void;
  onNew: () => void;
  onRefresh: () => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return d.toLocaleDateString();
  }
};

/**
 * The way back in. Letters were being written to the account and never offered
 * again, so a returning user started from an empty form every time.
 */
export const SavedLetters: React.FC<SavedLettersProps> = ({
  rows,
  currentId,
  continueId,
  loading,
  dirty,
  hasWork,
  onOpen,
  onDelete,
  onNew,
  onRefresh,
}) => (
  <Card>
    <CardContent className="space-y-3 pt-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Your letters</span>
        {rows.length > 0 && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {rows.length}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Reload saved letters"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={onNew} disabled={!hasWork && !currentId}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {loading
            ? 'Looking for your saved letters…'
            : 'Nothing saved yet. Press Save once and this letter waits here for you next time.'}
        </p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {rows.map((row, i) => {
            const s = savedLetterSummary(row);
            const open = row.id === currentId;
            const recent = !open && row.id === continueId;
            return (
              <div
                key={s.id || i}
                className={`group flex items-start gap-2 rounded-md border p-2 text-left transition-colors ${
                  open
                    ? 'border-primary/50 bg-primary/5'
                    : recent
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                  onClick={() => onOpen(row)}
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{s.title}</span>
                    {open && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        open
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {recent && 'Continue where you left off - '}
                    {s.paragraphs === 0
                      ? 'No draft yet'
                      : `${s.words} words`}
                    {s.updatedAt && ` · saved ${when(s.updatedAt)}`}
                  </span>
                  {s.preview && (
                    <span className="truncate text-xs text-muted-foreground/70">{s.preview}</span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${s.title}`}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {dirty && (
        <p className="text-[11px] text-muted-foreground">
          Unsaved changes on this draft.
        </p>
      )}
    </CardContent>
  </Card>
);
