import { useCallback, useState } from 'react';
import { useAiSettings } from '@/contexts/AiSettingsContext';
import { callAi } from '@/lib/ai/client';
import { AiRequest } from '@/lib/ai/types';
import { toast } from '@/hooks/use-toast';

export function useAi() {
  const { settings } = useAiSettings();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (req: AiRequest, label = 'thinking'): Promise<string | null> => {
      setBusy(label);
      try {
        return await callAi(settings, req);
      } catch (err: any) {
        toast({
          title: 'AI assistant unavailable',
          description: err?.message || 'Something went wrong. Your text was not changed.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [settings],
  );

  return { run, busy, isBusy: busy !== null, provider: settings.provider };
}
