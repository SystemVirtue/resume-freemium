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
  /** Gate verdict distribution across completed scenarios. */
  gateTally: Record<string, number>;
  avgPlanCover: number | null;
  avgAdEcho: number;
  deterministicPassRate: number;
  checkPassRates: CheckStat[];
  judgeDimensions: DimensionStat[];
  agreementTally: Record<string, number>;
  repairedShare: number;
  avgAiCalls: number;
  avgDurationMs: number;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function buildReport(results: ScenarioResult[]): Report {
  const done = results.filter((result) => result.status === 'done');

  const gateTally: Record<string, number> = { pass: 0, minor: 0, 'needs-input': 0, regenerate: 0 };
  done.forEach((result) => { if (result.gate) gateTally[result.gate.verdict] += 1; });

  const planCovers = done.map((result) => result.planCover).filter((value): value is number => typeof value === 'number');
  const detPassed = done.filter((result) => result.deterministic?.passed).length;

  const checkIds = new Map<string, string>();
  done.forEach((result) => result.deterministic?.checks.forEach((check) => checkIds.set(check.id, check.label)));
  const checkPassRates: CheckStat[] = Array.from(checkIds.entries()).map(([id, label]) => {
    const withCheck = done.filter((result) => result.deterministic?.checks.some((check) => check.id === id));
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
    const scores = done.map((result) => result.judge?.dimensions.find((item) => item.id === dimension.id)?.score).filter((score): score is 0 | 1 | 2 => score !== undefined);
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

  return {
    total: results.length,
    done: done.length,
    errors: results.length - done.length,
    gateTally,
    avgPlanCover: planCovers.length ? Number((planCovers.reduce((a, b) => a + b, 0) / planCovers.length).toFixed(2)) : null,
    avgAdEcho: done.length ? Number((done.reduce((sum, result) => sum + result.adEcho, 0) / done.length).toFixed(3)) : 0,
    deterministicPassRate: done.length ? detPassed / done.length : 0,
    checkPassRates,
    judgeDimensions,
    agreementTally,
    repairedShare: done.length ? done.filter((result) => result.repaired).length / done.length : 0,
    avgAiCalls: done.length ? Number((done.reduce((sum, result) => sum + result.aiCalls, 0) / done.length).toFixed(1)) : 0,
    avgDurationMs: done.length ? Math.round(done.reduce((sum, result) => sum + result.durationMs, 0) / done.length) : 0,
  };
}

export function reportToMarkdown(report: Report, results: ScenarioResult[]): string {
  const lines: string[] = [];
  lines.push(`# Cover letter eval run`);
  lines.push('');
  lines.push(`Scenarios: ${report.total} | completed: ${report.done} | errors: ${report.errors}`);
  lines.push(`Gate: pass ${report.gateTally.pass} · minor ${report.gateTally.minor} · needs-input ${report.gateTally['needs-input']} · regenerate ${report.gateTally.regenerate}`);
  lines.push(`Deterministic pass rate: ${pct(report.deterministicPassRate)} | avg plan coverage: ${report.avgPlanCover === null ? 'n/a' : pct(report.avgPlanCover)} | avg ad echo: ${(report.avgAdEcho * 100).toFixed(1)}% | auto-repaired: ${pct(report.repairedShare)}`);
  lines.push(`Avg AI calls per scenario: ${report.avgAiCalls} | avg duration: ${report.avgDurationMs}ms`);
  lines.push('');
  lines.push('## Deterministic checks (worst first)');
  report.checkPassRates.forEach((check) => lines.push(`- ${pct(check.passRate)} — ${check.label}${check.failures.length ? ` (e.g. ${check.failures[0].scenarioId}: ${check.failures[0].detail.slice(0, 80)})` : ''}`));
  lines.push('');
  lines.push('## LLM judge dimensions (avg /2)');
  report.judgeDimensions.forEach((dimension) => lines.push(`- ${dimension.avg.toFixed(2)} — ${dimension.label} (0:${dimension.zero} 1:${dimension.one} 2:${dimension.two})`));
  lines.push('');
  lines.push('## Checker agreement (app checks vs independent judge)');
  Object.entries(report.agreementTally).forEach(([category, count]) => lines.push(`- ${category}: ${count}`));
  lines.push('');
  lines.push('## Per-scenario');
  results.forEach((result) => {
    lines.push(`### ${result.label} (${result.scenarioId}) — ${result.status}`);
    if (result.status === 'error') { lines.push(`- error: ${result.error}`); return; }
    if (result.gate) lines.push(`- gate: ${result.gate.verdict} — ${result.gate.detail}`);
    if (result.deterministic) lines.push(`- deterministic: ${result.deterministic.passed ? 'PASS' : 'FAIL'} (${result.deterministic.checks.filter((check) => !check.passed).map((check) => check.id).join(', ') || 'all clean'})`);
    if (result.judge) lines.push(`- judge: ${result.judge.dimensions.reduce((sum, dimension) => sum + dimension.score, 0)}/${result.judge.dimensions.length * 2} — ${result.judge.notes}`);
    if (result.agreement) lines.push(`- agreement: ${result.agreement.category}`);
    lines.push(`- plan coverage: ${result.planCover === null ? 'n/a' : pct(result.planCover)} | ad echo: ${(result.adEcho * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('```');
    lines.push(result.letterText.slice(0, 1200) || '(empty)');
    lines.push('```');
    lines.push('');
  });
  return lines.join('\n');
}
