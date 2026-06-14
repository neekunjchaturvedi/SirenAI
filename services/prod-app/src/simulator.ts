import { log } from './logger.js';

/** Fault types injectable via POST /admin/fault. `null` clears. */
export type Fault = 'error_spike' | 'latency' | 'memory_leak' | 'crash' | 'bad_config';
export const FAULTS: Fault[] = ['error_spike', 'latency', 'memory_leak', 'crash', 'bad_config'];

export interface Metrics {
  requestRate: number; // req/s over the rolling window
  errorRate: number; // 0..1
  p95LatencyMs: number;
  memoryMb: number;
}

interface ReqEvent {
  ts: number;
  latencyMs: number;
  error: boolean;
}

const WINDOW_MS = 10_000;
const MEMORY_FAIL_MB = 350; // memory_leak flips health unhealthy past this

let currentFault: Fault | null = null;
const events: ReqEvent[] = [];
const leakBuffers: Buffer[] = [];
let leakedMb = 0;

const rand = (n: number) => Math.floor(Math.random() * n);

function prune(): void {
  const cut = Date.now() - WINDOW_MS;
  while (events.length > 0 && events[0]!.ts < cut) events.shift();
}

function record(latencyMs: number, error: boolean): void {
  events.push({ ts: Date.now(), latencyMs, error });
}

/** Per-fault probabilities/latencies used by both simulated traffic and real endpoints. */
export function profile(): { errP: number; latMs: number } {
  switch (currentFault) {
    case 'error_spike':
      return { errP: 0.55, latMs: 50 + rand(40) };
    case 'latency':
      return { errP: 0.03, latMs: 1800 + rand(1200) };
    case 'memory_leak':
      return { errP: leakedMb >= MEMORY_FAIL_MB ? 0.3 : 0.03, latMs: 70 + rand(50) };
    case 'bad_config':
      return { errP: 0.7, latMs: 50 + rand(40) };
    default:
      return { errP: 0.01, latMs: 40 + rand(30) };
  }
}

/** Record a real (or simulated) request outcome into the metrics window. */
export function recordRequest(latencyMs: number, error: boolean): void {
  record(latencyMs, error);
}

export function snapshot(): Metrics {
  prune();
  const n = events.length;
  const errs = events.reduce((a, e) => a + (e.error ? 1 : 0), 0);
  const lat = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const p95 = lat.length > 0 ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))]! : 0;
  const rssMb = Math.round(process.memoryUsage().rss / 1e6);
  return {
    requestRate: Number((n / (WINDOW_MS / 1000)).toFixed(1)),
    errorRate: n > 0 ? Number((errs / n).toFixed(3)) : 0,
    p95LatencyMs: Math.round(p95),
    memoryMb: rssMb,
  };
}

export function isHealthy(): boolean {
  if (currentFault === 'bad_config') return false;
  if (currentFault === 'memory_leak' && leakedMb >= MEMORY_FAIL_MB) return false;
  return true;
}

export function getFault(): Fault | null {
  return currentFault;
}

export function setFault(fault: Fault | null): void {
  const prev = currentFault;
  currentFault = fault;
  if (fault === null) {
    leakBuffers.length = 0;
    leakedMb = 0;
    log.info(`fault cleared (was ${prev ?? 'none'}); service returning to nominal`);
    return;
  }
  announce(fault);
  if (fault === 'crash') scheduleCrash();
}

function announce(fault: Fault): void {
  switch (fault) {
    case 'error_spike':
      log.error('OrderService: downstream PaymentAPI returned 503 Service Unavailable');
      log.error('checkout handler: unhandled rejection processing order — retries exhausted');
      break;
    case 'latency':
      log.warn('DBPool: connection pool exhausted (10/10 in use), new queries queued');
      log.warn('OrderService: query getOrders took 2310ms (threshold 500ms)');
      break;
    case 'memory_leak':
      log.warn('CacheLayer: entry count growing unbounded, eviction not keeping up');
      break;
    case 'bad_config':
      log.fatal("Config: FEATURE_FLAGS='broken' is not a recognized value — request handling disabled");
      break;
    case 'crash':
      log.fatal('Runtime: unrecoverable error in worker loop, process will terminate');
      break;
  }
}

function scheduleCrash(): void {
  log.fatal('process exiting in 1500ms (fault=crash) — operator should detect container exit');
  setTimeout(() => process.exit(1), 1500);
}

/** Per-tick log noise while faulted, so the Analyzer always has fresh lines. */
function emitFaultLogs(): void {
  switch (currentFault) {
    case 'error_spike':
      if (Math.random() < 0.8)
        log.error(`OrderService: HTTP 500 returned to client (errId=${rand(99999)})`);
      break;
    case 'latency':
      if (Math.random() < 0.6)
        log.warn(`DBPool: slow query detected ${1800 + rand(1200)}ms`);
      break;
    case 'memory_leak':
      log.warn(`heap usage high: ${Math.round(process.memoryUsage().rss / 1e6)}MB rss`);
      break;
    case 'bad_config':
      if (Math.random() < 0.7)
        log.error('request rejected: service in failed-config state (HTTP 500)');
      break;
    default:
      break;
  }
}

function growMemory(): void {
  if (currentFault !== 'memory_leak') return;
  if (leakedMb >= 480) return;
  leakBuffers.push(Buffer.alloc(20 * 1024 * 1024, 1)); // 20MB, kept referenced => leaked
  leakedMb += 20;
  if (leakedMb === MEMORY_FAIL_MB || (leakedMb > MEMORY_FAIL_MB && leakedMb - 20 < MEMORY_FAIL_MB)) {
    log.fatal(`OutOfMemory risk: leaked ${leakedMb}MB, health checks now failing`);
  }
}

/** Background generators: synthetic traffic (so metrics are lively) + fault noise. */
export function startSimulator(): void {
  setInterval(() => {
    const { errP, latMs } = profile();
    for (let i = 0; i < 10; i++) record(latMs, Math.random() < errP); // ~20 req/s baseline
  }, 500);

  setInterval(() => {
    emitFaultLogs();
    growMemory();
  }, 1000);
}
