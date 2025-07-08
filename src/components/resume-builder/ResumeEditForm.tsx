import React from 'react';
import { ResumeData } from '@/types/resume';
import { PersonalInfoSection } from '@/components/resume-sections/PersonalInfoSection';
import { ProfessionalSummarySection } from '@/components/resume-sections/ProfessionalSummarySection';
import { WorkExperienceSection } from '@/components/resume-sections/WorkExperienceSection';
import { EducationSection } from '@/components/resume-sections/EducationSection';
import { SkillsSection } from '@/components/resume-sections/SkillsSection';
import { ProjectsSection } from '@/components/resume-sections/ProjectsSection';
import { VolunteerSection } from '@/components/resume-sections/VolunteerSection';
import { AwardsSection } from '@/components/resume-sections/AwardsSection';
import { CertificationsSection } from '@/components/resume-sections/CertificationsSection';
import { LanguagesSection } from '@/components/resume-sections/LanguagesSection';
import { InterestsSection } from '@/components/resume-sections/InterestsSection';
import { ExportSection } from './ExportSection';

interface ResumeEditFormProps {
  resumeData: ResumeData;
  onUpdateBasics: (field: string, value: any) => void;
  onUpdateWork: (work: ResumeData['work']) => void;
  onUpdateEducation: (education: ResumeData['education']) => void;
  onUpdateSkills: (skills: ResumeData['skills']) => void;
  onUpdateProjects: (projects: ResumeData['projects']) => void;
  onUpdateVolunteer: (volunteer: ResumeData['volunteer']) => void;
  onUpdateAwards: (awards: ResumeData['awards']) => void;
  onUpdateCertifications: (certifications: ResumeData['certifications']) => void;
  onUpdateLanguages: (languages: ResumeData['languages']) => void;
  onUpdateInterests: (interests: ResumeData['interests']) => void;
  onUnlockPremium: () => void;
}

export const ResumeEditForm: React.FC<ResumeEditFormProps> = ({
  resumeData,
  onUpdateBasics,
  onUpdateWork,
  onUpdateEducation,
  onUpdateSkills,
  onUpdateProjects,
  onUpdateVolunteer,
  onUpdateAwards,
  onUpdateCertifications,
  onUpdateLanguages,
  onUpdateInterests,
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

      <ProjectsSection
        data={resumeData.projects}
        onChange={onUpdateProjects}
      />

      <VolunteerSection
        data={resumeData.volunteer}
        onChange={onUpdateVolunteer}
      />

      <AwardsSection
        data={resumeData.awards}
        onChange={onUpdateAwards}
      />

      <CertificationsSection
        data={resumeData.certifications}
        onChange={onUpdateCertifications}
      />

      <LanguagesSection
        data={resumeData.languages}
        onChange={onUpdateLanguages}
      />

      <InterestsSection
        data={resumeData.interests}
        onChange={onUpdateInterests}
      />

      <ExportSection
        resumeData={resumeData}
        onUnlockPremium={onUnlockPremium}
      />
    </div>
  );
};