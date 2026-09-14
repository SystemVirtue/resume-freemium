import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ALLOWED_MODELS = new Set([
  'google/gemini-3.8-flash',
  'google/gemini-3.1-flash-lite',
  'openai/gpt-5.4-mini',
]);

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
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'AI is not configured on the server.' }, 500);

    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.slice(0, 30000) : '';
    const system = typeof body?.system === 'string' ? body.system.slice(0, 8000) : '';
    const wantJson = body?.json === true;
    const model = ALLOWED_MODELS.has(body?.model) ? body.model : 'google/gemini-3.8-flash';

    if (!prompt) return json({ error: 'A prompt is required.' }, 400);

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
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
