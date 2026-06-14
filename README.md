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

### Analyzer LLM (Sarvam-M via NVIDIA NIM — default, verified)

The Analyzer model is **Sarvam-M**, served by **NVIDIA NIM** at an
OpenAI-compatible endpoint with standard `Authorization: Bearer` auth and a
generous `max_tokens` (Sarvam-M is a reasoning model — it thinks in a
`<think>…</think>` block before emitting the JSON, so it needs headroom). Set in
`.env`:

```
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_API_KEY=<your nvapi-... key>
LLM_MODEL=sarvamai/sarvam-m
LLM_API_KEY_HEADER=authorization
LLM_MAX_TOKENS=8192
```

The Analyzer is model-agnostic (strict-JSON prompting + zod validation + one
repair retry; the JSON extractor strips the reasoning prefix — no native
tool-calling), so swapping providers is **env-only**:

- **Sarvam direct cloud:** `LLM_BASE_URL=https://api.sarvam.ai/v1`,
  `LLM_API_KEY_HEADER=api-subscription-key`, `LLM_MODEL=sarvam-30b` (note: the
  starter tier caps `max_tokens` at 4096, which is tight for this reasoning model).
- **LM Studio on the LAN:** `LLM_BASE_URL=http://<lan-ip>:1234/v1`,
  `LLM_API_KEY=lm-studio`, `LLM_API_KEY_HEADER=authorization`.

## Real phone calls (Phase 7 — ElevenLabs + Twilio)

Flip `VOICE_PROVIDER=elevenlabs` and Siren places a real outbound call instead of
ringing the on-screen panel. Same `VoiceProvider` interface — the loop is
unchanged, and every call/confirm is still mirrored to the dashboard. The voice
agent only reads the options Siren already produced and captures the choice; it
decides nothing.

**One-time setup:**

1. **Twilio:** buy a number; note the Account SID + Auth Token.
2. **ElevenLabs → Agents:** create an agent and **import the Twilio number**
   (paste SID + Auth Token); ElevenLabs auto-wires the call webhooks. Note the
   **agent id** and **agent phone number id**.
3. **Allow per-call overrides:** in the agent's _Security/Advanced_ settings,
   enable overriding **first message** (Siren sends a per-incident `first_message`).
4. **Add a server tool** named `submit_decision`:
   - Webhook `POST {{webhook_url}}` (a `webhook_url` dynamic variable is passed in;
     it equals `PUBLIC_WEBHOOK_URL/webhook/voice-decision`). You may also hardcode
     the URL.
   - Body (JSON): `{ "incident_id": "{{incident_id}}", "option_key": "<llm>", "decision": "<llm>" }`
     — `option_key` = the key of the chosen option, or set `decision` to `escalate`.
   - Parameters the LLM fills: `option_key` (string) and `decision` (`escalate`|`none`).
5. **Agent prompt:** instruct it to read `{{spoken_summary}}` and `{{options_spoken}}`,
   then call `submit_decision` with the chosen option's key
   (`{{option_1_key}}` / `{{option_2_key}}` / `{{option_3_key}}`) or `escalate`.
   Dynamic variables Siren provides each call: `incident_id`, `spoken_summary`,
   `options_spoken`, `option_1..3`, `option_1_key..3_key`, `webhook_url`.
6. **Public webhook:** expose the operator so ElevenLabs can reach the tool —
   `ngrok http 4000`, then set `PUBLIC_WEBHOOK_URL` to the https URL.
7. **`.env`:**
   ```
   VOICE_PROVIDER=elevenlabs
   ELEVENLABS_API_KEY=...
   ELEVENLABS_AGENT_ID=...
   ELEVENLABS_AGENT_PHONE_NUMBER_ID=...
   ON_CALL_PHONE_NUMBER=+1...        # the on-call engineer's phone
   PUBLIC_WEBHOOK_URL=https://<your-ngrok>.ngrok-free.app
   ```

`placeCall()` → `POST /v1/convai/twilio/outbound-call` with the options as dynamic
variables + a first-message override. `confirm()` places a short follow-up call
that speaks the outcome. The webhook accepts both `incident_id/option_key`
(ElevenLabs) and `incidentId/optionKey` (the mock panel). If any credential is
missing, the operator logs what's missing and **falls back to mock** so the demo
still runs.

## Demo script (real server + bad-release rollback)

Prereq: `./scripts/build-real-images.sh` then `docker compose up --build`.
Open the dashboard at http://localhost:5173 — the **🖥️ Server** bar shows
**■ stopped**, no active incident ("System nominal").

1. Click **▶ Start server** — the operator creates `siren-real-server:v1` (good)
   on `siren-net`; status flips to **● running (healthy)**, logs start streaming,
   `/health` is green. No incident (the watcher is dormant until something breaks).
2. Click **⬆️ Deploy update** — the operator recreates the container from
   `siren-real-server:v2` (the **bad release**); `/health` → 503 and ERROR lines
   stream into the log panel.
3. Within a few seconds the Watcher trips → incident card flips to **🧠 Analyzing**
   (Sarvam-M reads the logs, ~10–20s) and stamps a **severity** badge
   (low/medium/high/**critical**) it produced itself.
4. The Analyzer posts a root cause + ranked options (restart / rollback / escalate)
   → the **phone panel rings** (or a real call goes out in `elevenlabs` mode).
5. Say/tap **restart** first to show the verify loop: restarting the same v2 image
   stays broken → verification fails → Siren **calls back** with the remaining
   option. Then say/tap **rollback** → executor recreates from v1.
6. The server recovers → **✅ Resolved**; Siren's confirmation appears in the
   phone log and a confirmation call goes out.
7. Press **↺ Reset demo** (top-right) to clear the incident **and stop the target**.
8. Or go straight to rollback in step 5 for the fast path.

Tip: **restart_service** is the natural wrong-but-safe first choice here — it
demonstrates the re-offer path, since only an image **rollback** undoes a bad
release. Exhausting options (or **escalate**) ends in **🚨 Escalated**.

### Real phone-call mode

Set `VOICE_PROVIDER=elevenlabs` (+ the ElevenLabs/Twilio vars and a public
`ngrok http 4000` URL in `PUBLIC_WEBHOOK_URL`). The operator's webhook path is
unchanged (`/webhook/voice-decision`); only the **ngrok URL changes per session**,
so re-run ngrok and update `PUBLIC_WEBHOOK_URL` before a live demo.

## Build phases

1. ✅ **Scaffold** — monorepo, workspaces, `packages/shared`, compose, env, README.
2. ✅ prod-app — endpoints, metrics, fault injection with real error logs.
3. ✅ collector + watcher.
4. ✅ coordinator + dashboard skeleton (SSE).
5. ✅ llm provider + analyzer (verified live against Sarvam-M / NVIDIA NIM).
6. ✅ executor + MockVoiceProvider + full loop **(mock-mode demo milestone — verified in compose, error_spike + crash)**.
7. ✅ ElevenLabsVoiceProvider (real outbound calls behind `VOICE_PROVIDER=elevenlabs`).
   Code-complete + webhook contract verified; needs ElevenLabs + Twilio accounts + ngrok to place live calls.
8. ✅ Demo polish — Tailwind UI, status stepper + transition animations, "reset demo" button, demo script.

## Security caveats (demo only)

- The operator mounts `/var/run/docker.sock`, which is **root-equivalent on the
  host**. Acceptable for a hackathon demo on a trusted machine only.
- **The voice caller's identity is not verified** — voice is spoofable. Flagged,
  not solved (see future work).

## Out of scope (future work)

- Statistical/ML anomaly detection (Watcher stays rule-based; the AI diagnoses).
- Identity/authorization of the voice caller.
- Concurrent multi-incident handling beyond a single-active-incident queue.
- Free-form code or arbitrary shell as a remediation.
- Kubernetes, secrets managers, multi-tenant concerns.

claude --resume e66db87e-4f76-4ada-99c3-7da94408a0c7
