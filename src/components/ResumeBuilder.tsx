import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Download, Eye, Sparkles, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ResumePreview } from './ResumePreview';
import { TemplateGallery } from './TemplateGallery';

interface ResumeData {
  name: string;
  email: string;
  phone: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  skills: string[];
}

export const ResumeBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'templates'>('edit');
  const [resumeData, setResumeData] = useState<ResumeData>({
    name: '',
    email: '',
    phone: '',
    summary: '',
    experience: [{ title: '', company: '', duration: '', description: '' }],
    education: [{ degree: '', school: '', year: '' }],
    skills: []
  });
  const [newSkill, setNewSkill] = useState('');
  const [hasTemplatePaid, setHasTemplatePaid] = useState(false);

  const updateResumeData = (field: keyof ResumeData, value: any) => {
    setResumeData(prev => ({ ...prev, [field]: value }));
  };

  const addExperience = () => {
    setResumeData(prev => ({
      ...prev,
      experience: [...prev.experience, { title: '', company: '', duration: '', description: '' }]
    }));
  };

  const updateExperience = (index: number, field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) => 
        i === index ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const addEducation = () => {
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', school: '', year: '' }]
    }));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.map((edu, i) => 
        i === index ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setResumeData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const generateAISummary = async () => {
    // Placeholder for GPT integration
    const suggestions = [
      "Experienced software engineer with 5+ years developing scalable web applications and leading cross-functional teams.",
      "Results-driven marketing professional with expertise in digital campaigns and data-driven strategy development.",
      "Detail-oriented project manager with proven track record of delivering complex projects on time and under budget."
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    updateResumeData('summary', randomSuggestion);
    toast({
      title: "AI Suggestion Generated",
      description: "Your professional summary has been updated with AI-generated content."
    });
  };

  const downloadPlainText = () => {
    const plainText = `
${resumeData.name}
${resumeData.email} | ${resumeData.phone}

PROFESSIONAL SUMMARY
${resumeData.summary}

EXPERIENCE
${resumeData.experience.map(exp => 
  `${exp.title} at ${exp.company} (${exp.duration})\n${exp.description}`
).join('\n\n')}

EDUCATION
${resumeData.education.map(edu => 
  `${edu.degree} - ${edu.school} (${edu.year})`
).join('\n')}

SKILLS
${resumeData.skills.join(', ')}
    `.trim();

    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resumeData.name || 'resume'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Resume Downloaded",
      description: "Your plain text resume has been downloaded successfully."
    });
  };

  const handleStripePayment = async () => {
    // Placeholder for Stripe integration
    // This would typically call a Supabase edge function
    toast({
      title: "Payment Required",
      description: "Connect to Supabase to enable Stripe payments for premium templates."
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Resume Builder</h1>
                <p className="text-muted-foreground">Create your professional resume with AI assistance</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant={activeTab === 'edit' ? 'default' : 'ghost'} 
                onClick={() => setActiveTab('edit')}
              >
                Edit
              </Button>
              <Button 
                variant={activeTab === 'preview' ? 'default' : 'ghost'} 
                onClick={() => setActiveTab('preview')}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button 
                variant={activeTab === 'templates' ? 'default' : 'ghost'} 
                onClick={() => setActiveTab('templates')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'edit' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
                    <Input
                      value={resumeData.name}
                      onChange={(e) => updateResumeData('name', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                    <Input
                      type="email"
                      value={resumeData.email}
                      onChange={(e) => updateResumeData('email', e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Phone</label>
                  <Input
                    value={resumeData.phone}
                    onChange={(e) => updateResumeData('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Professional Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Professional Summary</CardTitle>
                  <Button variant="outline" size="sm" onClick={generateAISummary}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Suggest
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={resumeData.summary}
                  onChange={(e) => updateResumeData('summary', e.target.value)}
                  placeholder="Write a compelling summary of your professional background and key achievements..."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            {/* Experience */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Work Experience</CardTitle>
                  <Button variant="outline" size="sm" onClick={addExperience}>
                    Add Experience
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {resumeData.experience.map((exp, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        value={exp.title}
                        onChange={(e) => updateExperience(index, 'title', e.target.value)}
                        placeholder="Job Title"
                      />
                      <Input
                        value={exp.company}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                        placeholder="Company Name"
                      />
                    </div>
                    <Input
                      value={exp.duration}
                      onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                      placeholder="Duration (e.g., Jan 2020 - Present)"
                    />
                    <Textarea
                      value={exp.description}
                      onChange={(e) => updateExperience(index, 'description', e.target.value)}
                      placeholder="Describe your responsibilities and achievements..."
                      className="min-h-[100px]"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Education</CardTitle>
                  <Button variant="outline" size="sm" onClick={addEducation}>
                    Add Education
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {resumeData.education.map((edu, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                    <Input
                      value={edu.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      placeholder="Degree"
                    />
                    <Input
                      value={edu.school}
                      onChange={(e) => updateEducation(index, 'school', e.target.value)}
                      placeholder="School/University"
                    />
                    <Input
                      value={edu.year}
                      onChange={(e) => updateEducation(index, 'year', e.target.value)}
                      placeholder="Year"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill"
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                  />
                  <Button onClick={addSkill}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-primary/10 text-primary border border-primary/20"
                    >
                      {skill}
                      <button 
                        onClick={() => removeSkill(index)}
                        className="ml-1 text-primary/60 hover:text-primary"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-4">
                  <Button onClick={downloadPlainText} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Plain Text (Free)
                  </Button>
                  <Button onClick={handleStripePayment} variant="accent">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Unlock Premium Templates ($5)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'preview' && (
          <ResumePreview resumeData={resumeData} />
        )}

        {activeTab === 'templates' && (
          <TemplateGallery 
            resumeData={resumeData} 
            hasAccess={hasTemplatePaid}
            onUnlockTemplates={handleStripePayment}
          />
        )}
      </div>
    </div>
  );
};