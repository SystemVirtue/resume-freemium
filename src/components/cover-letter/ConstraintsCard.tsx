import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ConstraintsCardProps {
  constraints: string[];
  suggestions: string[];
  busy: boolean;
  canSuggest: boolean;
  onChange: (constraints: string[]) => void;
  onSuggest: () => void;
}

/** A constraint, not a preference: things the letter must never claim or mention. */
export const ConstraintsCard: React.FC<ConstraintsCardProps> = ({
  constraints,
  suggestions,
  busy,
  canSuggest,
  onChange,
  onSuggest,
}) => {
  const toggle = (item: string) =>
    onChange(constraints.includes(item) ? constraints.filter((c) => c !== item) : [...constraints, item]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Won't claim
        </CardTitle>
        <CardDescription>
          Things the letter must never claim or mention — one per line. These are absolute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={4}
          value={constraints.join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          placeholder={'e.g. years of experience or career length\nanything about front-end development'}
        />
        <Button variant="outline" size="sm" disabled={!canSuggest || busy} onClick={onSuggest}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Find gaps between the ad and my background
        </Button>
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              The ad asks for these, but your background doesn't clearly support them. Tap any you won't claim.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Badge
                  key={s}
                  variant={constraints.includes(s) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggle(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
