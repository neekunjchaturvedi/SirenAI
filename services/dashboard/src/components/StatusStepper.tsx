import type { IncidentStatus } from '@siren/shared';

const STEPS: { status: IncidentStatus; label: string }[] = [
  { status: 'analyzing', label: 'Analyze' },
  { status: 'awaiting_decision', label: 'Call' },
  { status: 'executing', label: 'Execute' },
  { status: 'verifying', label: 'Verify' },
  { status: 'resolved', label: 'Resolve' },
];

type StepState = 'idle' | 'done' | 'active';

const DOT: Record<StepState, string> = {
  idle: 'bg-panel border-edge',
  done: 'bg-ok border-ok',
  active: 'bg-ink border-ink ring-2 ring-ink/20 animate-pulse-dot',
};
const LABEL: Record<StepState, string> = {
  idle: 'text-faint',
  done: 'text-ok',
  active: 'text-ink font-semibold',
};

export function StatusStepper({ status }: { status: IncidentStatus }) {
  const escalated = status === 'escalated';
  const activeIdx = escalated ? -1 : STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex items-center mt-3 mb-1">
      {STEPS.map((s, i) => {
        const state: StepState =
          activeIdx < 0 ? 'idle' : i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'idle';
        return (
          <div key={s.status} className="flex items-center">
            <span className={`w-2.5 h-2.5 rounded-full border ${DOT[state]}`} />
            <span className={`text-[11px] mx-1.5 whitespace-nowrap ${LABEL[state]}`}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <span className={`w-4 h-px ${state === 'done' ? 'bg-ok' : 'bg-edge'}`} />
            )}
          </div>
        );
      })}
      {escalated && (
        <div className="flex items-center">
          <span className="w-2.5 h-2.5 rounded-full border bg-bad border-bad" />
          <span className="text-[11px] mx-1.5 text-bad font-semibold">Escalated</span>
        </div>
      )}
    </div>
  );
}
