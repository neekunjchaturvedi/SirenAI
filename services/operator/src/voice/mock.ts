import type { CallRequest, VoiceProvider } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Logger } from '../logger.js';

/**
 * Default voice provider — no telephony. It drives the dashboard's simulated
 * phone panel entirely over SSE: placeCall() "rings" the panel; confirm() pushes
 * a "Siren says…" line. The full incident loop demos on this alone. The real
 * ElevenLabsVoiceProvider (Phase 7) implements the same interface.
 */
export class MockVoiceProvider implements VoiceProvider {
  constructor(
    private readonly bus: Bus,
    private readonly log: Logger,
  ) {}

  async placeCall(req: CallRequest): Promise<void> {
    this.log.info(
      { incidentId: req.incidentId, options: req.options.map((o) => o.key) },
      'mock voice: ringing on-call phone',
    );
    this.bus.emitEvent({ type: 'call', payload: req });
  }

  async confirm(incidentId: string, message: string): Promise<void> {
    this.log.info({ incidentId }, 'mock voice: confirm callback');
    this.bus.emitEvent({ type: 'confirm', payload: { incidentId, message } });
  }
}
