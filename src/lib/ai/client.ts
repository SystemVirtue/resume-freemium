import { supabase } from '@/integrations/supabase/client';
import { AiError, AiRequest, AiSettings, DEFAULT_MODELS } from './types';
import { loadPuter } from './puter';

async function callLovable(req: AiRequest, model: string | null): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      prompt: req.prompt,
      system: req.system,
      json: req.json ?? false,
      model: model || DEFAULT_MODELS.lovable,
    },
  });

  if (error) throw new AiError(error.message || 'The AI assistant could not be reached.');
  if (!data?.text) throw new AiError(data?.error || 'The AI assistant returned an empty answer.');
  return data.text as string;
}

async function callOpenRouter(req: AiRequest, model: string | null, key: string | null): Promise<string> {
  if (!key) throw new AiError('Add your OpenRouter API key to use OpenRouter models.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Resume Builder',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.openrouter,
      messages: [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        { role: 'user', content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new AiError('That OpenRouter key was rejected. Check it and try again.');
    if (res.status === 429) throw new AiError('OpenRouter is rate limiting the free model. Wait a moment and retry.');
    throw new AiError(`OpenRouter error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiError('OpenRouter returned an empty answer.');
  return text as string;
}

async function callPuter(req: AiRequest, model: string | null): Promise<string> {
  const puter = await loadPuter();
  if (!puter.auth.isSignedIn()) {
    throw new AiError('Sign in to your free puter.com account to use these models.');
  }

  const prompt = [req.system, req.prompt].filter(Boolean).join('\n\n');
  const response = await puter.ai.chat(prompt, { model: model || DEFAULT_MODELS.puter });

  const text =
    typeof response === 'string'
      ? response
      : response?.message?.content ??
        (Array.isArray(response?.message?.content)
          ? response.message.content.map((p: any) => p?.text ?? '').join('')
          : response?.text);

  if (!text) throw new AiError('Puter returned an empty answer.');
  return String(text);
}

export async function callAi(settings: AiSettings, req: AiRequest): Promise<string> {
  switch (settings.provider) {
    case 'openrouter':
      return callOpenRouter(req, settings.model, settings.openRouterKey);
    case 'puter':
      return callPuter(req, settings.model);
    default:
      return callLovable(req, settings.model);
  }
}

/** Best-effort JSON parse of a model answer that may be fenced or padded with prose. */
export function parseJsonAnswer<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0).concat([0]),
  );
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return null;
  }
}
