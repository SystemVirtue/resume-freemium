import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles, Download, CreditCard, Star, CheckCircle, User, LogOut } from 'lucide-react';

interface LandingPageProps {
  onStartBuilding: () => void;
  onShowAuth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartBuilding, onShowAuth }) => {
  const { user, signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Resume Builder</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Welcome, {profile?.first_name || user.email}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onShowAuth}>
                  Sign In
                </Button>
                <Button variant="default" size="sm" onClick={onShowAuth}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-4">
                <FileText className="h-16 w-16" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Create Your Perfect Resume with 
              <span className="block text-accent-foreground">AI Assistance</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-3xl mx-auto leading-relaxed">
              Build professional resumes in minutes with our AI-powered suggestions, 
              beautiful templates, and seamless export options.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="hero" 
                size="xl" 
                onClick={onStartBuilding}
                className="text-lg"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start My Resume - Free
              </Button>
              <Button 
                variant="outline" 
                size="xl"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                View Templates
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center space-x-6 text-sm opacity-75">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                No Credit Card Required
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                AI-Powered Content
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Professional Templates
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Everything You Need to Land Your Dream Job
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our intelligent resume builder combines AI assistance with professional design 
              to help you create standout resumes that get noticed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center group hover:shadow-elegant transition-smooth">
              <CardContent className="pt-8">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-smooth">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">AI-Powered Suggestions</h3>
                <p className="text-muted-foreground">
                  Get intelligent content suggestions for your professional summary, 
                  skills, and experience descriptions.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center group hover:shadow-elegant transition-smooth">
              <CardContent className="pt-8">
                <div className="bg-accent/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-smooth">
                  <FileText className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Professional Templates</h3>
                <p className="text-muted-foreground">
                  Choose from our collection of modern, ATS-friendly resume 
                  templates designed by HR professionals.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center group hover:shadow-elegant transition-smooth">
              <CardContent className="pt-8">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-smooth">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Multiple Export Options</h3>
                <p className="text-muted-foreground">
                  Download your resume as plain text for free, or unlock 
                  premium PDF templates for just $5.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center group hover:shadow-elegant transition-smooth">
              <CardContent className="pt-8">
                <div className="bg-accent/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-smooth">
                  <CreditCard className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">One-Time Payment</h3>
                <p className="text-muted-foreground">
                  No subscriptions or hidden fees. Pay once and get 
                  unlimited access to all premium features.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create your professional resume in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-primary-foreground font-bold text-2xl">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Enter Your Information</h3>
              <p className="text-muted-foreground">
                Fill in your personal details, work experience, education, and skills. 
                Our AI assistant helps you write compelling content.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-primary-foreground font-bold text-2xl">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Choose Your Template</h3>
              <p className="text-muted-foreground">
                Select from our professional template collection. Preview your resume 
                in real-time and see how it looks.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-primary-foreground font-bold text-2xl">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Download & Apply</h3>
              <p className="text-muted-foreground">
                Download your resume as a formatted PDF and start applying 
                to your dream jobs with confidence.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Free Section */}
      <div className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Everything Included, Free
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create an account and use every feature — no payment, ever.
            </p>
          </div>

          <Card className="border-2 max-w-2xl mx-auto">
            <CardContent className="pt-8">
              <ul className="space-y-3">
                {[
                  'Resume builder with AI assistance',
                  'Import an existing resume from PDF, Word or text',
                  'All templates, PDF and plain text downloads',
                  'Cover Letter Crafter with paragraph-by-paragraph control',
                  'Choose your own AI assistant',
                ].map((item) => (
                  <li key={item} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-accent mr-3 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-6" onClick={onStartBuilding}>
                Get Started Free
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* CTA Section */}
      <div className="py-20 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Land Your Dream Job?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of professionals who have already created their perfect resume 
              with our AI-powered builder.
            </p>
            <Button 
              variant="hero" 
              size="xl" 
              onClick={onStartBuilding}
              className="bg-white text-primary hover:bg-white/90"
            >
              <FileText className="h-5 w-5 mr-2" />
              Create My Resume Now
            </Button>
            <div className="mt-6 flex items-center justify-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current text-yellow-300" />
              ))}
              <span className="ml-2 opacity-90">Trusted by 10,000+ professionals</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};