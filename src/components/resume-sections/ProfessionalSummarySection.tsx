import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProfessionalSummarySectionProps {
  data: string;
  onChange: (value: string) => void;
  onAISuggestion?: () => void;
}

export const ProfessionalSummarySection: React.FC<ProfessionalSummarySectionProps> = ({ 
  data, 
  onChange, 
  onAISuggestion 
}) => {
  const generateAISuggestion = async () => {
    // Placeholder for AI integration
    const suggestions = [
      "Experienced software engineer with 5+ years developing scalable web applications and leading cross-functional teams. Proven track record of delivering high-quality solutions that improve user experience and business outcomes.",
      "Results-driven marketing professional with expertise in digital campaigns, content strategy, and data-driven decision making. Successfully increased brand awareness by 40% and generated 25% more qualified leads.",
      "Detail-oriented project manager with proven track record of delivering complex projects on time and under budget. Skilled in stakeholder management, risk assessment, and process optimization across multiple industries.",
      "Creative UX/UI designer passionate about creating intuitive, user-centered digital experiences. Proficient in design thinking methodologies, prototyping, and collaborating with development teams to bring designs to life.",
      "Dedicated sales professional with 7+ years of experience exceeding targets and building lasting client relationships. Expertise in consultative selling, territory management, and developing strategic partnerships."
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    onChange(randomSuggestion);
    
    toast({
      title: "AI Suggestion Generated",
      description: "Your professional summary has been updated with AI-generated content."
    });
    
    if (onAISuggestion) {
      onAISuggestion();
    }
  };

  const clearSummary = () => {
    onChange('');
    toast({
      title: "Summary Cleared",
      description: "Your professional summary has been cleared."
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Professional Summary</CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={clearSummary}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={generateAISuggestion}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Suggest
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="summary">
            Write a compelling summary of your professional background and key achievements
          </Label>
          <Textarea
            id="summary"
            value={data}
            onChange={(e) => onChange(e.target.value)}
            placeholder="I am a skilled professional with expertise in..."
            className="min-h-[120px]"
          />
          <div className="text-sm text-muted-foreground">
            {data.length}/500 characters recommended
          </div>
        </div>
      </CardContent>
    </Card>
  );
};