import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { ResumeBuilder } from '@/components/ResumeBuilder';
import { AuthPage } from '@/components/AuthPage';
import { ResumeDashboard } from '@/components/ResumeDashboard';
import { CoverLetterCrafter } from '@/components/cover-letter/CoverLetterCrafter';
import { ResumeData } from '@/types/resume';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [editingResume, setEditingResume] = useState<{ data: ResumeData; id: string } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} />;
  }

  if (showDashboard) {
    return (
      <ResumeDashboard
        onCreateNew={() => {
          setShowDashboard(false);
          setShowBuilder(true);
          setEditingResume(null);
        }}
        onEditResume={(resumeData, resumeId) => {
          setEditingResume({ data: resumeData, id: resumeId });
          setShowDashboard(false);
          setShowBuilder(true);
        }}
        onBack={() => setShowDashboard(false)}
      />
    );
  }

  if (showBuilder) {
    return (
      <ResumeBuilder
        initialData={editingResume?.data}
        resumeId={editingResume?.id}
        onBack={() => {
          setShowBuilder(false);
          setEditingResume(null);
          if (user) setShowDashboard(true);
        }}
      />
    );
  }

  return (
    <LandingPage 
      onStartBuilding={() => {
        if (user) {
          setShowDashboard(true);
        } else {
          setShowAuth(true);
        }
      }}
      onShowAuth={() => setShowAuth(true)}
    />
  );
};

export default Index;
