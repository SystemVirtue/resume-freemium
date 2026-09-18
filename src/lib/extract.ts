import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`;

export interface ExtractResult {
  text: string;
  /** The untrimmed text, when boilerplate was removed. */
  fullText?: string;
  trimmed: boolean;
  removedChars: number;
}

/** 'job' trims scraped job-listing boilerplate; 'plain' keeps everything. */
export type ExtractMode = 'plain' | 'job';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalise(data: any, fallback: string): ExtractResult {
  if (!data?.text) throw new Error(data?.error || fallback);
  return {
    text: data.text as string,
    fullText: data.fullText as string | undefined,
    trimmed: Boolean(data.trimmed),
    removedChars: Number(data.removedChars || 0),
  };
}

/** Read structured plain text out of an uploaded file (pdf, docx, txt, md, html). */
export async function extractTextFromFile(file: File, mode: ExtractMode = 'plain'): Promise<ExtractResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode);
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'That file could not be read.');
  return normalise(data, 'That file could not be read.');
}

/** Read structured plain text out of a web page or online document. */
export async function extractTextFromUrl(url: string, mode: ExtractMode = 'plain'): Promise<ExtractResult> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'That link could not be read.');
  return normalise(data, 'That link could not be read.');
}
