const num = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v: string | undefined, d: boolean): boolean =>
  v === undefined ? d : v.toLowerCase() === 'true';

export const config = {
  operatorPort: num(process.env.OPERATOR_PORT, 4000),
  pollIntervalMs: num(process.env.POLL_INTERVAL_MS, 2000),

  // The monitored target: a real server the operator starts/stops/heals on
  // demand via the Docker API. Two images: a known-good build and a broken
  // (bad-release) build; rolling back from broken -> good is the real fix.
  prodApp: {
    container: process.env.TARGET_CONTAINER ?? process.env.PROD_APP_CONTAINER ?? 'siren-real-server',
    url: process.env.TARGET_URL ?? process.env.PROD_APP_URL ?? 'http://siren-real-server:5000',
    image: process.env.TARGET_IMAGE ?? process.env.PROD_APP_IMAGE ?? 'siren-real-server:v2-db',
    goodImage: process.env.TARGET_GOOD_IMAGE ?? 'siren-real-server:v1',
    badImageDb: process.env.TARGET_BAD_DB_IMAGE ?? 'siren-real-server:v2-db',
    badImageHealth: process.env.TARGET_BAD_HEALTH_IMAGE ?? 'siren-real-server:v2-health',
    healthPath: process.env.TARGET_HEALTH_PATH ?? '/health',
    containerPort: num(process.env.TARGET_PORT, 5000),
    hostPort: process.env.TARGET_HOST_PORT ?? '5050',
    network: process.env.TARGET_NETWORK ?? 'siren-net',
    // forwarded into the created container. MONGODB_URI is deliberately NOT
    // forwarded — it is baked into each image (present in v1, absent in v2) so
    // that an image rollback is what restores the config and heals the service.
    containerEnv: {
      JWT_SECRET: process.env.TARGET_JWT_SECRET || process.env.JWT_SECRET || 'siren-demo-secret',
      JWT_EXPIRES_IN: process.env.TARGET_JWT_EXPIRES_IN ?? '7d',
      FRONTEND_URL: process.env.TARGET_FRONTEND_URL ?? 'http://localhost:5173',
    } as Record<string, string>,
  },

  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',

  watcher: {
    errorRateThreshold: num(process.env.ERROR_RATE_THRESHOLD, 0.2),
    consecutiveSamples: num(process.env.CONSECUTIVE_SAMPLES, 3),
    p95LatencyMsThreshold: num(process.env.P95_LATENCY_MS_THRESHOLD, 1500),
    memoryMbThreshold: num(process.env.MEMORY_MB_THRESHOLD, 400),
    wakeOnAnyErrorLine: bool(process.env.WAKE_ON_ANY_ERROR_LINE, false),
  },

  decisionTimeoutMs: num(process.env.DECISION_TIMEOUT_MS, 90_000),
  verifyWindowMs: num(process.env.VERIFY_WINDOW_MS, 10_000),

  llm: {
    // Default: NVIDIA NIM hosting sarvamai/sarvam-m (OpenAI-compatible, Bearer auth).
    baseUrl: process.env.LLM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'sarvamai/sarvam-m',
    // 'authorization' => standard `Authorization: Bearer` (NVIDIA/OpenAI/LM Studio).
    // 'api-subscription-key' => Sarvam's direct cloud API.
    apiKeyHeader: (process.env.LLM_API_KEY_HEADER ?? 'authorization').toLowerCase(),
    temperature: num(process.env.LLM_TEMPERATURE, 0.3),
    // sarvam-m is a reasoning model: give it headroom so it finishes thinking AND emits content.
    maxTokens: num(process.env.LLM_MAX_TOKENS, 8192),
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 90_000),
  },

  voice: {
    provider: (process.env.VOICE_PROVIDER ?? 'mock') as 'mock' | 'elevenlabs',
    elevenLabs: {
      apiKey: process.env.ELEVENLABS_API_KEY ?? '',
      agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
      agentPhoneNumberId: process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID ?? '',
      toNumber: process.env.ON_CALL_PHONE_NUMBER ?? '',
      publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL ?? '',
    },
  },

  /** rolling buffer sizes */
  buffers: {
    logLines: 100,
    metricSamples: 30,
  },
} as const;

export type Config = typeof config;
