import OpenAI from 'openai';
import {
  type AnalyzerInput,
  type Diagnosis,
  type LLMProvider,
  type ProposedAction,
  ACTION_NAMES,
  diagnosisSchema,
  getActionDefinition,
} from '@siren/shared';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import { buildAnalyzeMessages, buildRepairMessages } from './prompt.js';

/**
 * OpenAI-compatible Analyzer provider. Works against any /v1/chat/completions
 * endpoint (Sarvam cloud, LM Studio, OpenAI, …). Portability comes from
 * strict-JSON prompting + zod validation + one repair retry — NOT native
 * tool-calling. The auth header is configurable so Sarvam's `api-subscription-key`
 * and the standard `Authorization: Bearer` both work with no code change.
 */
export class OpenAILLMProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {
    const { baseUrl, apiKey, apiKeyHeader, model, timeoutMs } = cfg.llm;
    const defaultHeaders: Record<string, string> =
      apiKeyHeader && apiKeyHeader !== 'authorization' ? { [apiKeyHeader]: apiKey } : {};
    this.client = new OpenAI({ baseURL: baseUrl, apiKey, defaultHeaders, timeout: timeoutMs });
    this.model = model;
  }

  async analyze(input: AnalyzerInput): Promise<Diagnosis> {
    const first = await this.complete(buildAnalyzeMessages(input));
    try {
      return this.validate(first);
    } catch (e) {
      const error = (e as Error).message;
      this.log.warn({ error }, 'analyzer JSON failed validation; attempting one repair');
      const repaired = await this.complete(buildRepairMessages(input, first, error));
      return this.validate(repaired); // throws on second failure -> caller falls back
    }
  }

  private async complete(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.cfg.llm.temperature,
      max_tokens: this.cfg.llm.maxTokens,
    });
    const choice = res.choices[0]?.message as { content?: string | null; reasoning_content?: string } | undefined;
    // reasoning models put thinking in reasoning_content and the answer in content;
    // fall back to reasoning_content only if content is empty (best-effort JSON salvage).
    return choice?.content?.trim() || choice?.reasoning_content || '';
  }

  /** Structural zod check + catalog enforcement (unknown action / bad params => throw). */
  private validate(raw: string): Diagnosis {
    const json = extractJson(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('response was not valid JSON');
    }
    const d = diagnosisSchema.parse(parsed);

    if (!d.isIncident) return { ...d, proposedActions: [] };

    if (d.proposedActions.length === 0) {
      throw new Error('isIncident=true but proposedActions is empty');
    }

    const actions: ProposedAction[] = d.proposedActions.map((a) => {
      const def = getActionDefinition(a.action);
      if (!def) {
        throw new Error(
          `action "${a.action}" is not in the catalog; allowed: ${ACTION_NAMES.join(', ')}`,
        );
      }
      const params = def.paramsSchema.parse(a.params); // applies defaults, strips extras, validates
      return { ...a, params, reversible: def.reversible };
    });

    return { ...d, proposedActions: actions };
  }
}

/** Pull a JSON object out of model output, tolerating reasoning prefixes and fences.
 * Reasoning models (e.g. sarvam-m on NVIDIA NIM) emit `<think>…</think>` then the
 * answer — and the reasoning text itself can contain braces, so we must drop
 * everything up to the LAST `</think>` before scanning for JSON. */
export function extractJson(content: string): string {
  let s = content;
  const lastClose = s.lastIndexOf('</think>');
  if (lastClose >= 0) s = s.slice(lastClose + '</think>'.length);
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  if (s.startsWith('{')) return s;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}
