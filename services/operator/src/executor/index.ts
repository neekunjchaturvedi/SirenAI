import type { Incident, ProposedAction } from '@siren/shared';
import type { Config } from '../config.js';
import type { Lifecycle } from '../lifecycle/index.js';
import type { Logger } from '../logger.js';

export interface ExecutionResult {
  ok: boolean;
  detail: string;
}

/**
 * Executes catalog actions against the monitored target. All container ops go
 * through the Lifecycle (so networking/aliases stay correct). It REFUSES any
 * action not present in the incident's approved options — a hard safety gate.
 */
export class Executor {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {}

  async execute(incident: Incident, action: ProposedAction): Promise<ExecutionResult> {
    const approved = incident.diagnosis?.proposedActions.some((a) => a.action === action.action);
    if (!approved) {
      throw new Error(`executor refused "${action.action}": not in incident's approved options`);
    }
    this.log.info(
      { incidentId: incident.id, action: action.action, params: action.params },
      'executing action',
    );

    switch (action.action) {
      case 'restart_service':
        return this.lifecycle.restart();
      case 'rollback_image':
        return this.lifecycle.rollback(action.params.tag ? String(action.params.tag) : undefined);
      case 'apply_config_patch':
        return this.lifecycle.applyConfig(String(action.params.key), String(action.params.value));
      case 'clear_cache':
        return this.clearCache();
      case 'scale_replicas': {
        const count = Number(action.params.count);
        return {
          ok: true,
          detail: `requested ${count} replicas (single-node demo: recorded, no load balancer)`,
        };
      }
      case 'escalate_to_human':
        return { ok: true, detail: `escalated to secondary on-call: ${String(action.params.reason ?? '')}` };
      default:
        return { ok: false, detail: `unknown action "${action.action}"` };
    }
  }

  private async clearCache(): Promise<ExecutionResult> {
    try {
      const r = await fetch(`${this.cfg.prodApp.url}/admin/clear-cache`, { method: 'POST' });
      const body = (await r.json().catch(() => ({}))) as { cleared?: number };
      return { ok: r.ok, detail: `cache cleared (${body.cleared ?? '?'} entries)` };
    } catch (e) {
      return { ok: false, detail: `clear-cache failed: ${(e as Error).message}` };
    }
  }
}
