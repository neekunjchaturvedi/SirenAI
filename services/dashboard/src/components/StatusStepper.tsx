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
  idle: 'bg-edge border-edge',
  done: 'bg-ok border-ok',
  active: 'bg-accent border-accent shadow-[0_0_0_4px_#58a6ff33] animate-pulse-dot',
};
const LABEL: Record<StepState, string> = {
  idle: 'text-muted',
  done: 'text-ok',
  active: 'text-accent font-bold',
};

export function StatusStepper({ status }: { status: IncidentStatus }) {
  const escalated = status === 'escalated';
  const activeIdx = escalated ? -1 : STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex items-center my-1 mb-3.5">
      {STEPS.map((s, i) => {
        const state: StepState = activeIdx < 0 ? 'idle' : i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'idle';
        return (
          <div key={s.status} className="flex items-center">
            <span className={`w-3.5 h-3.5 rounded-full border-2 ${DOT[state]}`} />
            <span className={`text-[11px] mx-1.5 whitespace-nowrap ${LABEL[state]}`}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <span className={`w-5 h-0.5 ${state === 'done' ? 'bg-ok' : 'bg-edge'}`} />
            )}
          </div>
        );
      })}
      {escalated && (
        <div className="flex items-center">
          <span className="w-3.5 h-3.5 rounded-full border-2 bg-bad border-bad" />
          <span className="text-[11px] mx-1.5 text-bad font-bold">Escalated</span>
        </div>
      )}
    </div>
  );
}
