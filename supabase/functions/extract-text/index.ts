import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import mammoth from 'npm:mammoth@1.8.0';

const MAX_CHARS = 40000;

/** HTML → text, keeping paragraph breaks and marking headings. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<h([1-6])[^>]*>/gi, '\n\n## ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/(p|div|section|article|tr|ul|ol|table)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A short line with no terminal punctuation, used as a section/job heading. */
function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 70 || t.startsWith('##') || t.startsWith('-')) return false;
  if (/[.,;:]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 9) return false;
  const isAllCaps = t === t.toUpperCase() && /[A-Z]{3}/.test(t);
  const isTitleCase = words.filter((w) => /^[A-Z]/.test(w)).length >= Math.ceil(words.length * 0.6);
  return isAllCaps || (isTitleCase && words.length <= 6);
}

/**
 * Keep the structure of an extracted document: blank lines between blocks,
 * `## ` in front of likely headings so a job title never merges into the
 * paragraph under it.
 */
function structure(raw: string): string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  lines.forEach((line) => {
    const t = line.trim();
    if (!t) {
      if (out[out.length - 1] !== '') out.push('');
      return;
    }
    if (t.startsWith('##')) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(t);
      out.push('');
      return;
    }
    if (looksLikeHeading(t)) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`## ${t}`);
      return;
    }
    out.push(t);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const BOILERPLATE = [
  /^(home|jobs|sign in|sign up|log ?in|register|menu|search|skip to( main)? content)$/i,
  /^(save|saved|share|apply now|quick apply|report this job|report ad|print)$/i,
  /^(terms( (and|&) conditions)?|privacy( policy)?|cookie[s]?( policy| settings| preferences)?|accessibility|sitemap|about us|contact us|careers advice|help( centre| center)?|faq[s]?)$/i,
  /^©|^copyright/i,
  /^(all rights reserved|follow us|download the app|app store|google play)/i,
  /^(australia|new zealand|hong kong|singapore|malaysia|philippines|thailand|indonesia|united kingdom|united states|canada|ireland|india|china|japan)$/i,
  /^(view all jobs|similar jobs|more jobs|recommended jobs|jobs by (location|classification|company|industry))/i,
  /^(sign in to|create( a)? (free )?account|be careful|don'?t provide your bank)/i,
  /^\d+\s*(d|h|m)\s*ago$/i,
];

const AD_START = /(about (the|this) (role|position|opportunity)|the (role|opportunity|position)|position description|job description|role description|about (us|the company)|what you'?ll (do|be doing)|key responsibilities|responsibilities|the opportunity)/i;
const AD_END = /(how to apply|to apply|apply now|similar jobs|report this job|you may also be interested|job details|save this job|share this job)/i;

/** Trim a scraped job listing page down to the advertisement itself. */
function trimJobAd(text: string): { text: string; removedChars: number } {
  const original = text;
  let lines = text.split('\n');

  lines = lines.filter((line) => {
    const t = line.replace(/^##\s*/, '').trim();
    if (!t) return true;
    return !BOILERPLATE.some((re) => re.test(t));
  });

  let body = lines.join('\n');

  const start = body.search(AD_START);
  if (start > 200) body = body.slice(start);

  const endMatch = body.slice(400).search(AD_END);
  if (endMatch > 0) body = body.slice(0, 400 + endMatch);

  body = body.replace(/\n{3,}/g, '\n\n').trim();

  // Only accept the trim if something meaningful survives.
  if (body.length < 400 && original.trim().length > 400) {
    return { text: original.trim(), removedChars: 0 };
  }
  return { text: body, removedChars: Math.max(0, original.trim().length - body.length) };
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

  const finish = (raw: string, mode: string) => {
    const structured = structure(raw).slice(0, MAX_CHARS);
    if (mode === 'job') {
      const { text, removedChars } = trimJobAd(structured);
      return json({ text, fullText: structured, trimmed: removedChars > 0, removedChars });
    }
    return json({ text: structured, trimmed: false, removedChars: 0 });
  };

  try {
    const contentType = req.headers.get('content-type') || '';

    // URL mode
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null);
      const url = typeof body?.url === 'string' ? body.url.trim() : '';
      const mode = body?.mode === 'job' ? 'job' : 'plain';
      if (!/^https?:\/\//i.test(url)) return json({ error: 'Provide a valid http(s) link.' }, 400);

      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumeBuilder/1.0)' } });
      if (!res.ok) return json({ error: `Could not open that link (${res.status}).` }, 400);

      const type = res.headers.get('content-type') || '';
      if (type.includes('pdf')) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text } = await extractText(pdf, { mergePages: true });
        return finish(String(text), mode);
      }
      const raw = await res.text();
      const text = type.includes('html') || raw.trimStart().startsWith('<') ? htmlToText(raw) : raw;
      if (!text.trim()) return json({ error: 'That page had no readable text.' }, 400);
      return finish(text, mode);
    }

    // File upload mode
    const form = await req.formData();
    const file = form.get('file');
    const mode = form.get('mode') === 'job' ? 'job' : 'plain';
    if (!(file instanceof File)) return json({ error: 'No file was received.' }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: 'Files must be under 10 MB.' }, 400);

    const name = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();

    let text = '';
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const extracted = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text)];
      text = pages.join('\n\n');
    } else if (name.endsWith('.docx')) {
      // Convert to HTML first so paragraphs and headings survive.
      const result = await mammoth.convertToHtml({ buffer: new Uint8Array(buffer) });
      text = htmlToText(result.value);
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      text = htmlToText(new TextDecoder().decode(buffer));
    } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rtf')) {
      text = new TextDecoder().decode(buffer);
    } else {
      return json({ error: 'Supported files are PDF, DOCX, TXT, MD and HTML.' }, 400);
    }

    if (!text.trim()) return json({ error: 'No readable text was found in that file.' }, 400);
    return finish(text, mode);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not read that source.' }, 500);
  }
});
