import { useEffect, useRef } from 'react';
import type { LogLine } from '@siren/shared';

function levelClass(line: string): string {
  if (/\b(ERROR|FATAL)\b|exception|unhandled/i.test(line)) return 'text-bad';
  if (/\bWARN\b/.test(line)) return 'text-warn';
  return 'text-muted';
}

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">Live logs</h2>
        <span className="text-faint text-xs">· siren-real-server</span>
      </div>
      <div className="h-[44vh] overflow-y-auto font-mono text-[12px] leading-relaxed max-lg:h-[40vh]">
        {logs.length === 0 && <div className="text-faint">no logs yet…</div>}
        {logs.map((l, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words py-1 border-b border-edge/60 last:border-0 ${levelClass(
              l.line,
            )}`}
          >
            {l.line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
