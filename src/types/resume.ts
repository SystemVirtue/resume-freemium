export interface ResumeData {
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

// Legacy interface for backward compatibility
export interface LegacyResumeData {
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