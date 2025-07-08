import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface LanguagesSectionProps {
  data: ResumeData['languages'];
  onChange: (languages: ResumeData['languages']) => void;
}

const fluencyLevels = [
  'Native',
  'Fluent',
  'Proficient', 
  'Intermediate',
  'Elementary',
  'Beginner'
];

export const LanguagesSection: React.FC<LanguagesSectionProps> = ({
  data,
  onChange
}) => {
  const addLanguage = () => {
    const newLanguage = {
      id: `lang-${Date.now()}`,
      language: '',
      fluency: ''
    };
    onChange([...data, newLanguage]);
  };

  const updateLanguage = (index: number, field: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeLanguage = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Languages</CardTitle>
          <Button onClick={addLanguage} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Language
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((language, index) => (
          <div key={language.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Language {index + 1}</h4>
              <Button 
                onClick={() => removeLanguage(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Language"
                value={language.language}
                onChange={(e) => updateLanguage(index, 'language', e.target.value)}
              />
              <Select
                value={language.fluency}
                onValueChange={(value) => updateLanguage(index, 'fluency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fluency Level" />
                </SelectTrigger>
                <SelectContent>
                  {fluencyLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};