import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ResumeData } from '@/types/resume';
import { generatePlainTextResume } from '@/utils/resumeAdapter';

interface ExportSectionProps {
  resumeData: ResumeData;
}

export const ExportSection: React.FC<ExportSectionProps> = ({ resumeData }) => {
  const downloadPlainText = () => {
    const plainText = generatePlainTextResume(resumeData);

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
      title: 'Resume downloaded',
      description: 'Your plain text resume has been saved.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button onClick={downloadPlainText} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download plain text
          </Button>
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          All templates and PDF downloads are available in the Templates tab, free of charge.
        </p>
      </CardContent>
    </Card>
  );
};
