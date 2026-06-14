import { useState } from 'react';
import type { CallRequest } from '@siren/shared';
import { postDecision } from '../api.js';
import type { PhoneMessage } from '../useEvents.js';

export function PhonePanel({ call, phoneLog }: { call?: CallRequest; phoneLog: PhoneMessage[] }) {
  const [freeText, setFreeText] = useState('');
  const ringing = Boolean(call);

  const choose = (optionKey: string) => {
    if (call) void postDecision({ incidentId: call.incidentId, optionKey });
  };
  const escalate = () => {
    if (call) void postDecision({ incidentId: call.incidentId, decision: 'escalate' });
  };
  const submitFree = () => {
    if (!call || !freeText.trim()) return;
    void postDecision({ incidentId: call.incidentId, optionKey: freeText.trim() });
    setFreeText('');
  };

  return (
    <div
      className={`bg-panel border rounded-2xl p-5 shadow-sm transition-shadow ${
        ringing ? 'border-warn/50 ring-2 ring-warn/30' : 'border-edge'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">On-call phone</h2>
        {ringing && (
          <span className="inline-flex items-center gap-1.5 text-bad text-xs font-medium animate-blink">
            <span className="w-1.5 h-1.5 rounded-full bg-bad" /> LIVE
          </span>
        )}
      </div>

      <div className="bg-panel2 border border-edge rounded-xl p-4 min-h-[210px]">
        {!ringing && (
          <div className="text-faint text-sm">
            Phone idle. Siren calls when an incident needs a decision.
          </div>
        )}

        {call && (
          <>
            <div className="text-muted text-xs font-medium uppercase tracking-wide mb-2">
              Incoming call from Siren
            </div>
            <div className="text-[15px] leading-relaxed mb-4">“{call.spokenSummary}”</div>
            <div className="flex flex-col gap-2">
              {call.options.map((o) => (
                <button
                  key={o.key}
                  className="text-left bg-panel border border-edge rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-ink/30 hover:bg-panel2 transition-colors"
                  onClick={() => choose(o.key)}
                >
                  {o.label}
                </button>
              ))}
              <button
                className="text-left bg-panel border border-bad/30 text-bad rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-bad/10 transition-colors"
                onClick={escalate}
              >
                Escalate to human
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 bg-panel text-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink/40 placeholder:text-faint"
                placeholder='say something… (e.g. "roll it back")'
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitFree()}
              />
              <button
                className="bg-ink text-onink rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-ink/90 transition-colors"
                onClick={submitFree}
              >
                Speak
              </button>
            </div>
          </>
        )}
      </div>

      {phoneLog.length > 0 && (
        <div className="mt-4">
          <div className="text-faint text-[11px] font-medium uppercase tracking-wide mb-1.5">
            Transcript
          </div>
          <div className="max-h-[28vh] overflow-y-auto flex flex-col gap-1.5">
            {phoneLog.map((m, i) => (
              <div key={i} className="text-sm leading-relaxed">
                <span className="text-faint text-[11px] font-mono mr-2">
                  {new Date(m.ts).toLocaleTimeString()}
                </span>
                <span className="text-muted">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
