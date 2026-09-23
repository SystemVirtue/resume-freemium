import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AiProviderId, AiSettings, DEFAULT_MODELS } from '@/lib/ai/types';
import { isPuterSignedIn } from '@/lib/ai/puter';
import { saveOpenRouterKey } from '@/lib/ai/client';

const STORAGE_KEY = 'ai-settings';

interface AiSettingsContextValue {
  settings: AiSettings;
  puterReady: boolean;
  refreshPuter: () => Promise<void>;
  setProvider: (provider: AiProviderId) => void;
  setModel: (model: string | null) => void;
  /** Saves the key on the server. The key is never kept in the browser. */
  setOpenRouterKey: (key: string | null) => Promise<boolean>;
  isProviderReady: (provider?: AiProviderId) => boolean;
  onboardingSeen: boolean;
  markOnboardingSeen: () => void;
}

const AiSettingsContext = createContext<AiSettingsContextValue | undefined>(undefined);

function readStored(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: (parsed.provider as AiProviderId) || 'lovable',
        model: parsed.model ?? null,
        openRouterKeySet: Boolean(parsed.openRouterKeySet),
      };
    }
  } catch {
    /* ignore */
  }
  return { provider: 'lovable', model: null, openRouterKeySet: false };
}

export const AiSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AiSettings>(readStored);
  const [puterReady, setPuterReady] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(true);

  useEffect(() => {
    // Only the presence of a key is remembered here; the key itself lives server side.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.provider === 'puter') {
      isPuterSignedIn().then(setPuterReady);
    }
  }, [settings.provider]);

  // Load the saved preference, onboarding flag and key presence for the signed-in user.
  useEffect(() => {
    if (!user) {
      setOnboardingSeen(true);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('ai_provider, ai_model, onboarding_seen, openrouter_key')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      setOnboardingSeen(Boolean(data?.onboarding_seen));
      setSettings((prev) => ({
        ...prev,
        ...(data?.ai_provider
          ? { provider: data.ai_provider as AiProviderId, model: data.ai_model ?? prev.model }
          : {}),
        openRouterKeySet: Boolean((data as any)?.openrouter_key),
      }));
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const persist = useCallback(
    (provider: AiProviderId, model: string | null) => {
      if (!user) return;
      supabase
        .from('profiles')
        .update({ ai_provider: provider, ai_model: model })
        .eq('user_id', user.id)
        .then(() => undefined);
    },
    [user],
  );

  const setProvider = useCallback(
    (provider: AiProviderId) => {
      setSettings((prev) => {
        const model = prev.provider === provider ? prev.model : DEFAULT_MODELS[provider];
        persist(provider, model);
        return { ...prev, provider, model };
      });
    },
    [persist],
  );

  const setModel = useCallback(
    (model: string | null) => {
      setSettings((prev) => {
        persist(prev.provider, model);
        return { ...prev, model };
      });
    },
    [persist],
  );

  const setOpenRouterKey = useCallback(async (key: string | null) => {
    const set = await saveOpenRouterKey(key);
    setSettings((prev) => ({ ...prev, openRouterKeySet: set }));
    return set;
  }, []);

  const refreshPuter = useCallback(async () => {
    setPuterReady(await isPuterSignedIn());
  }, []);

  const isProviderReady = useCallback(
    (provider?: AiProviderId) => {
      const p = provider ?? settings.provider;
      if (p === 'openrouter') return settings.openRouterKeySet;
      if (p === 'puter') return puterReady;
      return true;
    },
    [settings, puterReady],
  );

  const markOnboardingSeen = useCallback(() => {
    setOnboardingSeen(true);
    if (user) {
      supabase
        .from('profiles')
        .update({ onboarding_seen: true })
        .eq('user_id', user.id)
        .then(() => undefined);
    }
  }, [user]);

  const value = useMemo(
    () => ({
      settings,
      puterReady,
      refreshPuter,
      setProvider,
      setModel,
      setOpenRouterKey,
      isProviderReady,
      onboardingSeen,
      markOnboardingSeen,
    }),
    [settings, puterReady, refreshPuter, setProvider, setModel, setOpenRouterKey, isProviderReady, onboardingSeen, markOnboardingSeen],
  );

  return <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>;
};

export function useAiSettings() {
  const ctx = useContext(AiSettingsContext);
  if (!ctx) throw new Error('useAiSettings must be used inside AiSettingsProvider');
  return ctx;
}
