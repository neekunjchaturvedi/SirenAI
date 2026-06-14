import type { ReactNode } from 'react';
import type { Incident, IncidentStatus } from '@siren/shared';
import { StatusStepper } from './StatusStepper.js';

const STATUS_LABEL: Record<IncidentStatus, string> = {
  analyzing: '🧠 Analyzing',
  awaiting_decision: '📞 Calling on-call',
  executing: '⚙️ Executing',
  verifying: '🔍 Verifying',
  resolved: '✅ Resolved',
  escalated: '🚨 Escalated',
};

const BADGE: Record<IncidentStatus, string> = {
  analyzing: 'bg-[#1f2d4d] text-accent animate-pulse-dot',
  awaiting_decision: 'bg-[#3a2d12] text-warn animate-pulse-dot',
  executing: 'bg-[#2d1f4d] text-purple animate-pulse-dot',
  verifying: 'bg-[#14304d] text-accent animate-pulse-dot',
  resolved: 'bg-[#122e1c] text-ok',
  escalated: 'bg-[#3a1414] text-bad',
};

const CONF: Record<'low' | 'medium' | 'high', string> = {
  high: 'bg-[#122e1c] text-ok',
  medium: 'bg-[#3a2d12] text-warn',
  low: 'bg-[#3a1414] text-bad',
};

const SEVERITY: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-[#1f2d4d] text-accent',
  medium: 'bg-[#3a2d12] text-warn',
  high: 'bg-[#4d2d12] text-[#ff9d4d]',
  critical: 'bg-[#3a1414] text-bad animate-pulse-dot',
};

const DOT: Record<IncidentStatus, string> = {
  analyzing: 'bg-accent',
  awaiting_decision: 'bg-warn',
  executing: 'bg-purple',
  verifying: 'bg-accent',
  resolved: 'bg-ok',
  escalated: 'bg-bad',
};

const FLASH: Partial<Record<IncidentStatus, string>> = {
  analyzing: 'animate-cardflash',
  awaiting_decision: 'animate-cardflash',
  executing: 'animate-cardflash',
  verifying: 'animate-cardflash',
};

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="my-2.5">
    <div className="text-muted text-xs uppercase mb-1">{label}</div>
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
      <div className="bg-panel border border-edge rounded-xl p-3 min-h-[70vh]">
        <div className="font-bold text-accent mb-2">🩺 Incident</div>
        <div className="text-2xl text-ok my-2">System nominal</div>
        <div className="text-muted">
          No active incident. <strong>Start server</strong>, then <strong>Deploy update</strong> to ship the bad
          release and trigger an incident.
        </div>
        {watcher && (
          <div className="mt-3.5 text-muted text-[12.5px]">
            Watcher: <em>{watcher.reason}</em> — {watcher.willWake ? 'waking analyzer' : 'suppressed (debounced)'}
          </div>
        )}
      </div>
    );
  }

  const d = incident.diagnosis;
  return (
    <div className={`bg-panel border border-edge rounded-xl p-3 min-h-[70vh] ${FLASH[incident.status] ?? ''}`}>
      <div className="font-bold text-accent mb-2">🩺 Incident {incident.id}</div>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className={`inline-block px-3 py-1.5 rounded-full font-bold ${BADGE[incident.status]}`}>
          {STATUS_LABEL[incident.status]}
        </span>
        {d && (
          <span
            className={`inline-block px-3 py-1.5 rounded-full font-bold uppercase text-[12px] tracking-wide ${SEVERITY[d.severity]}`}
            title="Severity rated by the Analyzer (Sarvam-M)"
          >
            ⚠ {d.severity}
          </span>
        )}
      </div>
      <StatusStepper status={incident.status} />

      <Section label="Trigger">
        <div>
          <code className="text-purple">{incident.trigger.type}</code> — {incident.trigger.detail}
        </div>
      </Section>

      {d && (
        <>
          <Section label="Root cause hypothesis">
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full mr-2 ${CONF[d.confidence]}`}>
              {d.confidence}
            </span>
            <span>{d.rootCauseHypothesis}</span>
          </Section>
          <Section label="Proposed actions">
            <ol className="m-0 pl-5 list-decimal">
              {d.proposedActions.map((a, i) => (
                <li key={i} className={`mb-2 ${incident.attemptedActions.includes(a.action) ? 'opacity-45 line-through' : ''}`}>
                  <code className="text-purple">{a.action}</code>
                  {Object.keys(a.params).length > 0 && (
                    <span className="text-muted"> {JSON.stringify(a.params)}</span>
                  )}
                  <div className="text-muted text-[12.5px]">{a.rationale}</div>
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}

      {incident.executionResult && (
        <Section label="Execution">
          <div className={incident.executionResult.ok ? 'text-ok' : 'text-bad'}>
            {incident.executionResult.detail}
          </div>
        </Section>
      )}

      <Section label="Timeline">
        <ul className="list-none m-0 p-0">
          {incident.timeline.map((t, i) => (
            <li key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-muted text-[11px] w-20">{new Date(t.ts).toLocaleTimeString()}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${DOT[t.status]}`} />
              <span>{STATUS_LABEL[t.status]}</span>
              {t.note && <span className="text-muted">— {t.note}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
