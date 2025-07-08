import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Skill {
  id: string;
  name: string;
  level: string;
  keywords: string[];
}

interface SkillsSectionProps {
  data: Skill[];
  onChange: (skills: Skill[]) => void;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ data, onChange }) => {
  const [newSkillName, setNewSkillName] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [activeSkillIndex, setActiveSkillIndex] = useState<number | null>(null);

  const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const addSkill = () => {
    if (!newSkillName.trim()) return;

    const newSkill: Skill = {
      id: Date.now().toString(),
      name: newSkillName.trim(),
      level: 'Intermediate',
      keywords: []
    };

    onChange([...data, newSkill]);
    setNewSkillName('');
    toast({
      title: "Skill Added",
      description: `${newSkill.name} has been added to your skills.`
    });
  };

  const removeSkill = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateSkill = (index: number, field: keyof Skill, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addKeyword = (skillIndex: number) => {
    if (!newKeyword.trim()) return;

    const updated = [...data];
    updated[skillIndex].keywords = [...updated[skillIndex].keywords, newKeyword.trim()];
    onChange(updated);
    setNewKeyword('');
  };

  const removeKeyword = (skillIndex: number, keywordIndex: number) => {
    const updated = [...data];
    updated[skillIndex].keywords = updated[skillIndex].keywords.filter((_, i) => i !== keywordIndex);
    onChange(updated);
  };

  const suggestSkills = () => {
    const commonSkills = [
      'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'HTML/CSS',
      'Project Management', 'Communication', 'Leadership', 'Problem Solving',
      'Microsoft Office', 'Google Analytics', 'Photoshop', 'Figma',
      'SQL', 'Data Analysis', 'Marketing', 'Sales', 'Customer Service'
    ];

    const suggestion = commonSkills[Math.floor(Math.random() * commonSkills.length)];
    setNewSkillName(suggestion);
    toast({
      title: "Skill Suggested",
      description: `${suggestion} has been suggested. Click Add to include it.`
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Skills</CardTitle>
          <Button variant="outline" size="sm" onClick={suggestSkills}>
            <Sparkles className="h-4 w-4 mr-2" />
            Suggest Skills
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Skill */}
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Enter a skill (e.g., JavaScript, Project Management)"
              onKeyPress={(e) => handleKeyPress(e, addSkill)}
              className="flex-1"
            />
            <Button onClick={addSkill} disabled={!newSkillName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          </div>
        </div>

        {/* Skills List */}
        <div className="space-y-4">
          {data.map((skill, index) => (
            <div key={skill.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-1">
                    <Label htmlFor={`skill-name-${index}`}>Skill Name</Label>
                    <Input
                      id={`skill-name-${index}`}
                      value={skill.name}
                      onChange={(e) => updateSkill(index, 'name', e.target.value)}
                      placeholder="Skill name"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`skill-level-${index}`}>Level</Label>
                    <select
                      id={`skill-level-${index}`}
                      value={skill.level}
                      onChange={(e) => updateSkill(index, 'level', e.target.value)}
                      className="w-full p-2 border rounded-md text-sm"
                    >
                      {skillLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSkill(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label>Related Keywords (optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {skill.keywords.map((keyword, keywordIndex) => (
                    <Badge key={keywordIndex} variant="secondary" className="cursor-pointer">
                      {keyword}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyword(index, keywordIndex)}
                        className="ml-1 h-auto p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Input
                    value={activeSkillIndex === index ? newKeyword : ''}
                    onChange={(e) => {
                      setActiveSkillIndex(index);
                      setNewKeyword(e.target.value);
                    }}
                    placeholder="Add related keyword"
                    onKeyPress={(e) => handleKeyPress(e, () => addKeyword(index))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addKeyword(index)}
                    disabled={!newKeyword.trim() || activeSkillIndex !== index}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No skills added yet.</p>
            <p className="text-sm mt-2">Add your technical and soft skills to showcase your expertise.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};