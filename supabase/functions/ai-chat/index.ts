import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_MODELS = new Set([
  'google/gemini-3.8-flash',
  'google/gemini-3.1-flash-lite',
  'openai/gpt-5.4-mini',
]);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/** Never let a caller choose an arbitrary upstream URL or model string. */
const cleanModel = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() && value.length <= 120
    ? value.trim().replace(/[^a-zA-Z0-9._:/-]/g, '')
    : fallback;

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
    const body = await req.json().catch(() => null);

    // The caller's own session decides whose key is read or written.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;

    // ACTION: store or clear the OpenRouter key. It is never returned to the client.
    if (body?.action === 'save-openrouter-key') {
      if (!user) return json({ error: 'Sign in to save an API key.' }, 401);
      const key = typeof body?.key === 'string' ? body.key.trim().slice(0, 300) : '';
      const { error } = await supabase
        .from('profiles')
        .update({ openrouter_key: key || null })
        .eq('user_id', user.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, set: Boolean(key) });
    }

    const provider = body?.provider === 'openrouter' ? 'openrouter' : 'lovable';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.slice(0, 30000) : '';
    const system = typeof body?.system === 'string' ? body.system.slice(0, 12000) : '';
    const wantJson = body?.json === true;

    if (!prompt) return json({ error: 'A prompt is required.' }, 400);

    const messages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ];

    if (provider === 'openrouter') {
      if (!user) return json({ error: 'Sign in to use OpenRouter models.' }, 401);
      const { data: profile } = await supabase
        .from('profiles')
        .select('openrouter_key')
        .eq('user_id', user.id)
        .maybeSingle();
      const key = profile?.openrouter_key;
      if (!key) return json({ error: 'Add your OpenRouter API key in AI settings.' }, 400);

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': req.headers.get('origin') ?? 'https://jobgoblin.app',
          'X-Title': 'JobGoblin',
        },
        body: JSON.stringify({
          model: cleanModel(body?.model, DEFAULT_OPENROUTER_MODEL),
          messages,
          ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        if (res.status === 401) return json({ error: 'That OpenRouter key was rejected. Check it and try again.' }, 401);
        if (res.status === 429) return json({ error: 'OpenRouter is rate limiting the free model. Wait a moment and retry.' }, 429);
        return json({ error: `OpenRouter error (${res.status}): ${detail.slice(0, 200)}` }, 500);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) return json({ error: 'OpenRouter returned an empty answer.' }, 500);
      return json({ text });
    }

    // Lovable gateway, unchanged: the workspace key stays on the server.
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'AI is not configured on the server.' }, 500);

    const model = ALLOWED_MODELS.has(body?.model) ? body.model : 'google/gemini-3.8-flash';

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model,
        messages,
        ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) {
        return json({ error: 'The AI assistant is busy. Try again in a moment.' }, 429);
      }
      if (res.status === 402) {
        return json({ error: 'AI credits are used up for this workspace. Add credits or switch assistant.' }, 402);
      }
      if (res.status === 403) {
        return json({ error: 'AI access is blocked for this workspace. Switch assistant or contact the owner.' }, 403);
      }
      return json({ error: `AI request failed (${res.status}): ${detail.slice(0, 300)}` }, 500);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) return json({ error: 'The AI assistant returned an empty answer.' }, 500);

    return json({ text });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
