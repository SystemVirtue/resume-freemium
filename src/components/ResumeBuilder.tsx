import React, { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ResumePreview } from './ResumePreview';
import { TemplateGallery } from './TemplateGallery';
import { ResumeBuilderHeader } from './resume-builder/ResumeBuilderHeader';
import { ResumeEditForm } from './resume-builder/ResumeEditForm';
import { useAutoSave } from '@/hooks/useAutoSave';
import { ResumeData } from '@/types/resume';
import { adaptResumeDataToLegacy } from '@/utils/resumeAdapter';

interface ResumeBuilderProps {
  initialData?: ResumeData;
  resumeId?: string;
  onBack?: () => void;
}

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ 
  initialData,
  resumeId: initialResumeId,
  onBack
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'templates'>('edit');
  const [resumeId, setResumeId] = useState<string | null>(initialResumeId || null);
  const [resumeData, setResumeData] = useState<ResumeData>(initialData || {
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

  const updateWork = (work: ResumeData['work']) => {
    setResumeData(prev => ({ ...prev, work }));
  };

  const updateEducation = (education: ResumeData['education']) => {
    setResumeData(prev => ({ ...prev, education }));
  };

  const updateSkills = (skills: ResumeData['skills']) => {
    setResumeData(prev => ({ ...prev, skills }));
  };

  const updateProjects = (projects: ResumeData['projects']) => {
    setResumeData(prev => ({ ...prev, projects }));
  };

  const updateVolunteer = (volunteer: ResumeData['volunteer']) => {
    setResumeData(prev => ({ ...prev, volunteer }));
  };

  const updateAwards = (awards: ResumeData['awards']) => {
    setResumeData(prev => ({ ...prev, awards }));
  };

  const updateCertifications = (certifications: ResumeData['certifications']) => {
    setResumeData(prev => ({ ...prev, certifications }));
  };

  const updateLanguages = (languages: ResumeData['languages']) => {
    setResumeData(prev => ({ ...prev, languages }));
  };

  const updateInterests = (interests: ResumeData['interests']) => {
    setResumeData(prev => ({ ...prev, interests }));
  };

  const handleStripePayment = async () => {
    // Placeholder for Stripe integration
    // This would typically call a Supabase edge function
    toast({
      title: "Payment Required",
      description: "Connect to Supabase to enable Stripe payments for premium templates."
    });
  };

  // Convert to legacy format for compatibility
  const legacyResumeData = adaptResumeDataToLegacy(resumeData);

  return (
    <div className="min-h-screen bg-background">
      <ResumeBuilderHeader 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'edit' && (
          <ResumeEditForm
            resumeData={resumeData}
            onUpdateBasics={updateBasics}
            onUpdateWork={updateWork}
            onUpdateEducation={updateEducation}
            onUpdateSkills={updateSkills}
            onUpdateProjects={updateProjects}
            onUpdateVolunteer={updateVolunteer}
            onUpdateAwards={updateAwards}
            onUpdateCertifications={updateCertifications}
            onUpdateLanguages={updateLanguages}
            onUpdateInterests={updateInterests}
            onUnlockPremium={handleStripePayment}
          />
        )}

        {activeTab === 'preview' && (
          <ResumePreview resumeData={legacyResumeData} />
        )}

        {activeTab === 'templates' && (
          <TemplateGallery 
            resumeData={legacyResumeData} 
            hasAccess={hasTemplatePaid}
            onUnlockTemplates={handleStripePayment}
          />
        )}
      </div>
    </div>
  );
};