import { useEffect, useRef, useState } from 'react';
import type {
  CallRequest,
  Incident,
  LogLine,
  MetricSample,
  ServerStatus,
  SirenEvent,
} from '@siren/shared';
import { OPERATOR_URL } from './api.js';

export interface PhoneMessage {
  ts: string;
  text: string;
}

export interface DashboardState {
  connected: boolean;
  logs: LogLine[];
  metrics: MetricSample[];
  incidents: Record<string, Incident>;
  activeId?: string;
  call?: CallRequest; // active simulated call (mock voice)
  phoneLog: PhoneMessage[]; // Siren's spoken lines / confirmations
  lastWatcher?: { ts: string; reason: string; willWake: boolean };
  server?: ServerStatus; // monitored target lifecycle state
}

const TERMINAL = new Set(['resolved', 'escalated']);
const LOG_CAP = 200;
const METRIC_CAP = 60;

export function useEvents(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    connected: false,
    logs: [],
    metrics: [],
    incidents: {},
    phoneLog: [],
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${OPERATOR_URL}/events`);
    esRef.current = es;
    es.onopen = () => setState((s) => ({ ...s, connected: true }));
    es.onerror = () => setState((s) => ({ ...s, connected: false }));
    es.onmessage = (msg) => {
      let ev: SirenEvent;
      try {
        ev = JSON.parse(msg.data) as SirenEvent;
      } catch {
        return;
      }
      setState((s) => reduce(s, ev));
    };
    return () => es.close();
  }, []);

  return state;
}

function reduce(s: DashboardState, ev: SirenEvent): DashboardState {
  switch (ev.type) {
    case 'log':
      return { ...s, logs: [...s.logs, ev.payload].slice(-LOG_CAP) };
    case 'metric':
      return { ...s, metrics: [...s.metrics, ev.payload].slice(-METRIC_CAP) };
    case 'watcher':
      return { ...s, lastWatcher: ev.payload };
    case 'server':
      return { ...s, server: ev.payload };
    case 'incident': {
      const inc = ev.payload;
      const incidents = { ...s.incidents, [inc.id]: inc };
      const activeId = TERMINAL.has(inc.status)
        ? s.activeId === inc.id
          ? undefined
          : s.activeId
        : inc.id;
      // clear the live call once the incident leaves awaiting_decision
      const call = inc.id === s.call?.incidentId && inc.status !== 'awaiting_decision' ? undefined : s.call;
      return { ...s, incidents, activeId, call };
    }
    case 'call':
      return {
        ...s,
        call: ev.payload,
        phoneLog: [...s.phoneLog, { ts: new Date().toISOString(), text: ev.payload.spokenSummary }].slice(-30),
      };
    case 'confirm':
      return {
        ...s,
        phoneLog: [...s.phoneLog, { ts: new Date().toISOString(), text: ev.payload.message }].slice(-30),
      };
    case 'reset':
      return {
        connected: s.connected,
        logs: [],
        metrics: [],
        incidents: {},
        phoneLog: [],
        activeId: undefined,
        call: undefined,
        lastWatcher: undefined,
        server: undefined,
      };
    default:
      return s;
  }
}
