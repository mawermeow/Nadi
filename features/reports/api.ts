export type MetricSummaryResponse = {
  itemId: string;
  title: string;
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  count: number;
  total?: number;
  avg?: number;
  min?: number;
  max?: number;
};

export type SymptomSummaryResponse = {
  itemId: string;
  title: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  occurrenceCount: number;
  avgSeverity?: number;
};

export type SummaryReportResponse = {
  from: string;
  to: string;
  metrics: MetricSummaryResponse[];
  symptoms: SymptomSummaryResponse[];
};

export type CorrelationCandidateResponse = {
  itemId: string;
  title: string;
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  correlationScore: number;
  sampleSize: number;
  description: string;
};

export type CorrelationReportResponse = {
  symptomItemId: string;
  symptomTitle: string;
  from: string;
  to: string;
  windowHours: number;
  symptomSampleSize: number;
  minimumSampleSize: number;
  candidates: CorrelationCandidateResponse[];
};
