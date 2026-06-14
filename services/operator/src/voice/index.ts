import type { VoiceProvider } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import { MockVoiceProvider } from './mock.js';
import { ElevenLabsVoiceProvider } from './elevenlabs.js';

export { MockVoiceProvider } from './mock.js';
export { ElevenLabsVoiceProvider } from './elevenlabs.js';

/** Select the voice provider via VOICE_PROVIDER. Same interface either way. */
export function createVoiceProvider(cfg: Config, bus: Bus, log: Logger): VoiceProvider {
  if (cfg.voice.provider === 'elevenlabs') {
    const missing = requiredElevenLabsMissing(cfg);
    if (missing.length > 0) {
      log.error({ missing }, 'VOICE_PROVIDER=elevenlabs but config is incomplete; falling back to mock');
      return new MockVoiceProvider(bus, log);
    }
    log.info('voice provider: ElevenLabs (real outbound calls)');
    return new ElevenLabsVoiceProvider(cfg, bus, log);
  }
  log.info('voice provider: mock (simulated phone panel)');
  return new MockVoiceProvider(bus, log);
}

function requiredElevenLabsMissing(cfg: Config): string[] {
  const e = cfg.voice.elevenLabs;
  const required: Record<string, string> = {
    ELEVENLABS_API_KEY: e.apiKey,
    ELEVENLABS_AGENT_ID: e.agentId,
    ELEVENLABS_AGENT_PHONE_NUMBER_ID: e.agentPhoneNumberId,
    ON_CALL_PHONE_NUMBER: e.toNumber,
    PUBLIC_WEBHOOK_URL: e.publicWebhookUrl,
  };
  return Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}
