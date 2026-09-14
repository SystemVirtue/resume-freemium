import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import mammoth from 'npm:mammoth@1.8.0';

const MAX_CHARS = 40000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const contentType = req.headers.get('content-type') || '';

    // URL mode
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null);
      const url = typeof body?.url === 'string' ? body.url.trim() : '';
      if (!/^https?:\/\//i.test(url)) return json({ error: 'Provide a valid http(s) link.' }, 400);

      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumeBuilder/1.0)' } });
      if (!res.ok) return json({ error: `Could not open that link (${res.status}).` }, 400);

      const type = res.headers.get('content-type') || '';
      if (type.includes('pdf')) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text } = await extractText(pdf, { mergePages: true });
        return json({ text: String(text).slice(0, MAX_CHARS) });
      }
      const raw = await res.text();
      const text = type.includes('html') || raw.trimStart().startsWith('<') ? htmlToText(raw) : raw;
      if (!text.trim()) return json({ error: 'That page had no readable text.' }, 400);
      return json({ text: text.slice(0, MAX_CHARS) });
    }

    // File upload mode
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'No file was received.' }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: 'Files must be under 10 MB.' }, 400);

    const name = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();

    let text = '';
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const extracted = await extractText(pdf, { mergePages: true });
      text = String(extracted.text);
    } else if (name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: new Uint8Array(buffer) });
      text = result.value;
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      text = htmlToText(new TextDecoder().decode(buffer));
    } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rtf')) {
      text = new TextDecoder().decode(buffer);
    } else {
      return json({ error: 'Supported files are PDF, DOCX, TXT, MD and HTML.' }, 400);
    }

    if (!text.trim()) return json({ error: 'No readable text was found in that file.' }, 400);
    return json({ text: text.replace(/\n{3,}/g, '\n\n').slice(0, MAX_CHARS) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not read that source.' }, 500);
  }
});
