import { supabase } from '@/integrations/supabase/client';
import { ScenarioResult } from './runner';
import { Report } from './report';

export interface PersistBatch {
  scenarioResults: {
    scenarioId: string;
    label: string;
    status: string;
    error?: string;
    requirements: string[];
    requirementsTooThin: boolean;
    paragraphs: unknown;
    beforeRepair: unknown;
    notices: string[];
    deterministic: unknown;
    judge: unknown;
    agreement: unknown;
    letterText: string;
    durationMs: number;
    aiCalls: number;
  }[];
  report: Report;
}

/** The eval table ships via a new migration, so it is not in the generated types yet. */
const evalTable = () => (supabase as any).from('cover_letter_eval_runs') as {
  insert: (row: any) => { select: (cols: string) => { single: () => Promise<{ data: any; error: any }> } };
  select: (cols: string) => { order: (col: string, opts: any) => { limit: (n: number) => Promise<{ data: any; error: any }> } };
};

/** Store a completed eval batch for later regression comparison. Returns the batch id, or null on failure. */
export async function persistEvalRun(batch: PersistBatch): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await evalTable().insert({
    user_id: userData.user.id,
    report: batch.report,
    scenario_results: batch.scenarioResults,
  }).select('id').single();
  if (error) {
    console.warn('Eval persistence failed (has the migration run?):', error?.message);
    return null;
  }
  return data?.id ?? null;
}

/** Fetch past run summaries for regression comparison. */
export async function fetchEvalRuns(): Promise<{ id: string; createdAt: string; report: Report | null }[]> {
  const { data, error } = await evalTable().select('id, created_at, report')
    .order('created_at', { ascending: false }).limit(20);
  if (error || !data) return [];
  return data.map((row: any) => ({ id: row.id, createdAt: row.created_at, report: (row.report as Report) || null }));
}

export type { ScenarioResult };
