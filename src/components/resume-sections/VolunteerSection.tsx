import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface VolunteerSectionProps {
  data: ResumeData['volunteer'];
  onChange: (volunteer: ResumeData['volunteer']) => void;
}

export const VolunteerSection: React.FC<VolunteerSectionProps> = ({
  data,
  onChange
}) => {
  const addVolunteer = () => {
    const newVolunteer = {
      id: `volunteer-${Date.now()}`,
      organization: '',
      position: '',
      url: '',
      startDate: '',
      endDate: '',
      summary: '',
      highlights: []
    };
    onChange([...data, newVolunteer]);
  };

  const updateVolunteer = (index: number, field: string, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeVolunteer = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const addHighlight = (volunteerIndex: number) => {
    const updated = [...data];
    updated[volunteerIndex].highlights.push('');
    onChange(updated);
  };

  const updateHighlight = (volunteerIndex: number, highlightIndex: number, value: string) => {
    const updated = [...data];
    updated[volunteerIndex].highlights[highlightIndex] = value;
    onChange(updated);
  };

  const removeHighlight = (volunteerIndex: number, highlightIndex: number) => {
    const updated = [...data];
    updated[volunteerIndex].highlights.splice(highlightIndex, 1);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Volunteer Experience</CardTitle>
          <Button onClick={addVolunteer} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Experience
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((volunteer, index) => (
          <div key={volunteer.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Volunteer Experience {index + 1}</h4>
              <Button 
                onClick={() => removeVolunteer(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Organization"
                value={volunteer.organization}
                onChange={(e) => updateVolunteer(index, 'organization', e.target.value)}
              />
              <Input
                placeholder="Position/Role"
                value={volunteer.position}
                onChange={(e) => updateVolunteer(index, 'position', e.target.value)}
              />
              <Input
                placeholder="Website URL"
                value={volunteer.url}
                onChange={(e) => updateVolunteer(index, 'url', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Start Date"
                  value={volunteer.startDate}
                  onChange={(e) => updateVolunteer(index, 'startDate', e.target.value)}
                />
                <Input
                  placeholder="End Date"
                  value={volunteer.endDate}
                  onChange={(e) => updateVolunteer(index, 'endDate', e.target.value)}
                />
              </div>
            </div>
            
            <Textarea
              placeholder="Summary of volunteer work"
              value={volunteer.summary}
              onChange={(e) => updateVolunteer(index, 'summary', e.target.value)}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Key Achievements</label>
                <Button 
                  onClick={() => addHighlight(index)} 
                  variant="outline" 
                  size="sm"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Achievement
                </Button>
              </div>
              <div className="space-y-2">
                {volunteer.highlights.map((highlight, highlightIndex) => (
                  <div key={highlightIndex} className="flex gap-2">
                    <Input
                      placeholder="Achievement or impact"
                      value={highlight}
                      onChange={(e) => updateHighlight(index, highlightIndex, e.target.value)}
                    />
                    <Button
                      onClick={() => removeHighlight(index, highlightIndex)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};