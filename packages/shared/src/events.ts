import type { CallRequest } from './voice.js';
import type { Incident } from './incident.js';

/** A single metric sample polled from prod-app. */
export interface MetricSample {
  ts: string;
  requestRate: number;
  errorRate: number;
  p95LatencyMs: number;
  memoryMb: number;
  healthy: boolean;
}

/** A single streamed log line from prod-app. */
export interface LogLine {
  ts: string;
  stream: 'stdout' | 'stderr';
  line: string;
}

/**
 * The event union pushed over SSE from the coordinator to the dashboard.
 * `type` discriminates the payload. Everything the UI renders flows through here.
 */
export type SirenEvent =
  | { type: 'log'; payload: LogLine }
  | { type: 'metric'; payload: MetricSample }
  | { type: 'incident'; payload: Incident }
  | { type: 'call'; payload: CallRequest } // MockVoiceProvider "ring" -> phone panel
  | { type: 'confirm'; payload: { incidentId: string; message: string } } // "Siren says…"
  | { type: 'watcher'; payload: { ts: string; reason: string; willWake: boolean } }
  | { type: 'server'; payload: ServerStatus } // monitored target lifecycle (start/deploy/stop)
  | { type: 'reset'; payload: { ts: string } }; // "reset demo" — clear all client state

/** Lifecycle state of the monitored target container, driven from the dashboard. */
export interface ServerStatus {
  ts: string;
  state: 'stopped' | 'starting' | 'running' | 'stopping';
  release?: 'good' | 'broken'; // which build is currently deployed
  image?: string; // resolved image:tag
  detail?: string;
}

export type SirenEventType = SirenEvent['type'];
