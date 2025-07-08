import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Eye, CreditCard } from 'lucide-react';

interface ResumeBuilderHeaderProps {
  activeTab: 'edit' | 'preview' | 'templates';
  onTabChange: (tab: 'edit' | 'preview' | 'templates') => void;
}

export const ResumeBuilderHeader: React.FC<ResumeBuilderHeaderProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="border-b bg-card shadow-card">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Resume Builder</h1>
              <p className="text-muted-foreground">Create your professional resume with AI assistance</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant={activeTab === 'edit' ? 'default' : 'ghost'} 
              onClick={() => onTabChange('edit')}
            >
              Edit
            </Button>
            <Button 
              variant={activeTab === 'preview' ? 'default' : 'ghost'} 
              onClick={() => onTabChange('preview')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              variant={activeTab === 'templates' ? 'default' : 'ghost'} 
              onClick={() => onTabChange('templates')}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Templates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};