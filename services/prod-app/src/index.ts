import express, { type Request, type Response } from 'express';
import { config, whitelistedConfig } from './config.js';
import { log } from './logger.js';
import {
  FAULTS,
  type Fault,
  getFault,
  isHealthy,
  profile,
  recordRequest,
  setFault,
  snapshot,
  startSimulator,
} from './simulator.js';

const app = express();
app.use(express.json());

/** In-memory cache that `clear_cache` flushes. No Redis on purpose. */
const cache = new Map<string, unknown>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shared behavior for "business" endpoints: obey the current fault, then record. */
async function business(res: Response, ok: () => unknown): Promise<void> {
  const start = Date.now();
  const { errP, latMs } = profile();
  await sleep(latMs);
  const failed = Math.random() < errP;
  recordRequest(Date.now() - start, failed);
  if (failed) {
    res.status(500).json({ error: 'internal_error', fault: getFault() });
    return;
  }
  res.json(ok());
}

app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'prod-app', version: config.version, status: 'ok' });
});

app.get('/api/orders', async (_req: Request, res: Response) => {
  await business(res, () => {
    if (!cache.has('orders')) {
      cache.set('orders', [
        { id: 'o-1001', total: 42.0 },
        { id: 'o-1002', total: 8.5 },
      ]);
    }
    return { orders: cache.get('orders'), cached: true };
  });
});

app.get('/api/users', async (_req: Request, res: Response) => {
  await business(res, () => ({ users: [{ id: 'u-1', name: 'Ada' }, { id: 'u-2', name: 'Linus' }] }));
});

app.get('/health', (_req: Request, res: Response) => {
  const healthy = isHealthy();
  res.status(healthy ? 200 : 500).json({
    status: healthy ? 'healthy' : 'unhealthy',
    version: config.version,
    fault: getFault(),
  });
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.json(snapshot());
});

app.post('/admin/fault', (req: Request, res: Response) => {
  const fault = (req.body?.fault ?? null) as string | null;
  if (fault !== null && !FAULTS.includes(fault as Fault)) {
    res.status(400).json({ error: 'unknown_fault', allowed: FAULTS });
    return;
  }
  setFault(fault as Fault | null);
  log.info(`admin: fault set to ${fault ?? 'null (cleared)'}`);
  res.json({ ok: true, fault });
});

app.post('/admin/clear-cache', (_req: Request, res: Response) => {
  const cleared = cache.size;
  cache.clear();
  log.info(`admin: cache cleared (${cleared} entries)`);
  res.json({ ok: true, cleared });
});

startSimulator();
app.listen(config.port, () => {
  log.info(`prod-app v${config.version} listening on :${config.port}`);
  log.info(`config: ${JSON.stringify(whitelistedConfig())}`);
  if (config.featureFlags === 'broken') setFault('bad_config'); // boot into fault on bad config
});
