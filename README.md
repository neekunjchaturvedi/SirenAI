# 🚨 Siren

**An AI incident-response system that closes the loop.** Siren watches a live
production service, uses an **AI agent to read its logs and diagnose failures**,
**phones the on-call engineer**, takes their spoken decision, executes a bounded
remediation, verifies the fix, and **calls back to confirm**.

---

## Two distinct AI roles (kept strictly separate)

1. **Analyzer Agent — the brain.** An LLM that reads recent logs + metrics,
   decides whether there's a real incident, hypothesizes the root cause, and
   proposes 2–3 fixes chosen **only** from a bounded action catalog. Runs through
   a pluggable OpenAI-compatible provider (Sarvam via LM Studio by default).
2. **Voice Agent — the mouth.** The conversational layer (ElevenLabs Agents +
   Twilio) that phones the engineer, reads out the options the Analyzer already
   produced, and captures their choice. **It decides nothing** — all reasoning
   lives in the backend.

## Architecture principles

- **The operator runs in a separate container from prod.** It survives prod
  crashing and controls prod from the outside via the Docker API (`dockerode`
  against the mounted Docker socket). The agent never runs inside prod.
- **AI-driven detection with a cheap gate.** A non-AI **Watcher** decides only
  _when_ to wake the Analyzer. The **Analyzer (LLM)** does the actual diagnosis.
  The raw log firehose is never streamed to the LLM — the Watcher gates it.
- **Bounded action catalog.** The Analyzer may only choose typed actions from a
  fixed catalog. The executor refuses anything not in the incident's approved
  options.
- **Human-in-the-loop by voice.** No destructive action runs without an explicit
  decision returned from the voice channel for that specific incident id.
- **Closed loop with verification.** After executing, re-check health; if not
  recovered, loop back and offer remaining options; if recovered, call to confirm.

## Monorepo layout

```
siren/
  docker-compose.yml
  .env.example
  packages/
    shared/          # Incident, ActionDefinition, LLM + voice contracts, zod schemas, SSE events
  services/
    real-test-server/ # the REAL Express e-commerce backend Siren monitors (good/broken images)
    operator/        # collector + watcher + analyzer + executor + lifecycle + coordinator + llm + voice
    dashboard/       # React/Vite UI: logs, incident state, severity, phone, server controls
    prod-app/        # legacy simulated service (kept for reference; not in compose)
  scripts/
    build-real-images.sh   # builds siren-real-server:v1 (good) + :v2 (broken)
```

## State machine

```
(watcher trips) → analyzing            (Analyzer reads logs)
  → [isIncident=false] discard
  → awaiting_decision                  (place voice call with proposed options)
  → executing                          (on valid decision; run chosen action)
  → verifying                          (re-poll /health + /metrics)
  → resolved                           (healthy) — voice confirm "resolved"
  → awaiting_decision                  (not healthy AND options remain) — "that didn't work" + re-offer
  → escalated                          (no answer / engineer escalates / no options left)
```

## Action catalog

| name                 | params           | reversible | does                                                 |
| -------------------- | ---------------- | ---------- | ---------------------------------------------------- |
| `restart_service`    | `{}`             | yes        | recreate prod-app container (clears fault)           |
| `rollback_image`     | `{ tag }`        | yes        | recreate prod-app from a known-good tag              |
| `scale_replicas`     | `{ count }`      | yes        | set prod-app replica count                           |
| `clear_cache`        | `{}`             | yes        | call prod-app `/admin/clear-cache`                   |
| `apply_config_patch` | `{ key, value }` | yes        | recreate prod-app with a whitelisted env key patched |
| `escalate_to_human`  | `{ reason }`     | n/a        | terminal: notify a secondary human (stub)            |

## Monitored target — the REAL server

Siren watches a **real Express e-commerce backend** (`services/real-test-server`).
Two images are built from the one Dockerfile, differing only by a baked-in
`RELEASE` value:

| image                  | RELEASE  | behaviour                                                   |
| ---------------------- | -------- | ---------------------------------------------------------- |
| `siren-real-server:v1` | `good`   | `/health` → 200; healthy build                             |
| `siren-real-server:v2` | `broken` | bad release: `/health` → 503 + ERROR logs every few seconds |

Because the difference is baked into the image, **rolling the running container
back from v2 → v1 is the genuine fix** (a restart of v2 stays broken, so Siren's
verify loop re-offers the remaining option). Health is decoupled from MongoDB so
the demo fault is purely the release regression.

**The target is NOT in docker-compose.** The operator creates/starts/stops/heals
it on demand via the Docker API, driven by the dashboard, and attaches it to the
shared `siren-net` network so the operator reaches it by name.

## Quick start

```bash
cp .env.example .env             # set LLM_API_KEY (nvapi-…); voice/Mongo optional
npm install
npm run build:shared             # build shared contracts first
./scripts/build-real-images.sh   # builds siren-real-server:v1 (good) + :v2 (broken)
docker compose up --build        # brings up operator + dashboard only
```

Then on the dashboard: **Start server** (boots v1, healthy) → **Deploy update**
(ships v2, the bad release) → Siren detects, rates severity, calls, you say
"rollback", it recreates from v1, verifies healthy, and calls back to confirm.

Dashboard: http://localhost:5173 · Operator API/SSE: http://localhost:4000 ·
Target (when running): http://localhost:5050

