import type Docker from 'dockerode';
import type { ServerStatus } from '@siren/shared';
import type { Bus } from '../bus.js';
import type { Collector } from '../collector/index.js';
import type { Watcher } from '../watcher/index.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';

export interface OpResult {
  ok: boolean;
  detail: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BOOT_GRACE_MS = 3500; // let the container bind /health before we judge it

/**
 * Owns the lifecycle of the monitored target container. The dashboard drives it
 * (Start = good build, Deploy update = broken build, Stop = remove); the executor
 * drives it too (restart = same image, rollback = good image, config patch).
 *
 * Centralising every container create here means the target always joins the
 * operator's docker network with the right alias — so `http://<container>:<port>`
 * resolves both for health polling and after a recreate. Monitoring is gated on
 * the container actually being up, so a stopped target never raises a false
 * incident.
 */
export class Lifecycle {
  private current: ServerStatus;
  private currentImage: string;
  private currentRelease: 'good' | 'broken';

  constructor(
    private readonly docker: Docker,
    private readonly collector: Collector,
    private readonly watcher: Watcher,
    private readonly bus: Bus,
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {
    this.current = { ts: new Date().toISOString(), state: 'stopped' };
    this.currentImage = cfg.prodApp.goodImage;
    this.currentRelease = 'good';
  }

  state(): ServerStatus {
    return this.current;
  }

  // ── dashboard controls ──────────────────────────────────────────────────────
  /** "Start server" — boot the known-good build. */
  async start(): Promise<ServerStatus> {
    await this.run(this.cfg.prodApp.goodImage, 'good', 'started known-good build');
    return this.current;
  }

  /** Ship a broken build. kind 'db' = missing MONGODB_URI, 'health' = release regression.
   * Both are baked faults → fixed by rollback. */
  async deploy(kind: 'db' | 'health' = 'db'): Promise<ServerStatus> {
    const image = kind === 'health' ? this.cfg.prodApp.badImageHealth : this.cfg.prodApp.badImageDb;
    const note = kind === 'health' ? 'deployed bad release (health regression)' : 'deployed bad release (DB config dropped)';
    await this.run(image, 'broken', note);
    return this.current;
  }

  /** Inject a RUNTIME fault into the running (good) server — cleared by a restart,
   * not a rollback. Does not recreate the container. */
  async injectFault(type: 'memory' = 'memory'): Promise<OpResult> {
    if (this.current.state !== 'running') {
      return { ok: false, detail: 'server is not running — start it first' };
    }
    try {
      const r = await fetch(`${this.cfg.prodApp.url}/__siren/fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const ok = r.ok;
      this.log.info({ type, ok }, 'runtime fault injected into target');
      this.setState({ detail: `injected runtime fault: ${type}` });
      return { ok, detail: ok ? `injected ${type} fault` : `inject failed (${r.status})` };
    } catch (e) {
      return { ok: false, detail: `inject failed: ${(e as Error).message}` };
    }
  }

  /** "Stop server" — tear the target down and stop monitoring. */
  async stop(): Promise<ServerStatus> {
    this.collector.setMonitoring(false);
    this.setState({ state: 'stopping' });
    await this.removeIfExists();
    this.setState({ state: 'stopped', release: undefined, image: undefined, detail: 'server stopped' });
    return this.current;
  }

  // ── executor-driven remediations ────────────────────────────────────────────
  /** restart_service: recreate from the SAME image (does not undo a bad release). */
  async restart(): Promise<OpResult> {
    return this.run(this.currentImage, this.currentRelease, 'restarted service (same image)');
  }

  /** rollback_image: recreate from the known-good image (the genuine fix). */
  async rollback(tag?: string): Promise<OpResult> {
    const requested = tag ? this.imageForTag(tag) : this.cfg.prodApp.goodImage;
    // fall back to the configured good image if the requested tag isn't present
    let image = requested;
    if (!(await this.imageExists(image))) image = this.cfg.prodApp.goodImage;
    return this.run(image, 'good', `rolled back to known-good image ${image}`);
  }

  /** apply_config_patch: recreate the current image with an env key patched. */
  async applyConfig(key: string, value: string): Promise<OpResult> {
    return this.run(this.currentImage, this.currentRelease, `applied config ${key}=${value}`, {
      [key]: value,
    });
  }

  // ── core ────────────────────────────────────────────────────────────────────
  private async run(
    image: string,
    release: 'good' | 'broken',
    note: string,
    envPatch?: Record<string, string>,
  ): Promise<OpResult> {
    this.collector.setMonitoring(false); // quiet the watcher while we recreate
    this.setState({ state: 'starting', release, image, detail: note });

    if (!(await this.imageExists(image))) {
      const detail = `image "${image}" not found locally — run scripts/build-real-images.sh first`;
      this.log.error({ image }, detail);
      this.setState({ state: 'stopped', detail });
      return { ok: false, detail };
    }

    try {
      await this.removeIfExists();
      await this.create(image, release, envPatch);
      this.currentImage = image;
      this.currentRelease = release;
      // give the new process a moment to bind /health before we start judging it,
      // so a healthy start doesn't trip the watcher on a mid-boot sample
      await sleep(BOOT_GRACE_MS);
      // enable monitoring FIRST, then attach logs — streamLogs() no-ops while
      // monitoring is off, so attaching before this would never stream.
      this.collector.setMonitoring(true);
      this.collector.attachLogs(); // (re)attach to the new container's log stream
      this.watcher.rearm();
      this.setState({ state: 'running', release, image, detail: note });
      this.log.info({ image, release }, 'target container running');
      return { ok: true, detail: note };
    } catch (e) {
      const detail = `failed to run ${image}: ${(e as Error).message}`;
      this.log.error({ err: detail }, 'lifecycle run failed');
      this.setState({ state: 'stopped', detail });
      return { ok: false, detail };
    }
  }

  private async create(
    image: string,
    release: 'good' | 'broken',
    envPatch?: Record<string, string>,
  ): Promise<void> {
    const { container, network, containerPort, hostPort, containerEnv } = this.cfg.prodApp;
    const portKey = `${containerPort}/tcp`;
    const env = { ...containerEnv, PORT: String(containerPort), ...(envPatch ?? {}) };
    const Env = Object.entries(env)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}=${v}`);

    const created = await this.docker.createContainer({
      name: container,
      Image: image,
      Env,
      Labels: { 'siren.role': 'real-server', 'siren.release': release },
      ExposedPorts: { [portKey]: {} },
      HostConfig: {
        NetworkMode: network,
        PortBindings: { [portKey]: [{ HostPort: hostPort }] },
        RestartPolicy: { Name: 'no' },
      },
      NetworkingConfig: {
        EndpointsConfig: { [network]: { Aliases: [container] } },
      },
    });
    await created.start();
  }

  private async removeIfExists(): Promise<void> {
    const c = this.docker.getContainer(this.cfg.prodApp.container);
    try {
      await c.inspect();
    } catch {
      return; // doesn't exist
    }
    try {
      await c.stop({ t: 2 });
    } catch {
      /* may already be stopped */
    }
    await c.remove({ force: true });
  }

  private async imageExists(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  private imageForTag(tag: string): string {
    if (tag.includes(':')) return tag;
    const repo = this.cfg.prodApp.goodImage.split(':')[0];
    return `${repo}:${tag}`;
  }

  private setState(patch: Partial<ServerStatus>): void {
    this.current = { ...this.current, ...patch, ts: new Date().toISOString() };
    this.bus.emitEvent({ type: 'server', payload: this.current });
  }
}
