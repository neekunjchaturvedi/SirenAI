import type { LLMProvider } from '@siren/shared';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import { OpenAILLMProvider } from './provider.js';

export { OpenAILLMProvider, extractJson } from './provider.js';

/** Single OpenAI-compatible provider; swap models/endpoints purely via env. */
export function createLLMProvider(cfg: Config, log: Logger): LLMProvider {
  return new OpenAILLMProvider(cfg, log);
}
