import type { Diagnosis } from './incident.js';

export interface AnalyzerInput {
  trigger: { type: string; detail: string };
  logWindow: string[];
  metricsHistory: Record<string, number>[];
  catalog: { name: string; description: string; params: string }[]; // serialized catalog
  deployNote?: string; // deployment context, e.g. current image + last known-good tag
}

/** Provider returns a Diagnosis, validated with zod; one repair retry on parse failure. */
export interface LLMProvider {
  analyze(input: AnalyzerInput): Promise<Diagnosis>;
}
