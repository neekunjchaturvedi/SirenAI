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
      className={`bg-panel border rounded-xl p-3 min-h-[70vh] ${
        ringing ? 'border-warn shadow-[0_0_0_1px_var(--color-warn),0_0_22px_-6px_var(--color-warn)]' : 'border-edge'
      }`}
    >
      <div className="font-bold text-accent mb-2">
        📱 On-call phone
        {ringing && <span className="text-bad ml-2 animate-blink">● LIVE</span>}
      </div>

      <div className="bg-panel2 border border-edge rounded-xl p-3.5 min-h-[220px]">
        {!ringing && (
          <div className="text-muted">Phone idle. Siren will call when an incident needs a decision.</div>
        )}

        {call && (
          <>
            <div className="text-warn font-bold mb-2">
              📞 Incoming call from <b>Siren</b>
            </div>
            <div className="text-[15px] my-2.5 mb-3.5 leading-relaxed">“{call.spokenSummary}”</div>
            <div className="flex flex-col gap-2">
              {call.options.map((o) => (
                <button
                  key={o.key}
                  className="text-left bg-panel2 border border-accent rounded-md px-3 py-1.5 cursor-pointer hover:bg-[#14304d] transition-colors"
                  onClick={() => choose(o.key)}
                >
                  {o.label}
                </button>
              ))}
              <button
                className="text-left bg-panel2 border border-bad text-bad rounded-md px-3 py-1.5 cursor-pointer hover:bg-bad/10 transition-colors"
                onClick={escalate}
              >
                🚨 Escalate to human
              </button>
            </div>
            <div className="flex gap-1.5 mt-3">
              <input
                className="flex-1 bg-bg text-ink border border-edge rounded-md px-2.5 py-1.5 outline-none focus:border-accent"
                placeholder='say something… (e.g. "roll it back")'
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitFree()}
              />
              <button
                className="bg-panel2 text-ink border border-edge rounded-md px-3 py-1.5 cursor-pointer hover:border-accent transition-colors"
                onClick={submitFree}
              >
                Speak
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 max-h-[28vh] overflow-y-auto text-[12.5px]">
        {phoneLog.map((m, i) => (
          <div key={i} className="py-0.5 border-b border-[#11161d]">
            <span className="text-muted">{new Date(m.ts).toLocaleTimeString()}</span> 🔊 {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
