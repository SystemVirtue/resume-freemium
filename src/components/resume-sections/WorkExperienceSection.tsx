import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface WorkExperience {
  id: string;
  company: string;
  position: string;
  website: string;
  startDate: string;
  endDate: string;
  isCurrentRole: boolean;
  summary: string;
  highlights: string[];
}

interface WorkExperienceSectionProps {
  data: WorkExperience[];
  onChange: (experiences: WorkExperience[]) => void;
}

export const WorkExperienceSection: React.FC<WorkExperienceSectionProps> = ({ data, onChange }) => {
  const addExperience = () => {
    const newExperience: WorkExperience = {
      id: Date.now().toString(),
      company: '',
      position: '',
      website: '',
      startDate: '',
      endDate: '',
      isCurrentRole: false,
      summary: '',
      highlights: ['']
    };
    onChange([...data, newExperience]);
  };

  const updateExperience = (index: number, field: keyof WorkExperience, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeExperience = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addHighlight = (expIndex: number) => {
    const updated = [...data];
    updated[expIndex].highlights = [...updated[expIndex].highlights, ''];
    onChange(updated);
  };

  const updateHighlight = (expIndex: number, highlightIndex: number, value: string) => {
    const updated = [...data];
    updated[expIndex].highlights[highlightIndex] = value;
    onChange(updated);
  };

  const removeHighlight = (expIndex: number, highlightIndex: number) => {
    const updated = [...data];
    updated[expIndex].highlights = updated[expIndex].highlights.filter((_, i) => i !== highlightIndex);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Work Experience</CardTitle>
          <Button variant="outline" size="sm" onClick={addExperience}>
            <Plus className="h-4 w-4 mr-2" />
            Add Experience
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((experience, index) => (
          <div key={experience.id} className="space-y-4 p-4 border rounded-lg relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Experience {index + 1}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeExperience(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`position-${index}`}>Job Title *</Label>
                <Input
                  id={`position-${index}`}
                  value={experience.position}
                  onChange={(e) => updateExperience(index, 'position', e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
              <div>
                <Label htmlFor={`company-${index}`}>Company *</Label>
                <Input
                  id={`company-${index}`}
                  value={experience.company}
                  onChange={(e) => updateExperience(index, 'company', e.target.value)}
                  placeholder="Company Name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`website-${index}`}>Company Website</Label>
              <Input
                id={`website-${index}`}
                value={experience.website}
                onChange={(e) => updateExperience(index, 'website', e.target.value)}
                placeholder="https://company.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`startDate-${index}`}>Start Date *</Label>
                <Input
                  id={`startDate-${index}`}
                  type="month"
                  value={experience.startDate}
                  onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`endDate-${index}`}>End Date</Label>
                <Input
                  id={`endDate-${index}`}
                  type="month"
                  value={experience.endDate}
                  onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                  disabled={experience.isCurrentRole}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`current-${index}`}
                checked={experience.isCurrentRole}
                onCheckedChange={(checked) => {
                  updateExperience(index, 'isCurrentRole', checked);
                  if (checked) {
                    updateExperience(index, 'endDate', '');
                  }
                }}
              />
              <Label htmlFor={`current-${index}`}>I currently work here</Label>
            </div>

            <div>
              <Label htmlFor={`summary-${index}`}>Job Summary</Label>
              <Textarea
                id={`summary-${index}`}
                value={experience.summary}
                onChange={(e) => updateExperience(index, 'summary', e.target.value)}
                placeholder="Brief description of your role and responsibilities..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Key Achievements & Highlights</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addHighlight(index)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Highlight
                </Button>
              </div>
              {experience.highlights.map((highlight, highlightIndex) => (
                <div key={highlightIndex} className="flex items-center space-x-2">
                  <Textarea
                    value={highlight}
                    onChange={(e) => updateHighlight(index, highlightIndex, e.target.value)}
                    placeholder="• Specific achievement or responsibility with metrics..."
                    className="min-h-[60px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHighlight(index, highlightIndex)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No work experience added yet.</p>
            <Button variant="outline" onClick={addExperience} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Experience
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};