import type { Collector } from '../collector/index.js';
import type { Bus } from '../bus.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import type { CollectorSample, WakeSignal } from '../types.js';

interface Candidate {
  type: string;
  detail: string;
}

/**
 * Cheap, NON-AI gate. Runs on every collector sample and decides only *whether*
 * to wake the Analyzer — it never classifies or diagnoses. Debounced via an
 * `armed` latch so one outage produces exactly one analysis pass; it re-arms
 * only after a fully nominal sample (recovery).
 */
export class Watcher {
  private errConsec = 0;
  private p95Consec = 0;
  private armed = true;

  constructor(
    private readonly collector: Collector,
    private readonly bus: Bus,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {}

  attach(): void {
    this.bus.onSample((s) => this.evaluate(s));
  }

  /** Force the gate back to armed (used by "reset demo"). */
  rearm(): void {
    this.armed = true;
    this.errConsec = 0;
    this.p95Consec = 0;
  }

  private evaluate(s: CollectorSample): void {
    const w = this.cfg.watcher;
    const m = s.metric;
    const logs = this.collector.takeLogTriggers();

    // consecutive-sample counters always advance/reset
    this.errConsec = m.errorRate > w.errorRateThreshold ? this.errConsec + 1 : 0;
    this.p95Consec = m.p95LatencyMs > w.p95LatencyMsThreshold ? this.p95Consec + 1 : 0;

    const candidates: Candidate[] = [];
    if (!s.containerRunning) {
      candidates.push({ type: 'container_exit', detail: 'prod-app container is not running' });
    } else {
      if (!m.healthy)
        candidates.push({ type: 'health_failing', detail: '/health returned unhealthy/unreachable' });
      if (logs.severe > 0)
        candidates.push({
          type: 'error_logs',
          detail: `${logs.severe} new ERROR/FATAL log line(s) observed`,
        });
      if (this.errConsec >= w.consecutiveSamples)
        candidates.push({
          type: 'error_rate',
          detail: `errorRate ${m.errorRate} > ${w.errorRateThreshold} for ${this.errConsec} samples`,
        });
      if (this.p95Consec >= w.consecutiveSamples)
        candidates.push({
          type: 'high_latency',
          detail: `p95 ${m.p95LatencyMs}ms > ${w.p95LatencyMsThreshold}ms for ${this.p95Consec} samples`,
        });
      if (m.memoryMb > w.memoryMbThreshold)
        candidates.push({
          type: 'high_memory',
          detail: `memory ${m.memoryMb}MB > ${w.memoryMbThreshold}MB`,
        });
      if (w.wakeOnAnyErrorLine && logs.warn > 0)
        candidates.push({
          type: 'warn_logs',
          detail: `${logs.warn} WARN/ERROR line(s) (loose mode)`,
        });
    }

    const nominal = candidates.length === 0 && s.containerRunning && m.healthy;
    if (nominal && !this.armed) {
      this.armed = true;
      this.log.info('watcher re-armed (prod-app nominal)');
    }
    if (candidates.length === 0) return;

    const primary = candidates[0]!;
    const willWake = this.armed;
    this.bus.emitEvent({
      type: 'watcher',
      payload: { ts: new Date().toISOString(), reason: primary.detail, willWake },
    });

    if (!willWake) return; // debounced: outage already under analysis
    this.armed = false;

    const signal: WakeSignal = {
      trigger: {
        type: primary.type,
        detail: primary.detail,
        metricsSnapshot: {
          requestRate: m.requestRate,
          errorRate: m.errorRate,
          p95LatencyMs: m.p95LatencyMs,
          memoryMb: m.memoryMb,
        },
      },
      logWindow: this.collector.logWindow(),
      metricsHistory: this.collector.metricsHistory(),
    };
    this.log.warn({ trigger: signal.trigger }, 'WATCHER → waking Analyzer');
    this.bus.emitWake(signal);
  }
}
