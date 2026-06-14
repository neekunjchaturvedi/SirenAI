export const OPERATOR_URL =
  (import.meta.env.VITE_OPERATOR_URL as string | undefined) ?? 'http://localhost:4000';

export async function postServer(op: 'start' | 'stop'): Promise<void> {
  await fetch(`${OPERATOR_URL}/admin/server/${op}`, { method: 'POST' });
}

export async function postDeploy(kind: 'db' | 'health'): Promise<void> {
  await fetch(`${OPERATOR_URL}/admin/server/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  });
}

export async function postFault(type: 'memory'): Promise<void> {
  await fetch(`${OPERATOR_URL}/admin/server/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
}

export async function postReset(): Promise<void> {
  await fetch(`${OPERATOR_URL}/admin/reset`, { method: 'POST' });
}

export async function postDecision(body: {
  incidentId: string;
  optionKey?: string;
  decision?: 'escalate' | 'none';
}): Promise<void> {
  await fetch(`${OPERATOR_URL}/webhook/voice-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
