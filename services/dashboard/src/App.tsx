import { useEvents } from './useEvents.js';
import { useTheme } from './useTheme.js';
import { postReset } from './api.js';
import { ServerControlPanel } from './components/ServerControlPanel.js';
import { MetricsStrip } from './components/MetricsStrip.js';
import { LogPanel } from './components/LogPanel.js';
import { IncidentCard } from './components/IncidentCard.js';
import { PhonePanel } from './components/PhonePanel.js';

export function App() {
  const s = useEvents();
  const { theme, toggle } = useTheme();
  const active = s.activeId ? s.incidents[s.activeId] : undefined;

  return (
    <div className="max-w-[1600px] mx-auto px-5 py-5">
      <header className="flex items-center gap-3 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-bad" />
          <span className="text-xl font-semibold tracking-tight">Siren</span>
        </div>
        <span className="text-faint text-sm max-md:hidden">
          detect · diagnose · call · remediate · verify
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              s.connected ? 'text-muted' : 'text-bad'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.connected ? 'bg-ok' : 'bg-bad'}`} />
            {s.connected ? 'connected' : 'disconnected'}
          </span>
          <button
            className="text-sm text-muted border border-edge rounded-lg w-9 h-9 grid place-items-center cursor-pointer hover:bg-panel2 hover:text-ink transition-colors"
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="text-sm text-muted border border-edge rounded-lg px-3 py-1.5 cursor-pointer hover:bg-panel2 hover:text-ink transition-colors"
            onClick={() => void postReset()}
          >
            Reset
          </button>
        </div>
      </header>

      <MetricsStrip metrics={s.metrics} />
      <ServerControlPanel server={s.server} />

      {/* Incident-focused: large incident on the left, phone + logs as a right rail */}
      <main className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <IncidentCard incident={active} watcher={s.lastWatcher} />
        <div className="flex flex-col gap-4">
          <PhonePanel call={s.call} phoneLog={s.phoneLog} />
          <LogPanel logs={s.logs} />
        </div>
      </main>
    </div>
  );
}
