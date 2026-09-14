import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useAiSettings } from '@/contexts/AiSettingsContext';
import { PROVIDER_LABELS } from '@/lib/ai/types';
import { AiAssistantDialog } from './AiAssistantDialog';

export const AiAssistantButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { settings, isProviderReady } = useAiSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 mr-2 text-primary" />
        {compact ? 'AI' : PROVIDER_LABELS[settings.provider]}
        {!isProviderReady() && <span className="ml-2 text-xs text-destructive">setup</span>}
      </Button>
      <AiAssistantDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
