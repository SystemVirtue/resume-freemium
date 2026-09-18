import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { SourceInput } from './SourceInput';
import { CONTEXT_ROLES, ContextItem, ContextRole, newId } from '@/lib/coverLetter';

interface ContextItemListProps {
  items: ContextItem[];
  onChange: (items: ContextItem[]) => void;
}

/** Extra sources, each tagged with what it may be used for. */
export const ContextItemList: React.FC<ContextItemListProps> = ({ items, onChange }) => {
  const [role, setRole] = useState<ContextRole>('style_only');

  const add = () =>
    onChange([
      ...items,
      { id: newId(), role, label: CONTEXT_ROLES.find((r) => r.id === role)!.label, text: '' },
    ]);

  const update = (id: string, text: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>What kind of source are you adding?</Label>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_ROLES.map((r) => (
            <Badge
              key={r.id}
              variant={role === r.id ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setRole(r.id)}
            >
              {r.label}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{CONTEXT_ROLES.find((r) => r.id === role)!.hint}</p>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Add this source
        </Button>
      </div>

      {items.map((item) => {
        const meta = CONTEXT_ROLES.find((r) => r.id === item.role)!;
        return (
          <Card key={item.id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{meta.label}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
              <Input
                value={item.label}
                onChange={(e) => onChange(items.map((i) => (i.id === item.id ? { ...i, label: e.target.value } : i)))}
                placeholder="Give this source a name"
              />
              <SourceInput
                value={item.text}
                rows={5}
                onChange={(t) => update(item.id, t)}
                placeholder="Paste, upload or link this source."
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
