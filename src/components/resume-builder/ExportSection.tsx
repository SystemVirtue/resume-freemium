import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ResumeData } from '@/types/resume';
import { generatePlainTextResume } from '@/utils/resumeAdapter';

interface ExportSectionProps {
  resumeData: ResumeData;
  onUnlockPremium: () => void;
}

export const ExportSection: React.FC<ExportSectionProps> = ({
  resumeData,
  onUnlockPremium
}) => {
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
      title: "Resume Downloaded",
      description: "Your plain text resume has been downloaded successfully."
    });
  };

  return (
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
          <Button onClick={onUnlockPremium} variant="accent">
            <CreditCard className="h-4 w-4 mr-2" />
            Unlock Premium Templates ($5)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};