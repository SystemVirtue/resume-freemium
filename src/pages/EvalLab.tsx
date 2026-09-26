import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, Square, FileDown, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAi } from '@/hooks/useAi';
import { EVAL_SCENARIOS, scenarioResume, scenarioJob } from '@/lib/cover-letter-eval/fixtures/scenarios';
import { runScenario, ScenarioResult } from '@/lib/cover-letter-eval/runner';
import { buildReport, reportToMarkdown, Report } from '@/lib/cover-letter-eval/report';
import { persistEvalRun } from '@/lib/cover-letter-eval/persist';

const pct = (value: number) => `${Math.round(value * 100)}%`;

export const EvalLab: React.FC = () => {
  const { run, isBusy } = useAi();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLine, setStatusLine] = useState('');
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const stopRef = useRef(false);

  const report: Report | null = useMemo(() => (results.length ? buildReport(results) : null), [results]);

  const start = useCallback(async () => {
    if (isBusy) { toast({ title: 'AI is busy', description: 'Wait for the current call to finish.', variant: 'destructive' }); return; }
    stopRef.current = false;
    setRunning(true);
    setResults([]);
    setBatchId(null);
    setProgress(0);
    const collected: ScenarioResult[] = [];
    for (let index = 0; index < EVAL_SCENARIOS.length; index++) {
      if (stopRef.current) break;
      const scenario = EVAL_SCENARIOS[index];
      try {
        const result = await runScenario(
          {
            id: scenario.id,
            label: scenario.label,
            resume: scenarioResume(scenario).resume,
            job: scenarioJob(scenario),
            style: scenario.style,
            rules: scenario.rules,
            context: scenario.context,
            followUp: scenario.followUp,
          },
          run,
          {
            gapMs: 400,
            onProgress: setStatusLine,
            shouldStop: () => stopRef.current,
          },
        );
        collected.push(result);
        setResults([...collected]);
      } catch (error: any) {
        if (error?.name === 'StopError') break;
        toast({ title: 'Runner failed', description: error?.message || 'Unknown error', variant: 'destructive' });
        break;
      }
      setProgress(Math.round(((index + 1) / EVAL_SCENARIOS.length) * 100));
    }
    setStatusLine(stopRef.current ? 'Stopped.' : 'Batch complete.');
    setRunning(false);
    if (collected.length) {
      const saved = await persistEvalRun({
        scenarioResults: collected.map((result) => ({
          scenarioId: result.scenarioId, label: result.label, status: result.status, error: result.error,
          requirements: result.requirements, requirementsTooThin: result.requirementsTooThin,
          paragraphs: result.paragraphs, beforeRepair: result.beforeRepair, notices: result.notices,
          deterministic: result.deterministic, judge: result.judge, agreement: result.agreement,
          letterText: result.letterText, durationMs: result.durationMs, aiCalls: result.aiCalls,
        })),
        report: buildReport(collected),
      });
      setBatchId(saved);
      if (saved) toast({ title: 'Batch saved', description: `Stored as eval run ${saved.slice(0, 8)}…` });
    }
  }, [run, isBusy]);

  const stop = useCallback(() => { stopRef.current = true; }, []);

  const downloadReport = useCallback(() => {
    if (!report || !results.length) return;
    const blob = new Blob([reportToMarkdown(report, results)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cover-letter-eval-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [report, results]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Cover Letter Eval Lab</h1>
          <p className="text-sm text-muted-foreground">Unlisted self-test harness. Runs the real drafting pipeline over fixture scenarios and scores the letters against the generation framework.</p>
        </div>
      </header>

      <div className="container mx-auto space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch run</CardTitle>
            <CardDescription>
              {EVAL_SCENARIOS.length} scenarios · serialized AI calls with a 400ms gap · every run is captured raw (prompts, answers, flags, judge scores) and saved to the eval table.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {running ? 'Running…' : 'Run all scenarios'}
            </Button>
            <Button variant="outline" onClick={stop} disabled={!running}><Square className="mr-2 h-4 w-4" />Stop</Button>
            <Button variant="outline" onClick={downloadReport} disabled={!report || !results.length}><FileDown className="mr-2 h-4 w-4" />Export markdown</Button>
            {batchId && <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />saved {batchId.slice(0, 8)}…</Badge>}
            {(running || progress > 0) && <div className="w-full"><Progress value={progress} /></div>}
            {statusLine && <p className="w-full text-xs text-muted-foreground">{statusLine}</p>}
          </CardContent>
        </Card>

        {report && (
          <Card>
            <CardHeader><CardTitle className="text-base">Aggregate report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Scenarios done" value={`${report.done}/${report.total}`} />
                <Stat label="Deterministic pass" value={pct(report.deterministicPassRate)} />
                <Stat label="Checks incomplete" value={pct(report.checksIncompleteRate)} />
                <Stat label="Avg AI calls" value={String(report.avgAiCalls)} />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Deterministic checks (worst first)</h3>
                <div className="space-y-1">
                  {report.checkPassRates.map((check) => (
                    <div key={check.id} className="flex items-center gap-2 text-xs">
                      <Badge variant={check.passRate >= 0.9 ? 'default' : check.passRate >= 0.5 ? 'secondary' : 'destructive'} className="w-12 justify-center tabular-nums">{pct(check.passRate)}</Badge>
                      <span className="text-muted-foreground">{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Judge dimensions (avg of 2)</h3>
                <div className="space-y-1">
                  {report.judgeDimensions.map((dimension) => (
                    <div key={dimension.id} className="flex items-center gap-2 text-xs">
                      <Badge variant={dimension.avg >= 1.8 ? 'default' : dimension.avg >= 1 ? 'secondary' : 'destructive'} className="w-12 justify-center tabular-nums">{dimension.avg.toFixed(2)}</Badge>
                      <span className="text-muted-foreground">{dimension.label} <span className="opacity-60">(0:{dimension.zero} 1:{dimension.one} 2:{dimension.two})</span></span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Checker agreement (in-app checker vs judge)</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.agreementTally).map(([category, count]) => (
                    <Badge key={category} variant={category === 'judge-only' ? 'destructive' : category === 'checker-only' ? 'secondary' : 'default'}>
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">"judge-only" = the letter had issues the in-app checker missed.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {results.map((result) => (
          <Card key={result.scenarioId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{result.label}</span>
                <span className="flex items-center gap-2">
                  {result.status === 'error'
                    ? <Badge variant="destructive">error</Badge>
                    : <Badge variant={result.deterministic?.passed ? 'default' : 'destructive'}>{result.deterministic?.passed ? 'PASS' : 'FAIL'}</Badge>}
                  {result.judge && <Badge variant="secondary">{result.judge.dimensions.reduce((sum, dimension) => sum + dimension.score, 0)}/{result.judge.dimensions.length * 2}</Badge>}
                  {result.agreement && <Badge variant="outline">{result.agreement.category}</Badge>}
                </span>
              </CardTitle>
              <CardDescription>{result.aiCalls} AI calls · {result.durationMs}ms · requirements: {result.requirementsTooThin ? 'too thin' : result.requirements.join(' | ') || 'none'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.status === 'error' && <p className="text-sm text-destructive">{result.error}</p>}
              {result.deterministic && (
                <div className="space-y-1">
                  {result.deterministic.checks.map((check) => (
                    <div key={check.id} className="flex items-start gap-2 text-xs">
                      <Badge variant={check.passed ? 'default' : 'destructive'} className="mt-0.5 shrink-0">{check.passed ? 'ok' : 'fail'}</Badge>
                      <span className="text-muted-foreground">{check.label} <span className="opacity-60">— {check.detail}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {result.judge && (
                <div className="space-y-1">
                  {result.judge.dimensions.map((dimension) => (
                    <div key={dimension.id} className="flex items-start gap-2 text-xs">
                      <Badge variant={dimension.score === 2 ? 'default' : dimension.score === 1 ? 'secondary' : 'destructive'} className="mt-0.5 shrink-0">{dimension.score}/2</Badge>
                      <span className="text-muted-foreground">{dimension.label}{dimension.evidence ? ` — "${dimension.evidence}"` : ''}</span>
                    </div>
                  ))}
                  {result.judge.notes && <p className="text-xs italic text-muted-foreground">{result.judge.notes}</p>}
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Generated letter</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{result.letterText || '(empty)'}</pre>
              </details>
              <details>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Notices ({result.notices.length})</summary>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{result.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold tabular-nums">{value}</p>
  </div>
);

export default EvalLab;
