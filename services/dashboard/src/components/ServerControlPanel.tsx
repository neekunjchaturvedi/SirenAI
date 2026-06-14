import type { ServerStatus } from '@siren/shared';
import { postServer, postDeploy, postFault } from '../api.js';

const STATE_PILL: Record<string, string> = {
  stopped: 'bg-panel2 text-muted border-edge',
  starting: 'bg-warn/10 text-warn border-warn/30 animate-pulse-dot',
  stopping: 'bg-warn/10 text-warn border-warn/30 animate-pulse-dot',
  'running-good': 'bg-ok/10 text-ok border-ok/30',
  'running-broken': 'bg-bad/10 text-bad border-bad/30 animate-pulse-dot',
};

function pillKey(s?: ServerStatus): string {
  if (!s || s.state === 'stopped') return 'stopped';
  if (s.state === 'running') return s.release === 'broken' ? 'running-broken' : 'running-good';
  return s.state;
}

function label(s?: ServerStatus): string {
  if (!s || s.state === 'stopped') return 'stopped';
  if (s.state === 'starting') return 'starting…';
  if (s.state === 'stopping') return 'stopping…';
  return s.release === 'broken' ? 'running · bad release' : 'running · healthy';
}

const pill = 'inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium';
const ghost =
  'rounded-lg px-3 py-1.5 text-[13px] cursor-pointer border border-edge bg-panel text-ink transition-colors hover:bg-panel2 disabled:opacity-40 disabled:cursor-not-allowed';

function FaultBtn({
  onClick,
  disabled,
  title,
  name,
  fix,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  name: string;
  fix: string;
  tone: 'amber' | 'green';
}) {
  const dot = tone === 'green' ? 'bg-ok' : 'bg-warn';
  return (
    <button className={ghost} disabled={disabled} title={title} onClick={onClick}>
      <span className="inline-flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {name}
        <span className="text-faint">· {fix}</span>
      </span>
    </button>
  );
}

export function ServerControlPanel({ server }: { server?: ServerStatus }) {
  const running = server?.state === 'running';
  return (
    <div className="bg-panel border border-edge rounded-2xl px-4 py-3.5 mb-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold">Server</h2>
        <span className={`${pill} ${STATE_PILL[pillKey(server)]}`}>{label(server)}</span>
        {server?.image && <code className="text-faint text-xs font-mono">{server.image}</code>}

        <div className="flex gap-2 ml-auto">
          <button
            className="rounded-lg px-3.5 py-1.5 text-[13px] cursor-pointer bg-ink text-onink transition-colors hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={running}
            onClick={() => void postServer('start')}
          >
            Start server
          </button>
          <button
            className={ghost}
            disabled={!server || server.state === 'stopped'}
            onClick={() => void postServer('stop')}
          >
            Stop
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3.5 pt-3.5 border-t border-edge">
        <span className="text-faint text-[11px] font-medium uppercase tracking-wide mr-1">
          Inject fault
        </span>
        <FaultBtn
          name="DB-config bug"
          fix="rollback"
          tone="amber"
          disabled={!running}
          title="Bad deploy: MONGODB_URI dropped → fixed by rollback"
          onClick={() => void postDeploy('db')}
        />
        <FaultBtn
          name="Health bug"
          fix="rollback"
          tone="amber"
          disabled={!running}
          title="Bad release: health / order-pipeline regression → fixed by rollback"
          onClick={() => void postDeploy('health')}
        />
        <FaultBtn
          name="Memory leak"
          fix="restart"
          tone="green"
          disabled={!running}
          title="Runtime heap exhaustion → fixed by restart"
          onClick={() => void postFault('memory')}
        />
      </div>
    </div>
  );
}
