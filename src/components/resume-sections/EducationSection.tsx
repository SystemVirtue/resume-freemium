import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Education {
  id: string;
  institution: string;
  url: string;
  area: string;
  studyType: string;
  startDate: string;
  endDate: string;
  score: string;
  courses: string[];
}

interface EducationSectionProps {
  data: Education[];
  onChange: (education: Education[]) => void;
}

export const EducationSection: React.FC<EducationSectionProps> = ({ data, onChange }) => {
  const addEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      institution: '',
      url: '',
      area: '',
      studyType: '',
      startDate: '',
      endDate: '',
      score: '',
      courses: ['']
    };
    onChange([...data, newEducation]);
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeEducation = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addCourse = (eduIndex: number) => {
    const updated = [...data];
    updated[eduIndex].courses = [...updated[eduIndex].courses, ''];
    onChange(updated);
  };

  const updateCourse = (eduIndex: number, courseIndex: number, value: string) => {
    const updated = [...data];
    updated[eduIndex].courses[courseIndex] = value;
    onChange(updated);
  };

  const removeCourse = (eduIndex: number, courseIndex: number) => {
    const updated = [...data];
    updated[eduIndex].courses = updated[eduIndex].courses.filter((_, i) => i !== courseIndex);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Education</CardTitle>
          <Button variant="outline" size="sm" onClick={addEducation}>
            <Plus className="h-4 w-4 mr-2" />
            Add Education
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((education, index) => (
          <div key={education.id} className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Education {index + 1}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEducation(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`institution-${index}`}>School/University *</Label>
                <Input
                  id={`institution-${index}`}
                  value={education.institution}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  placeholder="University of California, Berkeley"
                />
              </div>
              <div>
                <Label htmlFor={`url-${index}`}>Institution Website</Label>
                <Input
                  id={`url-${index}`}
                  value={education.url}
                  onChange={(e) => updateEducation(index, 'url', e.target.value)}
                  placeholder="https://university.edu"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`studyType-${index}`}>Degree Type *</Label>
                <Input
                  id={`studyType-${index}`}
                  value={education.studyType}
                  onChange={(e) => updateEducation(index, 'studyType', e.target.value)}
                  placeholder="Bachelor's, Master's, PhD, etc."
                />
              </div>
              <div>
                <Label htmlFor={`area-${index}`}>Field of Study *</Label>
                <Input
                  id={`area-${index}`}
                  value={education.area}
                  onChange={(e) => updateEducation(index, 'area', e.target.value)}
                  placeholder="Computer Science, Business, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`startDate-${index}`}>Start Date</Label>
                <Input
                  id={`startDate-${index}`}
                  type="month"
                  value={education.startDate}
                  onChange={(e) => updateEducation(index, 'startDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`endDate-${index}`}>End Date</Label>
                <Input
                  id={`endDate-${index}`}
                  type="month"
                  value={education.endDate}
                  onChange={(e) => updateEducation(index, 'endDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`score-${index}`}>GPA/Grade</Label>
                <Input
                  id={`score-${index}`}
                  value={education.score}
                  onChange={(e) => updateEducation(index, 'score', e.target.value)}
                  placeholder="3.8/4.0, First Class, etc."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Relevant Courses</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCourse(index)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Course
                </Button>
              </div>
              {education.courses.map((course, courseIndex) => (
                <div key={courseIndex} className="flex items-center space-x-2">
                  <Input
                    value={course}
                    onChange={(e) => updateCourse(index, courseIndex, e.target.value)}
                    placeholder="Course name or relevant coursework"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCourse(index, courseIndex)}
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
            <p>No education added yet.</p>
            <Button variant="outline" onClick={addEducation} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Education
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};