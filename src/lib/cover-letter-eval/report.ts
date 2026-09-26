import { ScenarioResult } from './runner';
import { JUDGE_DIMENSIONS } from './judge';

export interface DimensionStat {
  id: string;
  label: string;
  zero: number;
  one: number;
  two: number;
  avg: number;
}

export interface CheckStat {
  id: string;
  label: string;
  passRate: number;
  failures: { scenarioId: string; detail: string }[];
}

export interface Report {
  total: number;
  done: number;
  errors: number;
  checksIncompleteRate: number;
  requirementsTooThinCount: number;
  deterministicPassRate: number;
  checkPassRates: CheckStat[];
  judgeDimensions: DimensionStat[];
  agreementTally: Record<string, number>;
  avgAiCalls: number;
  avgDurationMs: number;
}

export function buildReport(results: ScenarioResult[]): Report {
  const done = results.filter((result) => result.status === 'done');
  const letters = done.filter((result) => result.paragraphs.length > 0);

  const checksIncomplete = letters.filter((result) => result.paragraphs.some((paragraph) => paragraph.checksIncomplete)).length;
  const tooThin = done.filter((result) => result.requirementsTooThin).length;
  const detPassed = letters.filter((result) => result.deterministic?.passed).length;

  const checkIds = new Map<string, string>();
  letters.forEach((result) => result.deterministic?.checks.forEach((check) => checkIds.set(check.id, check.label)));
  const checkPassRates: CheckStat[] = Array.from(checkIds.entries()).map(([id, label]) => {
    const withCheck = letters.filter((result) => result.deterministic?.checks.some((check) => check.id === id));
    const passes = withCheck.filter((result) => result.deterministic!.checks.find((check) => check.id === id)!.passed).length;
    const failures = withCheck
      .filter((result) => !result.deterministic!.checks.find((check) => check.id === id)!.passed)
      .map((result) => ({ scenarioId: result.scenarioId, detail: result.deterministic!.checks.find((check) => check.id === id)!.detail }));
    return {
      id, label,
      passRate: withCheck.length ? passes / withCheck.length : 0,
      failures,
    };
  }).sort((a, b) => a.passRate - b.passRate);

  const judgeDimensions: DimensionStat[] = JUDGE_DIMENSIONS.map((dimension) => {
    const scores = letters.map((result) => result.judge?.dimensions.find((item) => item.id === dimension.id)?.score).filter((score): score is 0 | 1 | 2 => score !== undefined);
    const sum = scores.reduce((total, score) => total + score, 0);
    return {
      id: dimension.id, label: dimension.label,
      zero: scores.filter((score) => score === 0).length,
      one: scores.filter((score) => score === 1).length,
      two: scores.filter((score) => score === 2).length,
      avg: scores.length ? Number((sum / scores.length).toFixed(2)) : 0,
    };
  });

  const agreementTally: Record<string, number> = { 'agree-clean': 0, 'agree-flag': 0, 'checker-only': 0, 'judge-only': 0 };
  done.forEach((result) => { if (result.agreement) agreementTally[result.agreement.category] += 1; });

  const avgAiCalls = done.length ? done.reduce((sum, result) => sum + result.aiCalls, 0) / done.length : 0;
  const avgDurationMs = done.length ? done.reduce((sum, result) => sum + result.durationMs, 0) / done.length : 0;

  return {
    total: results.length,
    done: done.length,
    errors: results.length - done.length,
    checksIncompleteRate: letters.length ? checksIncomplete / letters.length : 0,
    requirementsTooThinCount: tooThin,
    deterministicPassRate: letters.length ? detPassed / letters.length : 0,
    checkPassRates,
    judgeDimensions,
    agreementTally,
    avgAiCalls: Number(avgAiCalls.toFixed(1)),
    avgDurationMs: Math.round(avgDurationMs),
  };
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function reportToMarkdown(report: Report, results: ScenarioResult[]): string {
  const lines: string[] = [];
  lines.push(`# Cover letter eval run`);
  lines.push('');
  lines.push(`Scenarios: ${report.total} | completed: ${report.done} | errors: ${report.errors}`);
  lines.push(`Checks incomplete rate: ${pct(report.checksIncompleteRate)} | too-thin ads: ${report.requirementsTooThinCount}`);
  lines.push(`Deterministic pass rate: ${pct(report.deterministicPassRate)} | avg AI calls: ${report.avgAiCalls} | avg duration: ${report.avgDurationMs}ms`);
  lines.push('');
  lines.push('## Deterministic checks (worst first)');
  report.checkPassRates.forEach((check) => lines.push(`- ${pct(check.passRate)} — ${check.label}${check.failures.length ? ` (e.g. ${check.failures[0].scenarioId})` : ''}`));
  lines.push('');
  lines.push('## LLM judge dimensions (avg /2)');
  report.judgeDimensions.forEach((dimension) => lines.push(`- ${dimension.avg.toFixed(2)} — ${dimension.label} (0:${dimension.zero} 1:${dimension.one} 2:${dimension.two})`));
  lines.push('');
  lines.push('## Checker agreement (in-app checker vs judge)');
  Object.entries(report.agreementTally).forEach(([category, count]) => lines.push(`- ${category}: ${count}`));
  lines.push('');
  lines.push('## Per-scenario');
  results.forEach((result) => {
    lines.push(`### ${result.label} (${result.scenarioId}) — ${result.status}`);
    if (result.status === 'error') { lines.push(`- error: ${result.error}`); return; }
    if (result.deterministic) lines.push(`- deterministic: ${result.deterministic.passed ? 'PASS' : 'FAIL'} (${result.deterministic.checks.filter((check) => !check.passed).map((check) => check.id).join(', ') || 'all clean'})`);
    if (result.judge) lines.push(`- judge: ${result.judge.dimensions.reduce((sum, dimension) => sum + dimension.score, 0)}/${result.judge.dimensions.length * 2} — ${result.judge.notes}`);
    if (result.agreement) lines.push(`- agreement: ${result.agreement.category}`);
    lines.push('');
    lines.push('```');
    lines.push(result.letterText.slice(0, 1200) || '(empty)');
    lines.push('```');
    lines.push('');
  });
  return lines.join('\n');
}
