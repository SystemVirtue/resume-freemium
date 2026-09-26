import { supabase } from '@/integrations/supabase/client';
import { AiError, AiRequest, AiSettings, DEFAULT_MODELS } from './types';
import { loadPuter } from './puter';

/**
 * Both hosted providers are called from the edge function. The workspace key and
 * the user's own OpenRouter key stay server side, so nothing here handles a
 * credential and nothing here can leak one.
 */
async function callViaFunction(
  provider: 'lovable' | 'openrouter',
  req: AiRequest,
  model: string | null,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      provider,
      prompt: req.prompt,
      system: req.system,
      json: req.json ?? false,
      model: model || DEFAULT_MODELS[provider],
    },
  });

  if (error) throw new AiError(error.message || 'The AI assistant could not be reached.');
  if (!data?.text) throw new AiError(data?.error || 'The AI assistant returned an empty answer.');
  return data.text as string;
}

/** Store or clear the user's OpenRouter key. Sending it is the last the browser sees of it. */
export async function saveOpenRouterKey(key: string | null): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { action: 'save-openrouter-key', key: key || '' },
  });
  if (error) throw new AiError(error.message || 'That key could not be saved.');
  if (data?.error) throw new AiError(data.error);
  return Boolean(data?.set);
}

/**
 * Puter's free tier is a browser SDK that signs the user into their own puter.com
 * account in a popup. There is no app credential to expose, so it is the one
 * provider that cannot be moved behind the edge function — the user's own session
 * authorises the call.
 */
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
      return callViaFunction('openrouter', req, settings.model);
    case 'puter':
      return callPuter(req, settings.model);
    default:
      return callViaFunction('lovable', req, settings.model);
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
