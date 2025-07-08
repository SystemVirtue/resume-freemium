import { ResumeData, LegacyResumeData } from '@/types/resume';

/**
 * Converts the new ResumeData format to the legacy format for backward compatibility
 * with existing preview and template components
 */
export const adaptResumeDataToLegacy = (resumeData: ResumeData): LegacyResumeData => ({
  name: resumeData.basics.name,
  email: resumeData.basics.email,
  phone: resumeData.basics.phone,
  summary: resumeData.basics.summary,
  experience: resumeData.work.map(work => ({
    title: work.position,
    company: work.company,
    duration: `${work.startDate} - ${work.endDate || 'Present'}`,
    description: work.summary + (work.highlights.length > 0 ? '\n' + work.highlights.join('\n') : '')
  })),
  education: resumeData.education.map(edu => ({
    degree: edu.studyType,
    school: edu.institution,
    year: edu.endDate
  })),
  skills: resumeData.skills.map(skill => skill.name)
});

/**
 * Generates a plain text version of the resume for downloading
 */
export const generatePlainTextResume = (resumeData: ResumeData): string => {
  return `
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
};