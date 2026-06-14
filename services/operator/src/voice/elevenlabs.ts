import type { CallRequest, VoiceProvider } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';

const OUTBOUND_CALL_URL = 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call';

/**
 * Real outbound phone calls via ElevenLabs Agents + Twilio. Same VoiceProvider
 * interface as the mock — flip VOICE_PROVIDER=elevenlabs and nothing else changes.
 *
 * The Analyzer has ALREADY produced the options; the voice agent only reads them
 * and captures a choice. We inject the per-incident script via a first_message /
 * prompt override and pass the options as dynamic variables. The agent's server
 * tool (configured in the ElevenLabs dashboard) POSTs the chosen option back to
 * PUBLIC_WEBHOOK_URL/webhook/voice-decision with the incident id.
 *
 * Every call/confirm is ALSO mirrored to the dashboard over SSE so the demo
 * screen shows what's happening on the phone.
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  constructor(
    private readonly cfg: Config,
    private readonly bus: Bus,
    private readonly log: Logger,
  ) {}

  async placeCall(req: CallRequest): Promise<void> {
    // mirror to the dashboard phone panel
    this.bus.emitEvent({ type: 'call', payload: req });

    const optionsSpoken = req.options
      .map((o, i) => `Option ${i + 1}: ${o.label}`)
      .join('. ');
    const firstMessage = `${req.spokenSummary} ${optionsSpoken}. You can also say escalate.`;

    const dynamicVariables: Record<string, string> = {
      incident_id: req.incidentId,
      spoken_summary: req.spokenSummary,
      options_spoken: optionsSpoken,
      webhook_url: `${this.cfg.voice.elevenLabs.publicWebhookUrl}/webhook/voice-decision`,
    };
    req.options.forEach((o, i) => {
      dynamicVariables[`option_${i + 1}`] = o.label;
      dynamicVariables[`option_${i + 1}_key`] = o.key;
    });

    await this.outboundCall(req.incidentId, firstMessage, dynamicVariables, 'call');
  }

  async confirm(incidentId: string, message: string): Promise<void> {
    // mirror to the dashboard
    this.bus.emitEvent({ type: 'confirm', payload: { incidentId, message } });
    // simplest reliable path: a short follow-up outbound call that just speaks the outcome
    await this.outboundCall(
      incidentId,
      message,
      { incident_id: incidentId, spoken_summary: message, options_spoken: '' },
      'confirm',
    );
  }

  private async outboundCall(
    incidentId: string,
    firstMessage: string,
    dynamicVariables: Record<string, string>,
    kind: 'call' | 'confirm',
  ): Promise<void> {
    const el = this.cfg.voice.elevenLabs;
    const body = {
      agent_id: el.agentId,
      agent_phone_number_id: el.agentPhoneNumberId,
      to_number: el.toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
        conversation_config_override: {
          agent: { first_message: firstMessage },
        },
      },
    };

    try {
      const res = await fetch(OUTBOUND_CALL_URL, {
        method: 'POST',
        headers: { 'xi-api-key': el.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        conversation_id?: string;
        callSid?: string;
      };
      if (!res.ok || json.success === false) {
        this.log.error(
          { incidentId, kind, status: res.status, detail: json.message },
          'ElevenLabs outbound call failed',
        );
        return;
      }
      this.log.info(
        { incidentId, kind, conversationId: json.conversation_id, callSid: json.callSid },
        'ElevenLabs outbound call placed',
      );
    } catch (e) {
      this.log.error({ incidentId, kind, err: (e as Error).message }, 'ElevenLabs call threw');
    }
  }
}
