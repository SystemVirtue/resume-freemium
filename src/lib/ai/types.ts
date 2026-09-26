export type AiProviderId = 'lovable' | 'openrouter' | 'puter';

export interface AiSettings {
  provider: AiProviderId;
  model: string | null;
  /**
   * Whether the user has an OpenRouter key stored server side. The key itself is
   * never held in the browser: it is written once and read only by the edge
   * function.
   */
  openRouterKeySet: boolean;
}

export interface AiRequest {
  prompt: string;
  system?: string;
  /** Ask the model to answer with JSON only. */
  json?: boolean;
}

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  lovable: 'google/gemini-3.8-flash',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  puter: 'gpt-5-nano',
};

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  lovable: 'Lovable AI',
  openrouter: 'OpenRouter (free models)',
  puter: 'Puter.com (free models)',
};

export const PUTER_MODELS = [
  'gpt-5-nano',
  'gpt-5-mini',
  'claude-sonnet-4',
  'google/gemini-2.5-flash',
];

export class AiError extends Error {}
