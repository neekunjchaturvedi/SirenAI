import type { Diagnosis, LLMProvider } from '@siren/shared';
import { serializeCatalog } from '@siren/shared';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import type { WakeSignal } from '../types.js';

const LOG_WINDOW_MAX = 120; // bound prompt size / latency
const METRICS_MAX = 8;

/**
 * The AI agent (core feature). Given a watcher wake signal, asks the LLM to
 * read the bounded log window + metrics and return a catalog-only Diagnosis.
 * On any provider failure it returns a SAFE DEFAULT (restart + escalate) so the
 * loop never stalls.
 */
export class Analyzer {
  constructor(
    private readonly provider: LLMProvider,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {}

  async run(signal: WakeSignal): Promise<Diagnosis> {
    const input = {
      trigger: { type: signal.trigger.type, detail: signal.trigger.detail },
      logWindow: signal.logWindow.slice(-LOG_WINDOW_MAX),
      metricsHistory: signal.metricsHistory.slice(-METRICS_MAX),
      catalog: serializeCatalog(),
      deployNote: `The service was recently updated/redeployed (current image: ${this.cfg.prodApp.image}). The last known-good image tag is "v1". restart_service recreates the SAME image (so a bad release stays broken after a restart); rollback_image restores the known-good "v1" image. If the failure began right after a deploy and a restart would not help, prefer rollback_image.`,
    };
    const t0 = Date.now();
    try {
      const d = await this.provider.analyze(input);
      this.log.info(
        {
          ms: Date.now() - t0,
          model: this.cfg.llm.model,
          isIncident: d.isIncident,
          confidence: d.confidence,
          severity: d.severity,
          actions: d.proposedActions.map((a) => a.action),
        },
        'analyzer produced diagnosis',
      );
      return d;
    } catch (e) {
      this.log.error(
        { err: (e as Error).message, model: this.cfg.llm.model },
        'analyzer failed after repair; using safe default',
      );
      return safeDefault(signal);
    }
  }
}

function safeDefault(signal: WakeSignal): Diagnosis {
  return {
    isIncident: true,
    rootCauseHypothesis: `Analyzer LLM unavailable. Falling back on the watcher trigger: ${signal.trigger.detail}`,
    confidence: 'low',
    severity: 'high',
    proposedActions: [
      {
        action: 'restart_service',
        params: {},
        rationale: 'Restarting clears transient in-memory faults and is fully reversible.',
        reversible: true,
      },
      {
        action: 'rollback_image',
        params: { tag: 'v1' },
        rationale: 'If the fault came from a bad deploy, rolling back to the known-good image fixes it.',
        reversible: true,
      },
      {
        action: 'escalate_to_human',
        params: { reason: 'Automated analysis unavailable; needs human diagnosis.' },
        rationale: 'Escalate if neither a restart nor a rollback recovers the service.',
        reversible: false,
      },
    ],
  };
}
