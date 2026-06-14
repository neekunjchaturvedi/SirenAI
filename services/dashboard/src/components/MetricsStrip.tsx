import type { MetricSample } from '@siren/shared';

const LEVEL_TEXT: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

function Stat({
  label,
  value,
  unit,
  level,
}: {
  label: string;
  value: string;
  unit?: string;
  level: 'ok' | 'warn' | 'bad';
}) {
  return (
    <div className="flex-1 bg-panel border border-edge rounded-lg px-3 py-2">
      <div className="text-muted text-xs uppercase">{label}</div>
      <div className={`text-2xl font-bold ${LEVEL_TEXT[level]}`}>
        {value}
        {unit && <span className="text-[13px] text-muted ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

export function MetricsStrip({ metrics }: { metrics: MetricSample[] }) {
  const m = metrics[metrics.length - 1];
  if (!m) return <div className="text-muted mb-2.5">waiting for metrics…</div>;

  const errLevel = m.errorRate > 0.2 ? 'bad' : m.errorRate > 0.05 ? 'warn' : 'ok';
  const p95Level = m.p95LatencyMs > 1500 ? 'bad' : m.p95LatencyMs > 500 ? 'warn' : 'ok';
  const memLevel = m.memoryMb > 400 ? 'bad' : m.memoryMb > 250 ? 'warn' : 'ok';

  return (
    <div className="flex gap-2.5 mb-2.5">
      <Stat label="Health" value={m.healthy ? 'UP' : 'DOWN'} level={m.healthy ? 'ok' : 'bad'} />
      <Stat label="Req rate" value={m.requestRate.toFixed(1)} unit="/s" level="ok" />
      <Stat label="Error rate" value={(m.errorRate * 100).toFixed(1)} unit="%" level={errLevel} />
      <Stat label="p95" value={String(m.p95LatencyMs)} unit="ms" level={p95Level} />
      <Stat label="Memory" value={String(m.memoryMb)} unit="MB" level={memLevel} />
    </div>
  );
}
