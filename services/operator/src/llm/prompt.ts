import type { AnalyzerInput } from '@siren/shared';
import type OpenAI from 'openai';

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const SYSTEM = `You are Siren's Analyzer — the diagnostic brain of an automated incident-response system.
You read recent logs and metrics from a production service and decide whether there is a REAL incident,
hypothesize the root cause, and propose remediations.

HARD RULES:
- Respond with STRICT JSON ONLY. No markdown, no code fences, no prose before or after.
- You MUST choose proposedActions ONLY from the provided action catalog (by exact "action" name).
- Never invent shell commands, code, or actions outside the catalog.
- Provide concrete typed params for each action exactly as the catalog specifies.
- If logs/metrics look nominal (no errors, healthy, normal latency/memory), set "isIncident": false
  and return an empty proposedActions array.

OUTPUT SCHEMA (return exactly this shape):
{
  "isIncident": boolean,
  "rootCauseHypothesis": string,
  "confidence": "low" | "medium" | "high",
  "severity": "low" | "medium" | "high" | "critical",
  "proposedActions": [
    { "action": string, "params": object, "rationale": string, "reversible": boolean }
  ]
}

"severity" rates the BUSINESS IMPACT of the incident:
- "critical": service is down or /health is failing for all users; revenue/availability at risk now.
- "high": major degradation; many requests failing or a core flow broken.
- "medium": partial/intermittent degradation; some users affected.
- "low": minor or cosmetic; little user impact.

When isIncident is true, return 2-3 ranked proposedActions (best first), each with a one-line rationale.`;

function renderCatalog(input: AnalyzerInput): string {
  return input.catalog.map((a) => `- ${a.name} params=${a.params} :: ${a.description}`).join('\n');
}

function renderMetrics(input: AnalyzerInput): string {
  if (input.metricsHistory.length === 0) return '(no metrics)';
  return input.metricsHistory
    .map(
      (m) =>
        `reqRate=${m.requestRate} errRate=${m.errorRate} p95=${m.p95LatencyMs}ms mem=${m.memoryMb}MB`,
    )
    .join('\n');
}

export function buildAnalyzeMessages(input: AnalyzerInput): Msg[] {
  const user = `WATCHER TRIGGER: ${input.trigger.type} — ${input.trigger.detail}
${input.deployNote ? `\nDEPLOYMENT CONTEXT: ${input.deployNote}\n` : ''}
ACTION CATALOG (choose ONLY from these):
${renderCatalog(input)}

RECENT METRICS (oldest first):
${renderMetrics(input)}

RECENT LOG LINES (oldest first):
${input.logWindow.join('\n')}

Return the STRICT JSON diagnosis now.`;
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}

export function buildRepairMessages(
  input: AnalyzerInput,
  badContent: string,
  error: string,
): Msg[] {
  return [
    ...buildAnalyzeMessages(input),
    { role: 'assistant', content: badContent },
    {
      role: 'user',
      content: `Your previous response was invalid: ${error}
Return ONLY corrected STRICT JSON matching the schema. No markdown, no commentary. Remember: proposedActions must use ONLY catalog action names with their exact params.`,
    },
  ];
}
