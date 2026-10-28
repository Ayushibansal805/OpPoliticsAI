export type ThemePreference = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  themePreference: ThemePreference;
}

export type ModelStatus = 'available' | 'coming_soon' | 'unavailable';

export interface ModelInfo {
  id: string;
  displayName: string;
  shortName: string;
  description: string;
  status: ModelStatus;
  inputSchema: string | null;
  outputSchema: string | null;
  health?: { status?: string; service?: string; message?: string };
  evaluation?: Evaluation | null;
}

export interface Evaluation {
  target?: { definition?: string; unit?: string; prediction_type?: string; included_rows?: number };
  splits?: Array<{ split: string; rows: number; first_created: string; last_created: string }>;
  validation?: { model?: string; validation_mae_hours?: number; validation_rmse_hours?: number; validation_r2?: number };
  finalTest?: { mae_hours?: number; rmse_hours?: number; r2?: number; n_test?: number };
  final_test?: { mae_hours?: number; rmse_hours?: number; r2?: number; n_test?: number };
  testMedianBaseline?: { mae_hours?: number; rmse_hours?: number; r2?: number };
  test_median_baseline?: { mae_hours?: number; rmse_hours?: number; r2?: number };
  baselineImprovementHours?: number;
  test_baseline_improvement_hours?: number;
}

export interface Prediction {
  id: string;
  modelId: string;
  modelVersion?: string;
  predictionType: string;
  input: { issueCreated: string; priority: string; issueType: string; project: string };
  output?: { duration?: number; unit?: string };
  status: 'success' | 'failed';
  errorCode?: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalPredictions: number;
  resolutionPredictions: number;
  averageResolutionHours: number | null;
  availableModels: number;
  models: ModelInfo[];
}

export interface DashboardActivity {
  recent: Prediction[];
  daily: Array<{ _id: string; count: number; averageHours: number }>;
  byPriority: Array<{ _id: string; count: number }>;
}

export interface ModelMetadata {
  status: string;
  model_id: string;
  display_name: string;
  model_name?: string;
  artifact_generated_at?: string;
  raw_input_columns: string[];
  engineered_features: string[];
  prediction_type: string;
  target_unit: string;
  fields: Record<string, { label: string; required: boolean; options: string[] }>;
  evaluation?: Evaluation;
}

export interface PaginatedPredictions {
  items: Prediction[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}
