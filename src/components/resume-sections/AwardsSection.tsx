import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface AwardsSectionProps {
  data: ResumeData['awards'];
  onChange: (awards: ResumeData['awards']) => void;
}

export const AwardsSection: React.FC<AwardsSectionProps> = ({
  data,
  onChange
}) => {
  const addAward = () => {
    const newAward = {
      id: `award-${Date.now()}`,
      title: '',
      date: '',
      awarder: '',
      summary: ''
    };
    onChange([...data, newAward]);
  };

  const updateAward = (index: number, field: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeAward = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Awards & Honors</CardTitle>
          <Button onClick={addAward} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Award
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((award, index) => (
          <div key={award.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Award {index + 1}</h4>
              <Button 
                onClick={() => removeAward(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Award Title"
                value={award.title}
                onChange={(e) => updateAward(index, 'title', e.target.value)}
              />
              <Input
                placeholder="Awarded By"
                value={award.awarder}
                onChange={(e) => updateAward(index, 'awarder', e.target.value)}
              />
              <Input
                placeholder="Date Received"
                value={award.date}
                onChange={(e) => updateAward(index, 'date', e.target.value)}
              />
            </div>
            
            <Textarea
              placeholder="Award description and significance"
              value={award.summary}
              onChange={(e) => updateAward(index, 'summary', e.target.value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};