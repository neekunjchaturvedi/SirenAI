import { z } from 'zod';

export type IncidentStatus =
  | 'analyzing' // Watcher tripped; Analyzer is reading logs
  | 'awaiting_decision' // Analyzer produced options; voice call placed
  | 'executing'
  | 'verifying'
  | 'resolved'
  | 'escalated';

export const incidentStatusSchema = z.enum([
  'analyzing',
  'awaiting_decision',
  'executing',
  'verifying',
  'resolved',
  'escalated',
]);

export interface ProposedAction {
  action: string; // must match an ActionDefinition.name
  params: Record<string, unknown>;
  rationale: string;
  reversible: boolean;
}

export const proposedActionSchema = z.object({
  action: z.string().min(1),
  params: z.record(z.unknown()),
  rationale: z.string().min(1),
  reversible: z.boolean(),
});

/** Business-impact rating produced by the Analyzer LLM (shown on the dashboard). */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);

export interface Diagnosis {
  isIncident: boolean; // Analyzer's verdict; false => discard, no call
  rootCauseHypothesis: string;
  confidence: 'low' | 'medium' | 'high';
  severity: Severity; // LLM-rated impact: low | medium | high | critical
  proposedActions: ProposedAction[]; // ranked, 2-3 options, catalog-only
}

export const diagnosisSchema = z.object({
  isIncident: z.boolean(),
  rootCauseHypothesis: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  // model-produced; tolerate omission so a missing key never stalls the loop
  severity: severitySchema.default('medium'),
  proposedActions: z.array(proposedActionSchema),
});

export interface TimelineEntry {
  ts: string;
  status: IncidentStatus;
  note: string;
}

export interface Incident {
  id: string;
  status: IncidentStatus;
  detectedAt: string;
  trigger: {
    type: string;
    detail: string;
    metricsSnapshot: Record<string, number>;
  }; // why the Watcher woke
  logWindow: string[]; // log lines handed to the Analyzer
  diagnosis?: Diagnosis;
  chosenAction?: ProposedAction;
  attemptedActions: string[];
  executionResult?: { ok: boolean; detail: string };
  verification?: { healthy: boolean; metricsAfter: Record<string, number> };
  timeline: TimelineEntry[];
}
