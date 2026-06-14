import type { Express, Request, Response } from "express";

/**
 * Siren demo instrumentation for the real e-commerce server.
 *
 * Three fault kinds the dashboard can trigger:
 *
 *   db      (baked into image v2-db)     -> MONGODB_URI dropped from the deploy.
 *                                           /health 503. Fixed by ROLLBACK (v1 has the URI).
 *   health  (baked into image v2-health) -> bad release: order pipeline regression.
 *                                           /health 503. Fixed by ROLLBACK (v1 is the good code).
 *   memory  (injected at RUNTIME on v1)  -> heap exhaustion / event-loop stall.
 *                                           /health 503. Fixed by RESTART (fresh process clears
 *                                           in-memory state; the image itself is fine).
 *
 * Baked faults travel with the image (ARG SIREN_FAULT -> ENV), so an image
 * rollback is their fix. The runtime fault lives only in memory, so recreating
 * the SAME image (a restart) clears it — which is why restart vs rollback is a
 * real decision for the Analyzer.
 */

export type FaultKind = "none" | "db" | "health" | "memory";

const BAKED_FAULT = (process.env.SIREN_FAULT ?? "none") as FaultKind; // per-image
export const DB_URI = (process.env.MONGODB_URI ?? "").trim();

// runtime (in-memory) fault — injectable via POST /__siren/fault, cleared on restart
let runtimeFault: FaultKind = "none";

/** Runtime fault wins; otherwise the fault baked into this image. */
function activeFault(): FaultKind {
  return runtimeFault !== "none" ? runtimeFault : BAKED_FAULT;
}

function uriHost(uri: string): string {
  const m = uri.match(/@([^/?]+)|:\/\/([^/?]+)/);
  return (m && (m[1] || m[2])) || "unknown";
}

const ERRORS: Record<Exclude<FaultKind, "none">, string[]> = {
  db: [
    "ERROR [db] MongooseError: cannot connect — MONGODB_URI is undefined (missing from deploy config)",
    "ERROR [startup] Database connection unavailable: required env MONGODB_URI is not set",
    "ERROR [orders] Failed to load orders: database connection not initialized",
    "ERROR [auth] Login failed: cannot reach user store (no database connection)",
  ],
  health: [
    "ERROR [order-worker] Unhandled exception finalizing order batch: TypeError: Cannot read properties of undefined (reading 'price')",
    "ERROR [checkout] Failed to compute cart total: TypeError: items.reduce is not a function",
    "ERROR [health] readiness probe FAILING: order pipeline degraded after deploy",
    "ERROR [payments] reconcile job aborted: cannot read property 'amount' of undefined",
  ],
  memory: [
    "WARN  [mem] heap usage 96% — 1904MB/1980MB old space not reclaimed",
    "ERROR [mem] FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
    "ERROR [eventloop] event loop blocked for 5200ms under memory pressure; requests timing out",
    "WARN  [gc] major GC pause 1850ms; leaked listeners accumulating in cache",
  ],
};

const HEALTH_REASON: Record<Exclude<FaultKind, "none">, string> = {
  db: "MONGODB_URI is not configured (missing from this deploy)",
  health: "order pipeline degraded after latest deploy",
  memory: "heap exhausted / event loop stalled (service unresponsive)",
};

let tick = 0;

export function installSiren(app: Express): void {
  app.get("/health", (_req: Request, res: Response) => {
    const f = activeFault();
    if (f !== "none") {
      return res.status(503).json({
        status: "degraded",
        fault: f,
        reason: HEALTH_REASON[f],
      });
    }
    return res
      .status(200)
      .json({ status: "ok", db: DB_URI ? "connected" : "n/a", dbHost: DB_URI ? uriHost(DB_URI) : null });
  });

  app.get("/__siren/status", (_req: Request, res: Response) => {
    res.json({ bakedFault: BAKED_FAULT, runtimeFault, activeFault: activeFault(), healthy: activeFault() === "none" });
  });

  // Runtime fault injection (the dashboard's restartable "memory leak" button).
  // Cleared automatically by a restart because it lives only in this process.
  app.post("/__siren/fault", (req: Request, res: Response) => {
    const type = String((req.body && req.body.type) || "memory") as FaultKind;
    runtimeFault = ["none", "db", "health", "memory"].includes(type) ? type : "memory";
    console.error(`[siren] runtime fault injected: ${runtimeFault}`);
    res.json({ ok: true, runtimeFault });
  });

  console.log(
    `[siren] instrumentation active — baked fault=${BAKED_FAULT}${DB_URI ? ` db=${uriHost(DB_URI)}` : ""}`
  );

  // Background self-check: surface the active fault as ERROR logs (streamed to the
  // dashboard); otherwise a quiet heartbeat.
  const selfCheck = () => {
    tick += 1;
    const f = activeFault();
    if (f !== "none") {
      console.error(ERRORS[f][tick % ERRORS[f].length]);
    } else if (tick % 5 === 0) {
      console.log(`[siren] heartbeat ok t=${tick}`);
    }
  };
  if (activeFault() !== "none") selfCheck();
  setInterval(selfCheck, 2500);
}
