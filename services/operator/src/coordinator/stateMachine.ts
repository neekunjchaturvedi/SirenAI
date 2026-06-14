import type { CallRequest, Incident, ProposedAction, VoiceProvider } from '@siren/shared';
import type { Analyzer } from '../analyzer/index.js';
import type { Bus } from '../bus.js';
import type { Collector } from '../collector/index.js';
import type { Config } from '../config.js';
import type { Executor } from '../executor/index.js';
import type { Logger } from '../logger.js';
import type { WakeSignal } from '../types.js';
import type { IncidentStore } from './store.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let seq = 0;
function newIncidentId(): string {
  seq += 1;
  return `INC-${Date.now().toString(36).slice(-4)}-${seq}`;
}

/**
 * Drives the full incident lifecycle:
 *   watcher wake → analyzing → awaiting_decision (voice call) → executing →
 *   verifying → resolved | re-offer remaining options | escalated.
 * Human-in-the-loop: nothing executes without a voice decision for THIS incident.
 */
export class StateMachine {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly store: IncidentStore,
    private readonly analyzer: Analyzer,
    private readonly executor: Executor,
    private readonly voice: VoiceProvider,
    private readonly collector: Collector,
    private readonly bus: Bus,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {}

  attach(): void {
    this.bus.onWake((s) => void this.onWake(s));
  }

  /** Cancel all pending decision timers (used by "reset demo"). */
  reset(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  // ─── detection → analysis ──────────────────────────────────────────────────
  private async onWake(signal: WakeSignal): Promise<void> {
    const active = this.store.active();
    if (active) {
      this.log.info({ activeId: active.id }, 'wake ignored: an incident is already active');
      return;
    }

    const id = newIncidentId();
    const now = new Date().toISOString();
    this.store.create({
      id,
      status: 'analyzing',
      detectedAt: now,
      trigger: signal.trigger,
      logWindow: signal.logWindow.slice(-120),
      attemptedActions: [],
      timeline: [{ ts: now, status: 'analyzing', note: signal.trigger.detail }],
    });

    const diagnosis = await this.analyzer.run(signal);
    if (!diagnosis.isIncident) {
      this.store.update(id, { diagnosis, status: 'resolved' }, 'Analyzer judged this a false alarm; discarding');
      return;
    }

    this.store.update(id, { diagnosis }, `Root cause: ${diagnosis.rootCauseHypothesis}`);
    await this.offer(id);
  }

  // ─── awaiting_decision: place/re-place the voice call ───────────────────────
  private async offer(id: string): Promise<void> {
    const inc = this.store.get(id);
    if (!inc?.diagnosis) return;
    const options = this.remainingOptions(inc);
    if (options.length === 0) {
      await this.escalate(id, 'no remaining remediation options');
      return;
    }

    this.store.update(id, { status: 'awaiting_decision' }, `Offering ${options.length} option(s) to on-call`);
    const req = buildCall(inc, options);
    await this.voice.placeCall(req);

    this.armTimeout(id);
  }

  private armTimeout(id: string): void {
    this.clearTimer(id);
    this.timers.set(
      id,
      setTimeout(() => {
        this.log.warn({ incidentId: id }, 'decision timeout — escalating');
        void this.escalate(id, 'no answer from on-call within timeout');
      }, this.cfg.decisionTimeoutMs),
    );
  }

  private clearTimer(id: string): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  // ─── voice decision → execute ───────────────────────────────────────────────
  onDecision(incidentId: string, optionKey?: string, decision?: string): void {
    const inc = this.store.get(incidentId);
    if (!inc) {
      this.log.warn({ incidentId }, 'decision for unknown incident');
      return;
    }
    if (inc.status !== 'awaiting_decision') {
      this.log.warn({ incidentId, status: inc.status }, 'decision ignored: not awaiting a decision');
      return;
    }
    this.clearTimer(incidentId);

    if (decision === 'escalate') {
      void this.escalate(incidentId, 'on-call engineer chose to escalate');
      return;
    }

    const action = this.matchOption(inc, optionKey ?? '');
    if (!action) {
      this.log.warn({ incidentId, optionKey }, 'no matching option; re-offering');
      void this.offer(incidentId); // re-arm; engineer can try again
      return;
    }
    void this.runAction(incidentId, action);
  }

  private async runAction(id: string, action: ProposedAction): Promise<void> {
    if (action.action === 'escalate_to_human') {
      await this.escalate(id, String(action.params.reason ?? 'engineer selected escalate'));
      return;
    }

    let inc = this.store.get(id)!;
    this.store.update(id, { status: 'executing', chosenAction: action }, `Engineer chose ${action.action}`);

    let result: { ok: boolean; detail: string };
    try {
      result = await this.executor.execute(inc, action);
    } catch (e) {
      result = { ok: false, detail: (e as Error).message };
    }

    inc = this.store.get(id)!;
    const attemptedActions = [...inc.attemptedActions, action.action];
    this.store.update(id, { executionResult: result, attemptedActions, status: 'verifying' }, result.detail);

    // ─── verify ───────────────────────────────────────────────────────────────
    const verification = await this.verify();
    this.store.update(id, { verification });

    if (verification.healthy) {
      this.store.update(id, { status: 'resolved' }, 'prod-app healthy again');
      await this.voice.confirm(id, `Good news — ${spoken(action)} worked. prod-app is healthy again. Incident ${id} resolved.`);
      return;
    }

    // not recovered: re-offer remaining options, or escalate
    const remaining = this.remainingOptions(this.store.get(id)!);
    if (remaining.length === 0) {
      await this.escalate(id, 'no remaining options after the attempted fix did not recover the service');
      return;
    }
    await this.voice.confirm(id, `That didn't work — ${spoken(action)} did not recover prod-app. Calling you back with the remaining options.`);
    await this.offer(id);
  }

  private async escalate(id: string, reason: string): Promise<void> {
    this.clearTimer(id);
    const inc = this.store.get(id);
    if (!inc || this.store.isTerminal(inc.status)) return;
    this.store.update(id, { status: 'escalated' }, `Escalated: ${reason}`);
    await this.voice.confirm(id, `I couldn't safely resolve incident ${id}. Escalating to the secondary on-call. Reason: ${reason}.`);
  }

  private async verify(): Promise<{ healthy: boolean; metricsAfter: Record<string, number> }> {
    await sleep(this.cfg.verifyWindowMs);
    const recent = this.collector.recentMetrics().slice(-3);
    const w = this.cfg.watcher;
    const healthy =
      recent.length > 0 &&
      recent.every(
        (m) =>
          m.healthy &&
          m.errorRate < w.errorRateThreshold &&
          m.p95LatencyMs < w.p95LatencyMsThreshold &&
          m.memoryMb < w.memoryMbThreshold,
      );
    const last = recent[recent.length - 1];
    const metricsAfter: Record<string, number> = last
      ? { requestRate: last.requestRate, errorRate: last.errorRate, p95LatencyMs: last.p95LatencyMs, memoryMb: last.memoryMb }
      : {};
    return { healthy, metricsAfter };
  }

  private remainingOptions(inc: Incident): ProposedAction[] {
    return (inc.diagnosis?.proposedActions ?? []).filter((a) => !inc.attemptedActions.includes(a.action));
  }

  /** Map an exact key or a spoken phrase to one of the incident's remaining options. */
  private matchOption(inc: Incident, key: string): ProposedAction | undefined {
    const options = this.remainingOptions(inc);
    const k = key.trim().toLowerCase();
    const exact = options.find((a) => a.action.toLowerCase() === k);
    if (exact) return exact;

    // positional refs the voice agent may send: "option_3_key", "option 3", "3"
    if (/^(option[_\s]*)?\d+(_key)?$/.test(k)) {
      const n = Number(k.match(/\d+/)![0]);
      const byPos = options[n - 1];
      if (byPos) return byPos;
    }
    const keyword: Record<string, string> = {
      restart: 'restart_service',
      'roll back': 'rollback_image',
      rollback: 'rollback_image',
      'roll it back': 'rollback_image',
      revert: 'rollback_image',
      cache: 'clear_cache',
      scale: 'scale_replicas',
      replica: 'scale_replicas',
      config: 'apply_config_patch',
      patch: 'apply_config_patch',
    };
    for (const [phrase, actionName] of Object.entries(keyword)) {
      if (k.includes(phrase)) {
        const m = options.find((a) => a.action === actionName);
        if (m) return m;
      }
    }
    return undefined;
  }
}

// ─── voice formatting helpers ─────────────────────────────────────────────────
function buildCall(inc: Incident, options: ProposedAction[]): CallRequest {
  const conf = inc.diagnosis?.confidence ?? 'low';
  return {
    incidentId: inc.id,
    spokenSummary: `This is Siren about incident ${inc.id} on prod-app. ${inc.diagnosis?.rootCauseHypothesis ?? ''} I'm ${conf}-confidence. I have ${options.length} option${options.length > 1 ? 's' : ''} — which should I run?`,
    options: options.map((a) => ({ key: a.action, label: spoken(a) })),
  };
}

function spoken(a: ProposedAction): string {
  switch (a.action) {
    case 'restart_service':
      return 'restart the service';
    case 'rollback_image':
      return `roll back to "${String(a.params.tag ?? 'stable')}"`;
    case 'scale_replicas':
      return `scale to ${String(a.params.count ?? '?')} replicas`;
    case 'clear_cache':
      return 'clear the cache';
    case 'apply_config_patch':
      return `patch config ${String(a.params.key ?? '')}=${String(a.params.value ?? '')}`;
    case 'escalate_to_human':
      return 'escalate to a human';
    default:
      return a.action;
  }
}
