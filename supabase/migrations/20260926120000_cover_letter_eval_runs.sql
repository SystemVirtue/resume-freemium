-- Eval harness persistence for the cover letter crafter self-test plan.
-- Stores one row per completed eval batch: the aggregate report and all scenario artifacts.

CREATE TABLE public.cover_letter_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenario_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.cover_letter_eval_runs TO authenticated;
GRANT ALL ON public.cover_letter_eval_runs TO service_role;

ALTER TABLE public.cover_letter_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own eval runs"
  ON public.cover_letter_eval_runs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own eval runs"
  ON public.cover_letter_eval_runs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_cover_letter_eval_runs_user_created
  ON public.cover_letter_eval_runs (user_id, created_at DESC);
