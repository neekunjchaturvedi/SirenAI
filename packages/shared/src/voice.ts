import { z } from 'zod';

export interface CallRequest {
  incidentId: string;
  spokenSummary: string; // what Siren says first
  options: { key: string; label: string }[]; // choices to read out
}

export interface VoiceDecision {
  incidentId: string;
  optionKey?: string; // chosen option
  decision?: 'escalate' | 'none';
}

export const voiceDecisionSchema = z
  .object({
    incidentId: z.string().min(1),
    optionKey: z.string().min(1).optional(),
    decision: z.enum(['escalate', 'none']).optional(),
  })
  .refine((d) => d.optionKey !== undefined || d.decision !== undefined, {
    message: 'Provide either optionKey or decision',
  });

export interface VoiceProvider {
  placeCall(req: CallRequest): Promise<void>;
  confirm(incidentId: string, message: string): Promise<void>;
}
