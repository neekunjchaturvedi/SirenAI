import express, { type Request, type Response } from 'express';
import type { SirenEvent } from '@siren/shared';
import { voiceDecisionSchema } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Collector } from '../collector/index.js';
import type { Config } from '../config.js';
import type { Lifecycle } from '../lifecycle/index.js';
import type { Logger } from '../logger.js';
import { IncidentStore } from './store.js';

/**
 * The hub: the only thing the dashboard talks to. Owns the SSE fan-out, the
 * incident REST API, the "break it" fault proxy, and the voice-decision webhook.
 * The state machine (Phase 5/6) plugs in via `onDecision`.
 */
export class Coordinator {
  readonly store: IncidentStore;
  private readonly clients = new Set<Response>();
  private onDecision?: (incidentId: string, optionKey?: string, decision?: string) => void;
  private onReset?: () => void;
  private lifecycle?: Lifecycle;

  constructor(
    private readonly bus: Bus,
    private readonly collector: Collector,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {
    this.store = new IncidentStore(bus, log);
    this.bus.onEvent((e) => this.broadcast(e));
  }

  /** Registered by the state machine to receive validated voice decisions. */
  setDecisionHandler(fn: (incidentId: string, optionKey?: string, decision?: string) => void): void {
    this.onDecision = fn;
  }

  /** Registered by the entrypoint to cancel timers / re-arm the watcher on reset. */
  setResetHandler(fn: () => void): void {
    this.onReset = fn;
  }

  /** Registered by the entrypoint so the dashboard can drive the target server. */
  setLifecycle(lc: Lifecycle): void {
    this.lifecycle = lc;
  }

  private broadcast(e: SirenEvent): void {
    const frame = `data: ${JSON.stringify(e)}\n\n`;
    for (const res of this.clients) res.write(frame);
  }

  start(): void {
    const app = express();
    // parse JSON regardless of Content-Type — ElevenLabs server tools may omit it
    app.use(express.json({ type: () => true }));
    app.use((_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      next();
    });
    app.options('*', (_req, res) => res.sendStatus(204));

    app.get('/healthz', (_req, res) => res.json({ ok: true }));

    app.get('/events', (req, res) => this.handleEvents(req, res));

    app.get('/incidents', (_req, res) => res.json(this.store.list()));
    app.get('/incidents/:id', (req, res) => {
      const inc = this.store.get(req.params.id);
      if (!inc) return res.status(404).json({ error: 'not_found' });
      return res.json(inc);
    });

    // dashboard-driven target lifecycle
    app.post('/admin/server/start', (_req, res) => void this.handleServer('start', res));
    app.post('/admin/server/deploy', (req, res) => void this.handleDeploy(req, res));
    app.post('/admin/server/fault', (req, res) => void this.handleFault(req, res));
    app.post('/admin/server/stop', (_req, res) => void this.handleServer('stop', res));
    app.get('/admin/server', (_req, res) =>
      res.json(this.lifecycle?.state() ?? { ts: new Date().toISOString(), state: 'stopped' }),
    );

    app.post('/admin/reset', (_req, res) => void this.handleReset(res));
    app.post('/webhook/voice-decision', (req, res) => this.handleDecision(req, res));

    app.listen(this.cfg.operatorPort, () =>
      this.log.info({ port: this.cfg.operatorPort }, 'coordinator listening'),
    );
  }

  private handleEvents(_req: Request, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 2000\n\n');

    // replay current state so a late-joining dashboard renders immediately
    for (const m of this.collector.recentMetrics())
      res.write(`data: ${JSON.stringify({ type: 'metric', payload: m })}\n\n`);
    for (const l of this.collector.recentLogs())
      res.write(`data: ${JSON.stringify({ type: 'log', payload: l })}\n\n`);
    for (const inc of this.store.list().reverse())
      res.write(`data: ${JSON.stringify({ type: 'incident', payload: inc })}\n\n`);
    if (this.lifecycle)
      res.write(`data: ${JSON.stringify({ type: 'server', payload: this.lifecycle.state() })}\n\n`);

    this.clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    _req.on('close', () => {
      clearInterval(ping);
      this.clients.delete(res);
    });
  }

  private async handleServer(op: 'start' | 'stop', res: Response): Promise<void> {
    if (!this.lifecycle) {
      res.status(503).json({ error: 'lifecycle_not_ready' });
      return;
    }
    this.log.info({ op }, 'dashboard server control');
    try {
      const state = op === 'start' ? await this.lifecycle.start() : await this.lifecycle.stop();
      res.json(state);
    } catch (e) {
      res.status(500).json({ error: 'server_op_failed', detail: (e as Error).message });
    }
  }

  private async handleDeploy(req: Request, res: Response): Promise<void> {
    if (!this.lifecycle) {
      res.status(503).json({ error: 'lifecycle_not_ready' });
      return;
    }
    const kind = ((req.body?.kind as string) === 'health' ? 'health' : 'db') as 'db' | 'health';
    this.log.info({ kind }, 'dashboard deploy bad release');
    try {
      res.json(await this.lifecycle.deploy(kind));
    } catch (e) {
      res.status(500).json({ error: 'deploy_failed', detail: (e as Error).message });
    }
  }

  private async handleFault(req: Request, res: Response): Promise<void> {
    if (!this.lifecycle) {
      res.status(503).json({ error: 'lifecycle_not_ready' });
      return;
    }
    const type = ((req.body?.type as string) || 'memory') as 'memory';
    this.log.info({ type }, 'dashboard inject runtime fault');
    const r = await this.lifecycle.injectFault(type);
    res.status(r.ok ? 200 : 409).json(r);
  }

  private async handleReset(res: Response): Promise<void> {
    this.log.info('reset demo: stopping target, clearing incidents + buffers');
    this.onReset?.(); // cancel timers + re-arm watcher
    try {
      await this.lifecycle?.stop(); // tear the target down
    } catch (e) {
      this.log.warn({ err: (e as Error).message }, 'reset: could not stop target (continuing)');
    }
    this.store.clear();
    this.collector.clearBuffers();
    this.broadcast({ type: 'reset', payload: { ts: new Date().toISOString() } });
    res.json({ ok: true });
  }

  private handleDecision(req: Request, res: Response): void {
    // accept both our camelCase and the ElevenLabs server-tool snake_case;
    // coerce empty strings (the agent often sends option_key:"" when escalating) to undefined
    const b = (req.body ?? {}) as Record<string, unknown>;
    const clean = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
    const normalized = {
      incidentId: clean(b.incidentId) ?? clean(b.incident_id),
      optionKey: clean(b.optionKey) ?? clean(b.option_key),
      decision: clean(b.decision),
    };
    const parsed = voiceDecisionSchema.safeParse(normalized);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_decision', detail: parsed.error.flatten() });
      return;
    }
    const { incidentId, optionKey, decision } = parsed.data;
    if (!this.onDecision) {
      res.status(503).json({ error: 'decision_handler_not_ready' });
      return;
    }
    this.log.info({ incidentId, optionKey, decision }, 'voice decision received');
    this.onDecision(incidentId, optionKey, decision);
    res.json({ ok: true });
  }
}
