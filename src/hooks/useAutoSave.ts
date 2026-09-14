import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AutoSaveOptions {
  data: any;
  resumeId?: string;
  onSave?: (resumeId: string) => void;
  delay?: number;
}

export const useAutoSave = ({ data, resumeId, onSave, delay = 2000 }: AutoSaveOptions) => {
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!user || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      try {
        if (resumeId) {
          // Update existing resume
          const { error } = await supabase
            .from('resumes')
            .update({
              content: data,
              updated_at: new Date().toISOString()
            })
            .eq('id', resumeId);

          if (error) throw error;
        } else {
          // Create new resume
          const { data: newResume, error } = await supabase
            .from('resumes')
            .insert({
              user_id: user.id,
              title: data.basics?.name ? `${data.basics.name}'s Resume` : 'Untitled Resume',
              content: data
            })
            .select()
            .single();

          if (error) throw error;
          if (newResume && onSave) {
            onSave(newResume.id);
          }
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        toast({
          title: "Auto-save Failed",
          description: "Your changes couldn't be saved automatically. Please try again.",
          variant: "destructive"
        });
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, resumeId, user, delay, onSave]);

  return {
    clearAutoSave: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };
};