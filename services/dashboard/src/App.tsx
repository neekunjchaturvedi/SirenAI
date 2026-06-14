import { useEvents } from './useEvents.js';
import { postReset } from './api.js';
import { ServerControlPanel } from './components/ServerControlPanel.js';
import { MetricsStrip } from './components/MetricsStrip.js';
import { LogPanel } from './components/LogPanel.js';
import { IncidentCard } from './components/IncidentCard.js';
import { PhonePanel } from './components/PhonePanel.js';

export function App() {
  const s = useEvents();
  const active = s.activeId ? s.incidents[s.activeId] : undefined;

  return (
    <div className="max-w-[1600px] mx-auto p-3">
      <header className="flex items-baseline gap-4 px-2 pb-3">
        <div className="text-2xl font-extrabold tracking-wide">🚨 Siren</div>
        <div className="text-muted flex-1 max-lg:hidden">
          AI incident response — detect · diagnose · call · remediate · verify
        </div>
        <div className={s.connected ? 'text-ok' : 'text-bad'}>
          {s.connected ? '● connected' : '○ disconnected'}
        </div>
        <button
          className="bg-panel2 text-purple border border-purple rounded-md px-3 py-1.5 cursor-pointer hover:bg-purple/15 transition-colors"
          onClick={() => void postReset()}
        >
          ↺ Reset demo
        </button>
      </header>

      <MetricsStrip metrics={s.metrics} />
      <ServerControlPanel server={s.server} />

      <main className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.2fr_1fr] gap-2.5 items-start">
        <LogPanel logs={s.logs} />
        <IncidentCard incident={active} watcher={s.lastWatcher} />
        <PhonePanel call={s.call} phoneLog={s.phoneLog} />
      </main>
    </div>
  );
}
