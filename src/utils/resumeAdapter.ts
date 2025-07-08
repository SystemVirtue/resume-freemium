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
  let resume = `
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
${resumeData.skills.map(skill => `${skill.name} (${skill.level})`).join(', ')}`;

  // Add optional sections if they have data
  if (resumeData.projects.length > 0) {
    resume += `

PROJECTS
${resumeData.projects.map(project => 
  `${project.name} (${project.startDate} - ${project.endDate || 'Present'})\n${project.description}\n${project.highlights.join('\n')}`
).join('\n\n')}`;
  }

  if (resumeData.volunteer.length > 0) {
    resume += `

VOLUNTEER EXPERIENCE
${resumeData.volunteer.map(vol => 
  `${vol.position} at ${vol.organization} (${vol.startDate} - ${vol.endDate || 'Present'})\n${vol.summary}\n${vol.highlights.join('\n')}`
).join('\n\n')}`;
  }

  if (resumeData.awards.length > 0) {
    resume += `

AWARDS & HONORS
${resumeData.awards.map(award => 
  `${award.title} - ${award.awarder} (${award.date})\n${award.summary}`
).join('\n\n')}`;
  }

  if (resumeData.certifications.length > 0) {
    resume += `

CERTIFICATIONS
${resumeData.certifications.map(cert => 
  `${cert.name} - ${cert.issuer} (${cert.date})`
).join('\n')}`;
  }

  if (resumeData.languages.length > 0) {
    resume += `

LANGUAGES
${resumeData.languages.map(lang => `${lang.language} (${lang.fluency})`).join(', ')}`;
  }

  if (resumeData.interests.length > 0) {
    resume += `

INTERESTS
${resumeData.interests.map(interest => interest.name).join(', ')}`;
  }

  return resume.trim();
};