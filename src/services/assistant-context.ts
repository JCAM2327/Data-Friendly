import type { DatasetSummary } from "@/lib/types";
import type { RawTable } from "./file-parser";
import type { CleaningStep } from "@/state/dataset-store";
import type { ValidationRule } from "./validation-service";
import { assessQuality, describeRule, readinessLabel } from "./validation-service";
import { runEda } from "./eda-service";
import { buildMlPlan } from "./ml-service";
import { compareIssues } from "./report-service";
import { problemLabels, type ExperimentResult } from "./ml-advisor";

const r = (n: number, d = 3) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

/**
 * Builds the only information the assistant may see: metadata and computed results.
 * Never includes raw rows, previews, sample values, row indices or scatter points.
 */
export function buildAssistantContext(input: {
  dataset: DatasetSummary;
  originalDataset: DatasetSummary;
  table: RawTable;
  steps: CleaningStep[];
  rules: ValidationRule[];
  ml: ExperimentResult | null;
  selectedModel: string;
}) {
  const { dataset: ds, originalDataset: od, table, steps, rules, ml } = input;
  const quality = assessQuality(table, ds, rules);
  const eda = runEda(table, ds);
  const plan = buildMlPlan(ds, table, eda, rules);
  return {
    dataset: { name: ds.name, isDemo: ds.isDemo, rows: ds.rows, columns: ds.columns, missingPct: ds.missingPct, duplicateRows: ds.duplicates, originalRows: od.rows, originalColumns: od.columns },
    columns: ds.columnProfiles.map((c) => ({
      name: c.name, type: c.type, missingPct: c.missingPct, nullCount: c.nullCount, uniqueCount: c.uniqueCount,
      ...(c.type === "numerica" ? { min: c.min, max: c.max, mean: c.mean, median: c.median, std: c.std } : {}),
    })),
    quality: {
      scoreBefore: od.qualityScore, scoreNow: quality.score, readiness: readinessLabel[quality.readiness],
      dimensions: quality.dimensions.map((d) => ({ name: d.label, score: d.score, weight: d.weight, detail: d.detail })),
      blockers: quality.blockers, warnings: quality.warnings,
      issueCounts: compareIssues(od.issues, ds.issues),
      pendingIssues: ds.issues.map((i) => ({ title: i.title, severity: i.severity, column: i.column, affectedRows: i.affectedRows, detail: i.detail, suggestedFix: i.suggestedFix })),
      rules: quality.results.map((x) => ({ rule: describeRule(x.rule), critical: x.rule.critical, evaluated: x.evaluated, failed: x.failed, compliancePct: x.compliance, passed: x.passed })),
    },
    transformations: steps.map((s) => ({ at: s.at, operation: s.operation, column: s.column, method: s.method, affectedRows: s.affected, result: s.result })),
    eda: {
      numeric: eda.numeric.map((n) => ({ column: n.column, n: n.n, mean: r(n.mean), median: r(n.median), min: r(n.min), max: r(n.max), std: r(n.std), p25: r(n.p25), p75: r(n.p75), iqr: r(n.iqr), skew: r(n.skew), outliers: n.outliers })),
      categorical: eda.categorical.map((c) => ({ column: c.column, n: c.n, cardinality: c.cardinality, dominantPct: r(c.dominantPct, 1), top: c.top.slice(0, 5).map((t) => ({ value: t.value, count: t.count, pct: r(t.pct, 1) })) })),
      correlations: eda.correlations.slice(0, 15).map((c) => ({ a: c.a, b: c.b, r: r(c.r) })),
      strongPairs: eda.strongPairs.map((c) => ({ a: c.a, b: c.b, r: r(c.r) })),
      series: eda.series.map((s) => ({ dateColumn: s.dateColumn, valueColumn: s.valueColumn, periods: s.points.length, trendPct: s.trendPct })),
      insights: eda.insights, recommendedAnalyses: eda.recommendations,
    },
    mlAdvisor: {
      targetCandidates: plan.targetCandidates, blockers: plan.blockers,
      techniques: plan.recommendations.map((t) => ({ technique: t.technique, family: t.family, fitScore: t.fitScore, suggestedTarget: t.suggestedTarget, rationale: t.rationale, requirement: t.requirement, preparation: t.preparation })),
    },
    mlExperiment: ml ? {
      problem: problemLabels[ml.problem], target: ml.config.target || null, features: ml.config.features, principalMetric: ml.principal,
      trainRows: ml.trainRows, testRows: ml.testRows, excludedRows: ml.excludedRows, warnings: ml.warnings,
      recommendedModel: ml.recommended, selectedModel: input.selectedModel || null,
      models: ml.models.map((m) => ({ id: m.id, name: m.name, metrics: m.metrics, trainScore: m.trainScore, seconds: r(m.seconds), observations: m.observations, error: m.error ?? null, permutationImportance: m.importance.slice(0, 10).map((i) => ({ feature: i.feature, value: r(i.value, 4) })) })),
    } : null,
  };
}

export type AssistantContext = ReturnType<typeof buildAssistantContext>;
