import { useEffect, useRef } from 'react';
import type { LogLine } from '@siren/shared';

function levelClass(line: string): string {
  if (/\b(ERROR|FATAL)\b|exception|unhandled/i.test(line)) return 'text-bad';
  if (/\bWARN\b/.test(line)) return 'text-warn';
  return 'text-[#9fb0c0]';
}

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  return (
    <div className="bg-panel border border-edge rounded-xl p-3">
      <div className="font-bold text-accent mb-2">📜 Live logs · prod-app</div>
      <div className="h-[70vh] overflow-y-auto text-[12.5px] max-lg:h-[40vh]">
        {logs.length === 0 && <div className="text-muted">no logs yet…</div>}
        {logs.map((l, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words py-px border-b border-[#11161d] ${levelClass(l.line)}`}
          >
            {l.line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
