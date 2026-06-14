import { PassThrough } from 'node:stream';
import type Docker from 'dockerode';
import type { LogLine, MetricSample } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';

const SEVERE = /\b(ERROR|FATAL)\b|exception|unhandled|uncaught|out ?of ?memory/i;
const WARN_OR_ERR = /\b(WARN|ERROR|FATAL)\b|exception|unhandled|uncaught/i;

/**
 * Observes the monitored target from the OUTSIDE: streams its container logs via
 * the Docker API and probes /health. The real server exposes no /metrics, so we
 * synthesise a MetricSample from the health probe (latency + healthy) and the
 * rate of ERROR log lines.
 *
 * Monitoring is GATED: until the dashboard starts the target (via Lifecycle), the
 * collector stays idle and emits nothing, so a stopped server never trips the
 * watcher. It survives the target crashing — it lives in its own container.
 */
export class Collector {
  private readonly logBuf: LogLine[] = [];
  private readonly metricBuf: MetricSample[] = [];
  private severeDelta = 0; // consumed by the watcher each sample
  private warnDelta = 0;
  private severeTotal = 0; // monotonic, used to synthesise errorRate
  private lastSevereTotal = 0;
  private monitoring = false;
  private logStream?: NodeJS.ReadableStream;

  constructor(
    private readonly docker: Docker,
    private readonly bus: Bus,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {}

  start(): void {
    void this.pollLoop();
  }

  /** Turn observation on/off (driven by the Lifecycle on start/stop). */
  setMonitoring(on: boolean): void {
    this.monitoring = on;
    this.log.info({ monitoring: on }, 'collector monitoring toggled');
  }

  /** (Re)attach to the target container's log stream after a (re)create. */
  attachLogs(): void {
    try {
      (this.logStream as { destroy?: () => void } | undefined)?.destroy?.();
    } catch {
      /* ignore */
    }
    this.logStream = undefined;
    void this.streamLogs();
  }

  /** Last N raw log lines handed to the Analyzer. */
  logWindow(): string[] {
    return this.logBuf.map((l) => l.line);
  }

  recentLogs(): LogLine[] {
    return [...this.logBuf];
  }
  recentMetrics(): MetricSample[] {
    return [...this.metricBuf];
  }

  clearBuffers(): void {
    this.logBuf.length = 0;
    this.metricBuf.length = 0;
    this.severeDelta = 0;
    this.warnDelta = 0;
    this.severeTotal = 0;
    this.lastSevereTotal = 0;
  }

  metricsHistory(): Record<string, number>[] {
    return this.metricBuf.map((m) => ({
      requestRate: m.requestRate,
      errorRate: m.errorRate,
      p95LatencyMs: m.p95LatencyMs,
      memoryMb: m.memoryMb,
    }));
  }

  /** Count of severe / any-warn log lines seen since the last call; resets. */
  takeLogTriggers(): { severe: number; warn: number } {
    const out = { severe: this.severeDelta, warn: this.warnDelta };
    this.severeDelta = 0;
    this.warnDelta = 0;
    return out;
  }

  private ingest(stream: 'stdout' | 'stderr', chunk: string): void {
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (line.length === 0) continue;
      const entry: LogLine = { ts: new Date().toISOString(), stream, line };
      this.logBuf.push(entry);
      if (this.logBuf.length > this.cfg.buffers.logLines) this.logBuf.shift();
      if (SEVERE.test(line)) {
        this.severeDelta++;
        this.severeTotal++;
      }
      if (WARN_OR_ERR.test(line)) this.warnDelta++;
      this.bus.emitEvent({ type: 'log', payload: entry });
    }
  }

  private async streamLogs(): Promise<void> {
    if (!this.monitoring) return; // don't chase a stopped target
    try {
      const container = this.docker.getContainer(this.cfg.prodApp.container);
      const stream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 20,
        timestamps: false,
      })) as unknown as NodeJS.ReadableStream;
      this.logStream = stream;

      const out = new PassThrough();
      const err = new PassThrough();
      out.on('data', (b: Buffer) => this.ingest('stdout', b.toString('utf8')));
      err.on('data', (b: Buffer) => this.ingest('stderr', b.toString('utf8')));
      container.modem.demuxStream(stream, out, err);

      stream.on('end', () => {
        if (!this.monitoring) return;
        this.log.warn('target log stream ended (container restarted?); will reattach');
        setTimeout(() => void this.streamLogs(), 1500);
      });
      stream.on('error', (e: Error) => this.log.warn({ err: e.message }, 'log stream error'));
    } catch (e) {
      if (!this.monitoring) return;
      this.log.warn(
        { err: (e as Error).message, container: this.cfg.prodApp.container },
        'cannot attach to target logs (not running yet?); retrying',
      );
      setTimeout(() => void this.streamLogs(), 1500);
    }
  }

  private async pollLoop(): Promise<void> {
    for (;;) {
      if (this.monitoring) await this.pollOnce();
      await new Promise((r) => setTimeout(r, this.cfg.pollIntervalMs));
    }
  }

  private async pollOnce(): Promise<void> {
    const containerRunning = await this.isContainerRunning();

    // probe /health; measure round-trip as a stand-in for latency
    const t0 = Date.now();
    let healthy = false;
    try {
      const r = await fetch(`${this.cfg.prodApp.url}${this.cfg.prodApp.healthPath}`, {
        signal: AbortSignal.timeout(1500),
      });
      healthy = r.ok;
    } catch {
      healthy = false;
    }
    const probeMs = Date.now() - t0;

    // synthesise errorRate from the rate of new ERROR/FATAL log lines
    const newErrors = this.severeTotal - this.lastSevereTotal;
    this.lastSevereTotal = this.severeTotal;
    const errorRate = Math.min(1, newErrors / 3);

    const metric: MetricSample = {
      ts: new Date().toISOString(),
      requestRate: 0,
      errorRate: Number(errorRate.toFixed(2)),
      p95LatencyMs: probeMs,
      memoryMb: 0,
      healthy: healthy && containerRunning,
    };

    this.metricBuf.push(metric);
    if (this.metricBuf.length > this.cfg.buffers.metricSamples) this.metricBuf.shift();
    this.bus.emitEvent({ type: 'metric', payload: metric });
    this.bus.emitSample({ metric, containerRunning });
  }

  private async isContainerRunning(): Promise<boolean> {
    try {
      const info = await this.docker.getContainer(this.cfg.prodApp.container).inspect();
      return info.State.Running === true;
    } catch {
      return false;
    }
  }
}
