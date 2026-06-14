import type { Incident, IncidentStatus, TimelineEntry } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Logger } from '../logger.js';

const TERMINAL: IncidentStatus[] = ['resolved', 'escalated'];

/**
 * In-memory incident store + state-machine helper. Single source of truth for
 * incident state; every mutation emits an `incident` SSE event and logs the
 * transition `{ incidentId, from, to }`.
 */
export class IncidentStore {
  private readonly map = new Map<string, Incident>();

  constructor(
    private readonly bus: Bus,
    private readonly log: Logger,
  ) {}

  list(): Incident[] {
    return [...this.map.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  get(id: string): Incident | undefined {
    return this.map.get(id);
  }

  /** The single active (non-terminal) incident, if any. */
  active(): Incident | undefined {
    return this.list().find((i) => !TERMINAL.includes(i.status));
  }

  create(incident: Incident): Incident {
    this.map.set(incident.id, incident);
    this.log.info({ incidentId: incident.id, to: incident.status }, 'incident created');
    this.bus.emitEvent({ type: 'incident', payload: incident });
    return incident;
  }

  /** Apply a partial patch and (optionally) record a timeline transition. */
  update(id: string, patch: Partial<Incident>, note?: string): Incident {
    const inc = this.map.get(id);
    if (!inc) throw new Error(`unknown incident ${id}`);
    const from = inc.status;
    const next: Incident = { ...inc, ...patch };
    if (patch.status && patch.status !== from) {
      const entry: TimelineEntry = {
        ts: new Date().toISOString(),
        status: patch.status,
        note: note ?? '',
      };
      next.timeline = [...inc.timeline, entry];
      this.log.info({ incidentId: id, from, to: patch.status, note }, 'incident transition');
    }
    this.map.set(id, next);
    this.bus.emitEvent({ type: 'incident', payload: next });
    return next;
  }

  isTerminal(status: IncidentStatus): boolean {
    return TERMINAL.includes(status);
  }

  /** Drop all incidents (used by "reset demo"). */
  clear(): void {
    this.map.clear();
  }
}
