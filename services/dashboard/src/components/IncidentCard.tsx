import type { ReactNode } from 'react';
import type { Incident, IncidentStatus } from '@siren/shared';
import { StatusStepper } from './StatusStepper.js';

const STATUS_LABEL: Record<IncidentStatus, string> = {
  analyzing: 'Analyzing',
  awaiting_decision: 'Calling on-call',
  executing: 'Executing',
  verifying: 'Verifying',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

// minimal pills: token-tinted bg + saturated text + hairline border (theme-aware)
const BADGE: Record<IncidentStatus, string> = {
  analyzing: 'bg-warn/10 text-warn border-warn/30 animate-pulse-dot',
  awaiting_decision: 'bg-warn/10 text-warn border-warn/30 animate-pulse-dot',
  executing: 'bg-panel2 text-muted border-edge animate-pulse-dot',
  verifying: 'bg-panel2 text-muted border-edge animate-pulse-dot',
  resolved: 'bg-ok/10 text-ok border-ok/30',
  escalated: 'bg-bad/10 text-bad border-bad/30',
};

const CONF: Record<'low' | 'medium' | 'high', string> = {
  high: 'bg-ok/10 text-ok border-ok/30',
  medium: 'bg-warn/10 text-warn border-warn/30',
  low: 'bg-panel2 text-muted border-edge',
};

const SEVERITY: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-panel2 text-muted border-edge',
  medium: 'bg-warn/10 text-warn border-warn/30',
  high: 'bg-hi/10 text-hi border-hi/30',
  critical: 'bg-bad/10 text-bad border-bad/30 animate-pulse-dot',
};

const DOT: Record<IncidentStatus, string> = {
  analyzing: 'bg-warn',
  awaiting_decision: 'bg-warn',
  executing: 'bg-faint',
  verifying: 'bg-faint',
  resolved: 'bg-ok',
  escalated: 'bg-bad',
};

const FLASH: Partial<Record<IncidentStatus, string>> = {
  analyzing: 'animate-cardflash',
  awaiting_decision: 'animate-cardflash',
  executing: 'animate-cardflash',
  verifying: 'animate-cardflash',
};

const pill = 'inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium';

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mt-4">
    <div className="text-faint text-[11px] font-medium uppercase tracking-wide mb-1.5">{label}</div>
    {children}
  </div>
);

export function IncidentCard({
  incident,
  watcher,
}: {
  incident?: Incident;
  watcher?: { ts: string; reason: string; willWake: boolean };
}) {
  if (!incident) {
    return (
      <div className="bg-panel border border-edge rounded-2xl p-5 min-h-[70vh] shadow-sm">
        <h2 className="text-sm font-semibold mb-4">Incident</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-ok" />
          <span className="text-lg font-medium">System nominal</span>
        </div>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          No active incident. <span className="text-ink font-medium">Start server</span>, then inject
          a fault to trigger one.
        </p>
        {watcher && (
          <div className="mt-4 text-faint text-xs">
            Watcher: <em>{watcher.reason}</em> —{' '}
            {watcher.willWake ? 'waking analyzer' : 'suppressed (debounced)'}
          </div>
        )}
      </div>
    );
  }

  const d = incident.diagnosis;
  return (
    <div className={`bg-panel border border-edge rounded-2xl p-5 min-h-[70vh] shadow-sm ${FLASH[incident.status] ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Incident</h2>
        <code className="text-faint text-xs font-mono">{incident.id}</code>
      </div>

      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`${pill} ${BADGE[incident.status]}`}>{STATUS_LABEL[incident.status]}</span>
        {d && (
          <span
            className={`${pill} uppercase tracking-wide ${SEVERITY[d.severity]}`}
            title="Severity rated by the Analyzer (Sarvam-M)"
          >
            {d.severity}
          </span>
        )}
      </div>

      <StatusStepper status={incident.status} />

      <Section label="Trigger">
        <div className="text-sm">
          <code className="font-mono text-xs bg-panel2 border border-edge rounded px-1.5 py-0.5">
            {incident.trigger.type}
          </code>{' '}
          <span className="text-muted">{incident.trigger.detail}</span>
        </div>
      </Section>

      {d && (
        <>
          <Section label="Root cause">
            <div className="flex items-start gap-2">
              <span className={`${pill} ${CONF[d.confidence]} shrink-0`}>{d.confidence}</span>
              <span className="text-sm leading-relaxed">{d.rootCauseHypothesis}</span>
            </div>
          </Section>
          <Section label="Proposed actions">
            <ol className="flex flex-col gap-2">
              {d.proposedActions.map((a, i) => {
                const tried = incident.attemptedActions.includes(a.action);
                return (
                  <li
                    key={i}
                    className={`border border-edge rounded-lg px-3 py-2 ${tried ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-faint text-xs">{i + 1}</span>
                      <code className={`font-mono text-[13px] ${tried ? 'line-through' : 'text-ink'}`}>
                        {a.action}
                      </code>
                      {Object.keys(a.params).length > 0 && (
                        <span className="text-faint text-xs">{JSON.stringify(a.params)}</span>
                      )}
                    </div>
                    <div className="text-muted text-xs mt-1 leading-relaxed">{a.rationale}</div>
                  </li>
                );
              })}
            </ol>
          </Section>
        </>
      )}

      {incident.executionResult && (
        <Section label="Execution">
          <div className={`text-sm ${incident.executionResult.ok ? 'text-ok' : 'text-bad'}`}>
            {incident.executionResult.detail}
          </div>
        </Section>
      )}

      <Section label="Timeline">
        <ul className="flex flex-col gap-1">
          {incident.timeline.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-faint text-[11px] font-mono w-[58px] shrink-0">
                {new Date(t.ts).toLocaleTimeString()}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[t.status]}`} />
              <span className="font-medium">{STATUS_LABEL[t.status]}</span>
              {t.note && <span className="text-muted text-xs truncate">— {t.note}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
