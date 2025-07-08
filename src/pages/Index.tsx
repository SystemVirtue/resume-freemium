import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { ResumeBuilder } from '@/components/ResumeBuilder';
import { AuthPage } from '@/components/AuthPage';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

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

  if (showBuilder) {
    return <ResumeBuilder />;
  }

  return (
    <LandingPage 
      onStartBuilding={() => {
        if (user) {
          setShowBuilder(true);
        } else {
          setShowAuth(true);
        }
      }}
      onShowAuth={() => setShowAuth(true)}
    />
  );
};

export default Index;
