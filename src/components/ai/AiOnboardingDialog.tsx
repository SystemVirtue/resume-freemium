import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, KeyRound, Globe, Check } from 'lucide-react';
import { useAiSettings } from '@/contexts/AiSettingsContext';
import { AiProviderId } from '@/lib/ai/types';
import { useAuth } from '@/contexts/AuthContext';

const OPTIONS: Array<{
  id: AiProviderId;
  title: string;
  icon: React.ElementType;
  cost: string;
  setup: string;
}> = [
  {
    id: 'lovable',
    title: 'Lovable AI',
    icon: Sparkles,
    cost: 'Included, nothing to pay',
    setup: 'Nothing to set up — works straight away.',
  },
  {
    id: 'openrouter',
    title: 'OpenRouter free models',
    icon: KeyRound,
    cost: 'Free models on your own account',
    setup: 'Paste your OpenRouter key. It stays in this browser only.',
  },
  {
    id: 'puter',
    title: 'Puter.com free models',
    icon: Globe,
    cost: 'Free with a Puter account',
    setup: 'Sign in to Puter in a small popup. No key to manage.',
  },
];

export const AiOnboardingDialog: React.FC = () => {
  const { user } = useAuth();
  const { settings, setProvider, onboardingSeen, markOnboardingSeen } = useAiSettings();
  const open = Boolean(user) && !onboardingSeen;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && markOnboardingSeen()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose your AI assistant</DialogTitle>
          <DialogDescription>
            Every AI feature here — resume help and the Cover Letter Crafter — runs through the
            assistant you pick. You can change it at any time from the AI button.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = settings.provider === option.id;
            return (
              <Card
                key={option.id}
                onClick={() => setProvider(option.id)}
                className={`cursor-pointer transition-smooth ${
                  selected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                }`}
              >
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6 text-primary" />
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <h3 className="font-semibold">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.cost}</p>
                  <p className="text-sm text-muted-foreground">{option.setup}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={markOnboardingSeen}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
