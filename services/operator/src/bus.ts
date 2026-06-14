import { EventEmitter } from 'node:events';
import type { SirenEvent } from '@siren/shared';
import type { CollectorSample, WakeSignal } from './types.js';

/**
 * In-memory pub/sub hub for the whole operator. Three channels:
 *  - `event`  : SirenEvent fan-out to the dashboard SSE stream
 *  - `sample` : collector → watcher metric/liveness samples
 *  - `wake`   : watcher → analyzer "investigate this" signal
 */
export class Bus extends EventEmitter {
  emitEvent(e: SirenEvent): void {
    this.emit('event', e);
  }
  onEvent(fn: (e: SirenEvent) => void): void {
    this.on('event', fn);
  }

  emitSample(s: CollectorSample): void {
    this.emit('sample', s);
  }
  onSample(fn: (s: CollectorSample) => void): void {
    this.on('sample', fn);
  }

  emitWake(w: WakeSignal): void {
    this.emit('wake', w);
  }
  onWake(fn: (w: WakeSignal) => void): void {
    this.on('wake', fn);
  }
}
