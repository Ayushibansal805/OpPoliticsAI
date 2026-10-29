import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { checkMlHealth, getMlMetadata } from './mlService.js';

export type ModelStatus = 'available' | 'coming_soon' | 'unavailable';

const baseModels = [
  {
    id: 'resolution-time',
    displayName: 'Resolution-Time Prediction',
    shortName: 'Resolution time',
    description: 'Estimate elapsed resolution duration from ticket creation-time signals.',
    status: 'unavailable' as ModelStatus,
    inputSchema: 'issue_created, issue_priority, issue_type, issue_proj',
    outputSchema: 'duration in hours, point estimate',
  },
  {
    id: 'operational-risk',
    displayName: 'Operational Risk / Bottleneck Intelligence',
    shortName: 'Risk intelligence',
    description: 'A reserved integration surface for future bottleneck and operational risk signals.',
    status: 'coming_soon' as ModelStatus,
    inputSchema: null,
    outputSchema: null,
  },
  {
    id: 'workload-forecasting',
    displayName: 'Workload / Operations Forecasting',
    shortName: 'Workload forecasting',
    description: 'A reserved integration surface for future capacity and workload forecasting.',
    status: 'coming_soon' as ModelStatus,
    inputSchema: null,
    outputSchema: null,
  },
];

function artifactDir() {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
  const candidates = [
    path.resolve(process.cwd(), env.mlArtifactDir),
    path.resolve(process.cwd(), 'ml/artifacts/resolution'),
    path.resolve(moduleRoot, 'ml/artifacts/resolution'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function readEvaluation() {
  try {
    const v3Path = path.resolve(artifactDir(), '../../experiments/resolution_v3_evaluation.json');
    if (fs.existsSync(v3Path)) {
      const report = JSON.parse(fs.readFileSync(v3Path, 'utf8')) as Record<string, any>;
      const metrics = report.comparison_test_metrics.log1p_hist_gradient_boosting;
      const median = report.comparison_test_metrics.training_median;
      return {
        model: 'HistGradientBoostingRegressor with log1p target',
        target: { definition: report.target_formula, unit: 'hours', included_rows: report.target_and_data_audit.raw_rows - report.excluded_missing_resolution_timestamp_n },
        splits: Object.entries(report.splits).map(([split, value]: [string, any]) => ({
          split, rows: value.n, first_created: value.start, last_created: value.end,
        })),
        validation: { model: 'Log1p HistGradientBoostingRegressor', validation_mae_hours: report.validation_model_metrics.mae_hours,
          validation_rmse_hours: report.validation_model_metrics.rmse_hours, validation_r2: report.validation_model_metrics.r2 },
        finalTest: { ...metrics, n_test: metrics.n },
        testMedianBaseline: median,
        baselineImprovementHours: median.mae_hours - metrics.mae_hours,
      };
    }
    const metricsPath = path.join(artifactDir(), 'metrics.json');
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8')) as Record<string, any>;
    return {
      target: metrics.target,
      splits: metrics.splits,
      validation: metrics.validation_model_selection?.best_validation_row,
      finalTest: metrics.final_test,
      testMedianBaseline: metrics.test_median_baseline,
      baselineImprovementHours: metrics.test_baseline_improvement_hours,
    };
  } catch {
    return null;
  }
}

export async function listModels() {
  const health = await checkMlHealth();
  return baseModels.map((model) => model.id === 'resolution-time' ? { ...model, status: health.available ? 'available' : 'unavailable', health: health.data, evaluation: readEvaluation() } : model);
}

export async function getModel(modelId: string) {
  const models = await listModels();
  return models.find((model) => model.id === modelId) ?? null;
}

export async function getResolutionMetadata() {
  return getMlMetadata();
}
