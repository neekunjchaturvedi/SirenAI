import type { ServerStatus } from '@siren/shared';
import { postServer, postDeploy, postFault } from '../api.js';

const STATE_PILL: Record<string, string> = {
  stopped: 'bg-[#2a2f3a] text-muted',
  starting: 'bg-[#3a2d12] text-warn animate-pulse-dot',
  stopping: 'bg-[#3a2d12] text-warn animate-pulse-dot',
  'running-good': 'bg-[#122e1c] text-ok',
  'running-broken': 'bg-[#3a1414] text-bad animate-pulse-dot',
};

function pillKey(s?: ServerStatus): string {
  if (!s || s.state === 'stopped') return 'stopped';
  if (s.state === 'running') return s.release === 'broken' ? 'running-broken' : 'running-good';
  return s.state;
}

function label(s?: ServerStatus): string {
  if (!s || s.state === 'stopped') return '■ stopped';
  if (s.state === 'starting') return '… starting';
  if (s.state === 'stopping') return '… stopping';
  return s.release === 'broken' ? '● running (BAD release)' : '● running (healthy)';
}

export function ServerControlPanel({ server }: { server?: ServerStatus }) {
  const running = server?.state === 'running';
  const btn =
    'rounded-md px-3 py-1.5 cursor-pointer border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[13px]';
  return (
    <div className="bg-panel border border-edge rounded-xl p-3 mb-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-bold">🖥️ Server</span>
        <span className={`px-2.5 py-1 rounded-full text-[12.5px] font-bold ${STATE_PILL[pillKey(server)]}`}>
          {label(server)}
        </span>
        {server?.image && <code className="text-purple text-[12px]">{server.image}</code>}

        <div className="flex gap-2 flex-wrap ml-auto">
          <button
            className={`${btn} bg-panel2 text-ok border-[#1f5132] hover:bg-ok/15`}
            disabled={running}
            onClick={() => void postServer('start')}
          >
            ▶ Start server
          </button>
          <button
            className={`${btn} bg-panel2 text-bad border-[#5a1f1f] hover:bg-bad/15`}
            disabled={!server || server.state === 'stopped'}
            onClick={() => void postServer('stop')}
          >
            ⏹ Stop
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-edge">
        <span className="text-muted text-[12px] uppercase tracking-wide">Inject fault</span>
        <button
          className={`${btn} bg-panel2 text-warn border-[#5a4a1a] hover:bg-warn/15`}
          disabled={!running}
          onClick={() => void postDeploy('db')}
          title="Bad deploy: MONGODB_URI dropped → fixed by ROLLBACK"
        >
          🗄️ DB-config bug <span className="text-muted">· rollback</span>
        </button>
        <button
          className={`${btn} bg-panel2 text-warn border-[#5a4a1a] hover:bg-warn/15`}
          disabled={!running}
          onClick={() => void postDeploy('health')}
          title="Bad release: health/order-pipeline regression → fixed by ROLLBACK"
        >
          🩺 Health bug <span className="text-muted">· rollback</span>
        </button>
        <button
          className={`${btn} bg-panel2 text-purple border-purple hover:bg-purple/15`}
          disabled={!running}
          onClick={() => void postFault('memory')}
          title="Runtime memory leak / heap exhaustion → fixed by RESTART"
        >
          🧠 Memory leak <span className="text-muted">· restart</span>
        </button>
      </div>
    </div>
  );
}
