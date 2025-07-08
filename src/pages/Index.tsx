import React, { useState } from 'react';
import { LandingPage } from '@/components/LandingPage';
import { ResumeBuilder } from '@/components/ResumeBuilder';

const Index = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  if (showBuilder) {
    return <ResumeBuilder />;
  }

  return <LandingPage onStartBuilding={() => setShowBuilder(true)} />;
};

export default Index;
