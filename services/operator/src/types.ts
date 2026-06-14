import type { MetricSample } from '@siren/shared';

/** Internal collector emission consumed by the watcher (adds liveness the SSE
 * MetricSample doesn't carry). */
export interface CollectorSample {
  metric: MetricSample;
  containerRunning: boolean;
}

/** Signal the watcher emits when it decides to wake the Analyzer. */
export interface WakeSignal {
  trigger: {
    type: string;
    detail: string;
    metricsSnapshot: Record<string, number>;
  };
  logWindow: string[];
  metricsHistory: Record<string, number>[];
}
