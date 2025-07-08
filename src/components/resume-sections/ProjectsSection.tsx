import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface ProjectsSectionProps {
  data: ResumeData['projects'];
  onChange: (projects: ResumeData['projects']) => void;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  data,
  onChange
}) => {
  const addProject = () => {
    const newProject = {
      id: `project-${Date.now()}`,
      name: '',
      description: '',
      highlights: [],
      keywords: [],
      startDate: '',
      endDate: '',
      url: '',
      roles: [],
      entity: '',
      type: ''
    };
    onChange([...data, newProject]);
  };

  const updateProject = (index: number, field: string, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeProject = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const addHighlight = (projectIndex: number) => {
    const updated = [...data];
    updated[projectIndex].highlights.push('');
    onChange(updated);
  };

  const updateHighlight = (projectIndex: number, highlightIndex: number, value: string) => {
    const updated = [...data];
    updated[projectIndex].highlights[highlightIndex] = value;
    onChange(updated);
  };

  const removeHighlight = (projectIndex: number, highlightIndex: number) => {
    const updated = [...data];
    updated[projectIndex].highlights.splice(highlightIndex, 1);
    onChange(updated);
  };

  const addKeyword = (projectIndex: number, keyword: string) => {
    if (!keyword.trim()) return;
    const updated = [...data];
    updated[projectIndex].keywords.push(keyword.trim());
    onChange(updated);
  };

  const removeKeyword = (projectIndex: number, keywordIndex: number) => {
    const updated = [...data];
    updated[projectIndex].keywords.splice(keywordIndex, 1);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Projects</CardTitle>
          <Button onClick={addProject} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((project, index) => (
          <div key={project.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Project {index + 1}</h4>
              <Button 
                onClick={() => removeProject(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Project Name"
                value={project.name}
                onChange={(e) => updateProject(index, 'name', e.target.value)}
              />
              <Input
                placeholder="URL"
                value={project.url}
                onChange={(e) => updateProject(index, 'url', e.target.value)}
              />
              <Input
                placeholder="Start Date"
                value={project.startDate}
                onChange={(e) => updateProject(index, 'startDate', e.target.value)}
              />
              <Input
                placeholder="End Date"
                value={project.endDate}
                onChange={(e) => updateProject(index, 'endDate', e.target.value)}
              />
              <Input
                placeholder="Entity/Organization"
                value={project.entity}
                onChange={(e) => updateProject(index, 'entity', e.target.value)}
              />
              <Input
                placeholder="Project Type"
                value={project.type}
                onChange={(e) => updateProject(index, 'type', e.target.value)}
              />
            </div>
            
            <Textarea
              placeholder="Project Description"
              value={project.description}
              onChange={(e) => updateProject(index, 'description', e.target.value)}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Key Highlights</label>
                <Button 
                  onClick={() => addHighlight(index)} 
                  variant="outline" 
                  size="sm"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Highlight
                </Button>
              </div>
              <div className="space-y-2">
                {project.highlights.map((highlight, highlightIndex) => (
                  <div key={highlightIndex} className="flex gap-2">
                    <Input
                      placeholder="Achievement or highlight"
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

            <div>
              <label className="text-sm font-medium mb-2 block">Technologies/Keywords</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {project.keywords.map((keyword, keywordIndex) => (
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
                placeholder="Add technology/keyword and press Enter"
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