import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Read plain text out of an uploaded file (pdf, docx, txt, md, html). */
export async function extractTextFromFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.text) throw new Error(data?.error || 'That file could not be read.');
  return data.text as string;
}

/** Read plain text out of a web page or online document. */
export async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.text) throw new Error(data?.error || 'That link could not be read.');
  return data.text as string;
}
