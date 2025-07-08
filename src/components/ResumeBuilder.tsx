import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, CreditCard, Save, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ResumePreview } from './ResumePreview';
import { TemplateGallery } from './TemplateGallery';
import { PersonalInfoSection } from './resume-sections/PersonalInfoSection';
import { ProfessionalSummarySection } from './resume-sections/ProfessionalSummarySection';
import { WorkExperienceSection } from './resume-sections/WorkExperienceSection';
import { EducationSection } from './resume-sections/EducationSection';
import { SkillsSection } from './resume-sections/SkillsSection';
import { useAutoSave } from '@/hooks/useAutoSave';
import { supabase } from '@/integrations/supabase/client';

interface ResumeData {
  basics: {
    name: string;
    email: string;
    phone: string;
    website: string;
    linkedin: string;
    summary: string;
    location: {
      address: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
  };
  work: Array<{
    id: string;
    company: string;
    position: string;
    website: string;
    startDate: string;
    endDate: string;
    isCurrentRole: boolean;
    summary: string;
    highlights: string[];
  }>;
  education: Array<{
    id: string;
    institution: string;
    url: string;
    area: string;
    studyType: string;
    startDate: string;
    endDate: string;
    score: string;
    courses: string[];
  }>;
  skills: Array<{
    id: string;
    name: string;
    level: string;
    keywords: string[];
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string;
    highlights: string[];
    keywords: string[];
    startDate: string;
    endDate: string;
    url: string;
    roles: string[];
    entity: string;
    type: string;
  }>;
  volunteer: Array<{
    id: string;
    organization: string;
    position: string;
    url: string;
    startDate: string;
    endDate: string;
    summary: string;
    highlights: string[];
  }>;
  awards: Array<{
    id: string;
    title: string;
    date: string;
    awarder: string;
    summary: string;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    date: string;
    url: string;
  }>;
  interests: Array<{
    id: string;
    name: string;
    keywords: string[];
  }>;
  languages: Array<{
    id: string;
    language: string;
    fluency: string;
  }>;
}

export const ResumeBuilder: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'templates'>('edit');
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData>({
    basics: {
      name: '',
      email: '',
      phone: '',
      website: '',
      linkedin: '',
      summary: '',
      location: {
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
      }
    },
    work: [],
    education: [],
    skills: [],
    projects: [],
    volunteer: [],
    awards: [],
    certifications: [],
    interests: [],
    languages: []
  });
  const [hasTemplatePaid, setHasTemplatePaid] = useState(false);

  // Auto-save functionality
  useAutoSave({
    data: resumeData,
    resumeId: resumeId || undefined,
    onSave: setResumeId,
    delay: 3000
  });

  const updateBasics = (field: string, value: any) => {
    setResumeData(prev => ({
      ...prev,
      basics: { ...prev.basics, [field]: value }
    }));
  };

  const downloadPlainText = () => {
    const plainText = `
${resumeData.basics.name}
${resumeData.basics.email} | ${resumeData.basics.phone}

PROFESSIONAL SUMMARY
${resumeData.basics.summary}

EXPERIENCE
${resumeData.work.map(exp => 
  `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})\n${exp.summary}\n${exp.highlights.join('\n')}`
).join('\n\n')}

EDUCATION
${resumeData.education.map(edu => 
  `${edu.studyType} in ${edu.area} - ${edu.institution} (${edu.endDate})`
).join('\n')}

SKILLS
${resumeData.skills.map(skill => `${skill.name} (${skill.level})`).join(', ')}
    `.trim();

    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resumeData.basics.name || 'resume'}.txt`;
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

  // Adapter function to convert new format to old format for compatibility
  const getCompatibleResumeData = () => ({
    name: resumeData.basics.name,
    email: resumeData.basics.email,
    phone: resumeData.basics.phone,
    summary: resumeData.basics.summary,
    experience: resumeData.work.map(work => ({
      title: work.position,
      company: work.company,
      duration: `${work.startDate} - ${work.endDate || 'Present'}`,
      description: work.summary + '\n' + work.highlights.join('\n')
    })),
    education: resumeData.education.map(edu => ({
      degree: edu.studyType,
      school: edu.institution,
      year: edu.endDate
    })),
    skills: resumeData.skills.map(skill => skill.name)
  });

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
            <PersonalInfoSection
              data={resumeData.basics}
              onChange={updateBasics}
            />
            
            <ProfessionalSummarySection
              data={resumeData.basics.summary}
              onChange={(value) => updateBasics('summary', value)}
            />
            
            <WorkExperienceSection
              data={resumeData.work}
              onChange={(work) => setResumeData(prev => ({ ...prev, work }))}
            />
            
            <EducationSection
              data={resumeData.education}
              onChange={(education) => setResumeData(prev => ({ ...prev, education }))}
            />
            
            <SkillsSection
              data={resumeData.skills}
              onChange={(skills) => setResumeData(prev => ({ ...prev, skills }))}
            />

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
          <ResumePreview resumeData={getCompatibleResumeData()} />
        )}

        {activeTab === 'templates' && (
          <TemplateGallery 
            resumeData={getCompatibleResumeData()} 
            hasAccess={hasTemplatePaid}
            onUnlockTemplates={handleStripePayment}
          />
        )}
      </div>
    </div>
  );
};