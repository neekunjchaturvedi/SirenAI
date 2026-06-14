import type { MetricSample } from '@siren/shared';

const LEVEL: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

function Stat({
  label,
  value,
  unit,
  level = 'neutral',
}: {
  label: string;
  value: string;
  unit?: string;
  level?: 'ok' | 'warn' | 'bad' | 'neutral';
}) {
  return (
    <div className="flex-1 bg-panel border border-edge rounded-xl px-4 py-3">
      <div className="text-faint text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div
        className={`text-[22px] font-semibold tracking-tight mt-0.5 ${
          level === 'neutral' ? 'text-ink' : LEVEL[level]
        }`}
      >
        {value}
        {unit && <span className="text-[13px] text-faint font-normal ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

export function MetricsStrip({ metrics }: { metrics: MetricSample[] }) {
  const m = metrics[metrics.length - 1];
  if (!m) {
    return (
      <div className="bg-panel border border-edge rounded-xl px-4 py-3 mb-3 text-faint text-sm">
        waiting for metrics…
      </div>
    );
  }

  const errLevel = m.errorRate > 0.2 ? 'bad' : m.errorRate > 0.05 ? 'warn' : 'ok';
  const p95Level = m.p95LatencyMs > 1500 ? 'bad' : m.p95LatencyMs > 500 ? 'warn' : 'ok';
  const memLevel = m.memoryMb > 400 ? 'bad' : m.memoryMb > 250 ? 'warn' : 'ok';

  return (
    <div className="flex gap-3 mb-3 max-md:flex-wrap">
      <Stat label="Health" value={m.healthy ? 'UP' : 'DOWN'} level={m.healthy ? 'ok' : 'bad'} />
      <Stat label="Req rate" value={m.requestRate.toFixed(1)} unit="/s" />
      <Stat label="Error rate" value={(m.errorRate * 100).toFixed(1)} unit="%" level={errLevel} />
      <Stat label="p95" value={String(m.p95LatencyMs)} unit="ms" level={p95Level} />
      <Stat label="Memory" value={String(m.memoryMb)} unit="MB" level={memLevel} />
    </div>
  );
}
