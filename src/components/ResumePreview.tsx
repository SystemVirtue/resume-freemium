import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface ResumePreviewProps {
  resumeData: ResumeData;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeData }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="min-h-[800px]">
        <CardHeader>
          <CardTitle>Resume Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 max-w-3xl mx-auto bg-white p-8 text-black shadow-lg">
            {/* Header */}
            <div className="text-center border-b border-gray-200 pb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {resumeData.name || 'Your Name'}
              </h1>
              <div className="text-gray-600 space-x-2">
                <span>{resumeData.email || 'your.email@example.com'}</span>
                {resumeData.phone && (
                  <>
                    <span>•</span>
                    <span>{resumeData.phone}</span>
                  </>
                )}
              </div>
            </div>

            {/* Professional Summary */}
            {resumeData.summary && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
                  Professional Summary
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {resumeData.summary}
                </p>
              </div>
            )}

            {/* Experience */}
            {resumeData.experience.some(exp => exp.title || exp.company) && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
                  Work Experience
                </h2>
                <div className="space-y-4">
                  {resumeData.experience
                    .filter(exp => exp.title || exp.company)
                    .map((exp, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {exp.title || 'Job Title'}
                          </h3>
                          <p className="text-gray-600">
                            {exp.company || 'Company Name'}
                          </p>
                        </div>
                        <p className="text-gray-500 text-sm">
                          {exp.duration}
                        </p>
                      </div>
                      {exp.description && (
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {resumeData.education.some(edu => edu.degree || edu.school) && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
                  Education
                </h2>
                <div className="space-y-2">
                  {resumeData.education
                    .filter(edu => edu.degree || edu.school)
                    .map((edu, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">
                          {edu.degree || 'Degree'}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {edu.school || 'School/University'}
                        </p>
                      </div>
                      <p className="text-gray-500 text-sm">
                        {edu.year}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {resumeData.skills.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
                  Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};