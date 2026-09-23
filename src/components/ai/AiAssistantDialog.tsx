import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useAiSettings } from '@/contexts/AiSettingsContext';
import { AiProviderId, DEFAULT_MODELS, PUTER_MODELS } from '@/lib/ai/types';
import { puterSignIn } from '@/lib/ai/puter';
import { toast } from '@/hooks/use-toast';

const OPTIONS: Array<{
  id: AiProviderId;
  title: string;
  cost: string;
  setup: string;
  detail: string;
}> = [
  {
    id: 'lovable',
    title: 'Lovable AI',
    cost: 'Free to you — no account needed',
    setup: 'Nothing to set up',
    detail: 'The built-in assistant. Works straight away and is the fastest way to get started.',
  },
  {
    id: 'openrouter',
    title: 'OpenRouter free models',
    cost: 'Free tier models on your own account',
    setup: 'Paste your OpenRouter API key',
    detail:
      'Use your own OpenRouter key and pick any free model. The key is stored on the server and never sent from this browser.',
  },
  {
    id: 'puter',
    title: 'Puter.com free models',
    cost: 'Free with a Puter account',
    setup: 'Sign in to puter.com in a popup',
    detail:
      'Puter covers the model cost. No keys to manage — just sign in once per browser. This one runs in the browser, using your own Puter session; the other providers go through our server.',
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First-run mode shows a welcome framing and a "get started" close button. */
  welcome?: boolean;
}

export const AiAssistantDialog: React.FC<Props> = ({ open, onOpenChange, welcome }) => {
  const { settings, setProvider, setModel, setOpenRouterKey, puterReady, refreshPuter, isProviderReady } =
    useAiSettings();
  const [keyDraft, setKeyDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // The key is written to the server and never comes back to this component.
  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const set = await setOpenRouterKey(keyDraft.trim() || null);
      setKeyDraft('');
      toast({
        title: set ? 'Key saved on the server' : 'Key removed',
        description: set
          ? 'Requests now go through the server, so the key stays out of your browser.'
          : undefined,
      });
    } catch (err: any) {
      toast({ title: 'Could not save that key', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const handlePuterSignIn = async () => {
    setSigningIn(true);
    try {
      const ok = await puterSignIn();
      await refreshPuter();
      toast({
        title: ok ? 'Puter connected' : 'Sign-in not completed',
        description: ok ? 'Free Puter models are ready to use.' : 'Try the sign-in popup again.',
        variant: ok ? 'default' : 'destructive',
      });
    } catch (err: any) {
      toast({ title: 'Puter sign-in failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {welcome ? 'Welcome — choose your AI assistant' : 'AI assistant'}
          </DialogTitle>
          <DialogDescription>
            Every feature is free. You only choose which AI writes and rewrites your words — and you can
            switch at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {OPTIONS.map((option) => {
            const active = settings.provider === option.id;
            return (
              <Card
                key={option.id}
                role="button"
                tabIndex={0}
                onClick={() => setProvider(option.id)}
                onKeyDown={(e) => e.key === 'Enter' && setProvider(option.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{option.title}</h3>
                      {active && <Badge variant="secondary">Selected</Badge>}
                      {isProviderReady(option.id) ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Badge variant="outline">Setup needed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{option.detail}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {option.cost} · {option.setup}
                    </p>
                  </div>
                </div>

                {active && option.id === 'openrouter' && (
                  <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Label htmlFor="or-key">OpenRouter API key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="or-key"
                        type="password"
                        placeholder="sk-or-..."
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                      />
                      <Button variant="secondary" disabled={savingKey} onClick={handleSaveKey}>
                        {savingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {settings.openRouterKeySet
                        ? 'A key is stored on the server. Paste a new one to replace it, or save an empty field to remove it.'
                        : 'Nothing stored yet. The key is sent once, kept on the server, and never read back.'}
                    </p>
                    <Label htmlFor="or-model">Model</Label>
                    <Input
                      id="or-model"
                      value={settings.model || DEFAULT_MODELS.openrouter}
                      onChange={(e) => setModel(e.target.value)}
                    />
                    <a
                      href="https://openrouter.ai/models?max_price=0"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1"
                    >
                      Browse free models <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {active && option.id === 'puter' && (
                  <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" onClick={handlePuterSignIn} disabled={signingIn}>
                      {signingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {puterReady ? 'Puter connected — sign in again' : 'Sign in to puter.com'}
                    </Button>
                    <div>
                      <Label className="text-xs">Model</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PUTER_MODELS.map((m) => (
                          <Button
                            key={m}
                            size="sm"
                            variant={(settings.model || DEFAULT_MODELS.puter) === m ? 'default' : 'outline'}
                            onClick={() => setModel(m)}
                          >
                            {m}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{welcome ? "Let's get started" : 'Done'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
