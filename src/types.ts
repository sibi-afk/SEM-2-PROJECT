export interface FeatureDefinition {
  name: string;
  label: string;
  type: "numerical" | "categorical" | "boolean" | "text";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  defaultVal: any;
  description: string;
}

export interface ModelMetrics {
  accuracy: string;
  precision: string;
  recall: string;
  f1Score: string;
  aucRoc?: string;
}

export interface VivaQuestion {
  question: string;
  answer: string;
  topic?: string;
}

export interface NetworkLayer {
  id: string;
  name: string;
  type: string;
  shape: string;
  units: number;
  activation: string;
  weightsCount: number;
  biasesCount: number;
  totalParams: number;
  trainable: boolean;
  description: string;
  formula?: string;
  outputSummary?: string;
}

export interface Sem2Project {
  id: string;
  name: string;
  shortCode: string;
  domain: string;
  semester: string;
  problemStatement: string;
  algorithm: string;
  framework: "scikit-learn" | "pytorch" | "tensorflow";
  features: FeatureDefinition[];
  metrics: ModelMetrics;
  architectureSummary: string;
  vivaQuestions: VivaQuestion[];
  layers?: NetworkLayer[];
  presetTestCases?: {
    label: string;
    description: string;
    values: Record<string, any>;
  }[];
}

export interface InferenceKeyFactor {
  factor: string;
  impact: "Positive" | "Negative" | "Neutral";
  weight: number;
}

export interface InferenceResult {
  prediction: string;
  confidence: number;
  latencyMs: number;
  reasoning: string;
  keyFactors: InferenceKeyFactor[];
  recommendation: string;
  evaluationSummary?: string;
  isSimulated?: boolean;
}
