import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ResumeData } from '@/types/resume';

interface CertificationsSectionProps {
  data: ResumeData['certifications'];
  onChange: (certifications: ResumeData['certifications']) => void;
}

export const CertificationsSection: React.FC<CertificationsSectionProps> = ({
  data,
  onChange
}) => {
  const addCertification = () => {
    const newCertification = {
      id: `cert-${Date.now()}`,
      name: '',
      issuer: '',
      date: '',
      url: ''
    };
    onChange([...data, newCertification]);
  };

  const updateCertification = (index: number, field: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCertification = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Certifications</CardTitle>
          <Button onClick={addCertification} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Certification
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((cert, index) => (
          <div key={cert.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Certification {index + 1}</h4>
              <Button 
                onClick={() => removeCertification(index)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Certification Name"
                value={cert.name}
                onChange={(e) => updateCertification(index, 'name', e.target.value)}
              />
              <Input
                placeholder="Issuing Organization"
                value={cert.issuer}
                onChange={(e) => updateCertification(index, 'issuer', e.target.value)}
              />
              <Input
                placeholder="Date Obtained"
                value={cert.date}
                onChange={(e) => updateCertification(index, 'date', e.target.value)}
              />
              <Input
                placeholder="Verification URL (optional)"
                value={cert.url}
                onChange={(e) => updateCertification(index, 'url', e.target.value)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};