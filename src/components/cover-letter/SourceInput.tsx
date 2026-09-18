import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Link as LinkIcon, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ExtractMode, ExtractResult, extractTextFromFile, extractTextFromUrl } from '@/lib/extract';

interface SourceInputProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  rows?: number;
  /** 'job' trims job-listing boilerplate and offers the full text back. */
  mode?: ExtractMode;
}

/** Text box plus file upload and link import, all resolving to structured plain text. */
export const SourceInput: React.FC<SourceInputProps> = ({
  value,
  onChange,
  placeholder,
  rows = 8,
  mode = 'plain',
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [trim, setTrim] = useState<{ removed: number; full: string } | null>(null);

  const append = (base: string, text: string) => (base.trim() ? `${base.trim()}\n\n${text}` : text);

  const wrap = async (fn: () => Promise<ExtractResult>) => {
    setBusy(true);
    try {
      const result = await fn();
      onChange(append(value, result.text));
      setTrim(
        result.trimmed && result.fullText
          ? { removed: result.removedChars, full: append(value, result.fullText) }
          : null,
      );
    } catch (err: any) {
      toast({ title: 'Could not read that', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {trim && (
        <p className="text-xs text-muted-foreground">
          Removed about {Math.round(trim.removed / 100) * 100} characters of page navigation, footers and
          boilerplate.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              onChange(trim.full);
              setTrim(null);
            }}
          >
            Restore the full text
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.html,.htm,.rtf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) wrap(() => extractTextFromFile(file, mode));
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Upload file
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !url.trim()}
            onClick={() => {
              const link = url.trim();
              setUrl('');
              wrap(() => extractTextFromUrl(link, mode));
            }}
          >
            <LinkIcon className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
};
