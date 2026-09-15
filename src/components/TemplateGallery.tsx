import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Lock, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
// @ts-ignore
import html2pdf from 'html2pdf.js';

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

interface TemplateGalleryProps {
  resumeData: ResumeData;
}

const templates = [
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Clean, modern design with accent colors',
    preview: 'bg-gradient-to-br from-blue-50 to-white',
  },
  {
    id: 'classic',
    name: 'Classic Business',
    description: 'Traditional format perfect for corporate roles',
    preview: 'bg-gray-50',
  },
  {
    id: 'creative',
    name: 'Creative Designer',
    description: 'Bold design for creative professionals',
    preview: 'bg-gradient-to-br from-purple-50 to-pink-50',
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Simple, clean layout focusing on content',
    preview: 'bg-white border-2 border-gray-200',
  },
  {
    id: 'tech',
    name: 'Tech Professional',
    description: 'Modern tech-focused design with dark accents',
    preview: 'bg-gradient-to-br from-slate-50 to-gray-100',
  },
];

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ resumeData }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const generateTemplateHTML = (templateId: string): string => {
    const baseStyles = `
      <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 40px; background: white; }
        .resume { max-width: 800px; margin: 0 auto; background: white; }
        .header { text-align: center; margin-bottom: 30px; }
        .name { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .contact { color: #666; margin-bottom: 5px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 2px solid #333; }
        .experience-item { margin-bottom: 15px; }
        .job-title { font-weight: bold; }
        .company { color: #666; }
        .duration { float: right; color: #999; font-size: 14px; }
        .description { margin-top: 5px; line-height: 1.5; }
        .skills { display: flex; flex-wrap: wrap; gap: 8px; }
        .skill { background: #f0f0f0; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
      </style>
    `;

    let templateSpecificStyles = '';
    switch (templateId) {
      case 'modern':
        templateSpecificStyles = `
          <style>
            .section-title { color: #3b82f6; border-bottom-color: #3b82f6; }
            .name { color: #1e40af; }
            .skill { background: #dbeafe; color: #1e40af; }
          </style>
        `;
        break;
      case 'creative':
        templateSpecificStyles = `
          <style>
            .section-title { color: #7c3aed; border-bottom-color: #7c3aed; }
            .name { color: #6d28d9; }
            .skill { background: #ede9fe; color: #6d28d9; }
          </style>
        `;
        break;
      case 'tech':
        templateSpecificStyles = `
          <style>
            .section-title { color: #374151; border-bottom-color: #374151; }
            .name { color: #111827; }
            .skill { background: #f3f4f6; color: #374151; }
          </style>
        `;
        break;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${resumeData.name || 'Resume'}</title>
          ${baseStyles}
          ${templateSpecificStyles}
        </head>
        <body>
          <div class="resume">
            <div class="header">
              <div class="name">${resumeData.name || 'Your Name'}</div>
              <div class="contact">${resumeData.email || 'your.email@example.com'}</div>
              ${resumeData.phone ? `<div class="contact">${resumeData.phone}</div>` : ''}
            </div>
            
            ${resumeData.summary ? `
              <div class="section">
                <div class="section-title">Professional Summary</div>
                <p>${resumeData.summary}</p>
              </div>
            ` : ''}
            
            ${resumeData.experience.some(exp => exp.title || exp.company) ? `
              <div class="section">
                <div class="section-title">Work Experience</div>
                ${resumeData.experience
                  .filter(exp => exp.title || exp.company)
                  .map(exp => `
                    <div class="experience-item">
                      <div class="job-title">${exp.title || 'Job Title'}</div>
                      <div class="company">${exp.company || 'Company Name'}</div>
                      ${exp.duration ? `<div class="duration">${exp.duration}</div>` : ''}
                      <div style="clear: both;"></div>
                      ${exp.description ? `<div class="description">${exp.description}</div>` : ''}
                    </div>
                  `).join('')}
              </div>
            ` : ''}
            
            ${resumeData.education.some(edu => edu.degree || edu.school) ? `
              <div class="section">
                <div class="section-title">Education</div>
                ${resumeData.education
                  .filter(edu => edu.degree || edu.school)
                  .map(edu => `
                    <div class="experience-item">
                      <div class="job-title">${edu.degree || 'Degree'}</div>
                      <div class="company">${edu.school || 'School/University'}</div>
                      ${edu.year ? `<div class="duration">${edu.year}</div>` : ''}
                      <div style="clear: both;"></div>
                    </div>
                  `).join('')}
              </div>
            ` : ''}
            
            ${resumeData.skills.length > 0 ? `
              <div class="section">
                <div class="section-title">Skills</div>
                <div class="skills">
                  ${resumeData.skills.map(skill => `<span class="skill">${skill}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
  };

  const downloadPDF = async (templateId: string) => {
    if (!hasAccess) {
      onUnlockTemplates();
      return;
    }

    try {
      const htmlContent = generateTemplateHTML(templateId);
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      
      const opt = {
        margin: 0.5,
        filename: `${resumeData.name || 'resume'}-${templateId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      
      toast({
        title: "PDF Downloaded",
        description: `Your resume has been downloaded using the ${templates.find(t => t.id === templateId)?.name} template.`
      });
    } catch (error) {
      toast({
        title: "Download Error",
        description: "There was an error generating your PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const previewTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const htmlContent = generateTemplateHTML(templateId);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Premium Resume Templates</CardTitle>
          {!hasAccess && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <p className="text-accent-foreground">
                <Lock className="h-4 w-4 inline mr-2" />
                Unlock all premium templates for a one-time payment of $5 USD
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="relative overflow-hidden">
                <div className={`h-48 ${template.preview} flex items-center justify-center`}>
                  <div className="text-center p-4">
                    <div className="bg-white/90 p-4 rounded shadow-sm text-xs">
                      <div className="font-bold mb-1">{resumeData.name || 'Your Name'}</div>
                      <div className="text-gray-600 mb-2">{resumeData.email || 'email@example.com'}</div>
                      <div className="border-b border-gray-300 mb-2"></div>
                      <div className="text-left space-y-1">
                        <div className="font-medium text-xs">Experience</div>
                        <div className="font-medium text-xs">Education</div>
                        <div className="font-medium text-xs">Skills</div>
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewTemplate(template.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant={hasAccess ? "default" : "outline"}
                      size="sm"
                      onClick={() => downloadPDF(template.id)}
                    >
                      {hasAccess ? (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-1" />
                          $5
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
                {!hasAccess && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <Lock className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                )}
              </Card>
            ))}
          </div>
          
          {!hasAccess && (
            <div className="text-center mt-8">
              <Button
                variant="hero"
                size="xl"
                onClick={onUnlockTemplates}
              >
                Unlock All Templates - $5 USD
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};