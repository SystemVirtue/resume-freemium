import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface InterestsSectionProps {
  data: ResumeData['interests'];
  onChange: (interests: ResumeData['interests']) => void;
}

export const InterestsSection: React.FC<InterestsSectionProps> = ({
  data,
  onChange
}) => {
  const addInterest = () => {
    const newInterest = {
      id: `interest-${Date.now()}`,
      name: '',
      keywords: []
    };
    onChange([...data, newInterest]);
  };

  const updateInterest = (index: number, field: string, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeInterest = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const addKeyword = (interestIndex: number, keyword: string) => {
    if (!keyword.trim()) return;
    const updated = [...data];
    updated[interestIndex].keywords.push(keyword.trim());
    onChange(updated);
  };

  const removeKeyword = (interestIndex: number, keywordIndex: number) => {
    const updated = [...data];
    updated[interestIndex].keywords.splice(keywordIndex, 1);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Interests & Hobbies</CardTitle>
          <Button onClick={addInterest} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Interest
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((interest, index) => (
          <div key={interest.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Interest {index + 1}</h4>
              <Button 
                onClick={() => removeInterest(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <Input
              placeholder="Interest/Hobby Name"
              value={interest.name}
              onChange={(e) => updateInterest(index, 'name', e.target.value)}
            />

            <div>
              <label className="text-sm font-medium mb-2 block">Related Keywords</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {interest.keywords.map((keyword, keywordIndex) => (
                  <Badge key={keywordIndex} variant="secondary">
                    {keyword}
                    <button
                      onClick={() => removeKeyword(index, keywordIndex)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add related keyword and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addKeyword(index, e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};