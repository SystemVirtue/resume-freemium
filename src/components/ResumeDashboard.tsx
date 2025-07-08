import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { FileText, Plus, Edit, Copy, Trash2, Share, Eye, Download, Calendar, User, ArrowLeft } from 'lucide-react';
import { ResumeData } from '@/types/resume';
import { formatDistanceToNow } from 'date-fns';

interface Resume {
  id: string;
  title: string;
  content: any; // Json type from Supabase
  created_at: string;
  updated_at: string;
  is_public: boolean;
  public_slug: string | null;
}

interface ResumeDashboardProps {
  onCreateNew: () => void;
  onEditResume: (resumeData: ResumeData, resumeId: string) => void;
  onBack: () => void;
}

export const ResumeDashboard: React.FC<ResumeDashboardProps> = ({
  onCreateNew,
  onEditResume,
  onBack
}) => {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSlug, setShareSlug] = useState('');

  useEffect(() => {
    fetchResumes();
  }, [user]);

  const fetchResumes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setResumes((data || []).map(item => ({
        ...item,
        content: item.content as unknown as ResumeData
      })));
    } catch (error) {
      console.error('Error fetching resumes:', error);
      toast({
        title: "Error",
        description: "Failed to load your resumes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!selectedResumeId) return;

    try {
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', selectedResumeId);

      if (error) throw error;

      setResumes(prev => prev.filter(resume => resume.id !== selectedResumeId));
      setDeleteDialogOpen(false);
      setSelectedResumeId(null);
      
      toast({
        title: "Resume deleted",
        description: "Your resume has been permanently deleted."
      });
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: "Error",
        description: "Failed to delete resume. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDuplicateResume = async (resume: Resume) => {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .insert({
          title: `${resume.title} (Copy)`,
          content: resume.content as any
        })
        .select()
        .single();

      if (error) throw error;

      fetchResumes();
      toast({
        title: "Resume duplicated",
        description: "A copy of your resume has been created."
      });
    } catch (error) {
      console.error('Error duplicating resume:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate resume. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleShareResume = async () => {
    if (!selectedResumeId || !shareSlug) return;

    try {
      const { error } = await supabase
        .from('resumes')
        .update({
          is_public: true,
          public_slug: shareSlug
        })
        .eq('id', selectedResumeId);

      if (error) throw error;

      const shareUrl = `${window.location.origin}/resume/${shareSlug}`;
      await navigator.clipboard.writeText(shareUrl);

      fetchResumes();
      setShareDialogOpen(false);
      setSelectedResumeId(null);
      setShareSlug('');

      toast({
        title: "Resume shared",
        description: "Share link copied to clipboard!"
      });
    } catch (error) {
      console.error('Error sharing resume:', error);
      toast({
        title: "Error",
        description: "Failed to share resume. Please try again.",
        variant: "destructive"
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading your resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">My Resumes</h1>
                <p className="text-muted-foreground">Manage and organize your professional resumes</p>
              </div>
            </div>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Resume
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {resumes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">No resumes yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first professional resume to get started
            </p>
            <Button onClick={onCreateNew} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Resume
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumes.map((resume) => (
              <Card key={resume.id} className="group hover:shadow-elegant transition-smooth">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{resume.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(resume.updated_at), { addSuffix: true })}
                        </Badge>
                        {resume.is_public && (
                          <Badge variant="outline" className="text-xs">
                            <Share className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <User className="h-4 w-4" />
                    <span>{resume.content?.basics?.name || 'Untitled Resume'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditResume(resume.content, resume.id)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{resume.title} - Preview</DialogTitle>
                        </DialogHeader>
                        <div className="bg-white p-6 rounded-lg border text-black">
                          <div className="space-y-4">
                            <div className="text-center">
                              <h1 className="text-2xl font-bold">{resume.content?.basics?.name}</h1>
                              <p className="text-gray-600">{resume.content?.basics?.email} | {resume.content?.basics?.phone}</p>
                            </div>
                            {resume.content?.basics?.summary && (
                              <div>
                                <h2 className="text-lg font-semibold border-b pb-1">Professional Summary</h2>
                                <p className="mt-2">{resume.content.basics.summary}</p>
                              </div>
                            )}
                            {resume.content?.work && resume.content.work.length > 0 && (
                              <div>
                                <h2 className="text-lg font-semibold border-b pb-1">Work Experience</h2>
                                <div className="space-y-3 mt-2">
                                  {resume.content.work.map((job, idx) => (
                                    <div key={idx}>
                                      <h3 className="font-medium">{job.position} at {job.company}</h3>
                                      <p className="text-sm text-gray-600">{job.startDate} - {job.endDate || 'Present'}</p>
                                      <p className="text-sm mt-1">{job.summary}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateResume(resume)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    
                    <Dialog open={shareDialogOpen && selectedResumeId === resume.id} onOpenChange={setShareDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedResumeId(resume.id);
                            setShareSlug(generateSlug(resume.title));
                          }}
                        >
                          <Share className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Share Resume</DialogTitle>
                          <DialogDescription>
                            Create a public link for your resume that you can share with employers.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="share-slug">Custom URL slug</Label>
                            <Input
                              id="share-slug"
                              value={shareSlug}
                              onChange={(e) => setShareSlug(e.target.value)}
                              placeholder="my-resume-slug"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Your resume will be available at: resume-builder.com/resume/{shareSlug}
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleShareResume}>
                            Share Resume
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog open={deleteDialogOpen && selectedResumeId === resume.id} onOpenChange={setDeleteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedResumeId(resume.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Resume</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete "{resume.title}"? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={handleDeleteResume}>
                            Delete Resume
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};