import React from 'react';
import { ResumeData } from '@/types/resume';
import { PersonalInfoSection } from '@/components/resume-sections/PersonalInfoSection';
import { ProfessionalSummarySection } from '@/components/resume-sections/ProfessionalSummarySection';
import { WorkExperienceSection } from '@/components/resume-sections/WorkExperienceSection';
import { EducationSection } from '@/components/resume-sections/EducationSection';
import { SkillsSection } from '@/components/resume-sections/SkillsSection';
import { ExportSection } from './ExportSection';

interface ResumeEditFormProps {
  resumeData: ResumeData;
  onUpdateBasics: (field: string, value: any) => void;
  onUpdateWork: (work: ResumeData['work']) => void;
  onUpdateEducation: (education: ResumeData['education']) => void;
  onUpdateSkills: (skills: ResumeData['skills']) => void;
  onUnlockPremium: () => void;
}

export const ResumeEditForm: React.FC<ResumeEditFormProps> = ({
  resumeData,
  onUpdateBasics,
  onUpdateWork,
  onUpdateEducation,
  onUpdateSkills,
  onUnlockPremium
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PersonalInfoSection
        data={resumeData.basics}
        onChange={onUpdateBasics}
      />
      
      <ProfessionalSummarySection
        data={resumeData.basics.summary}
        onChange={(value) => onUpdateBasics('summary', value)}
      />
      
      <WorkExperienceSection
        data={resumeData.work}
        onChange={onUpdateWork}
      />
      
      <EducationSection
        data={resumeData.education}
        onChange={onUpdateEducation}
      />
      
      <SkillsSection
        data={resumeData.skills}
        onChange={onUpdateSkills}
      />

      <ExportSection
        resumeData={resumeData}
        onUnlockPremium={onUnlockPremium}
      />
    </div>
  );
};