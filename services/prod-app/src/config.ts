/** Whitelisted, env-driven config. `apply_config_patch` recreates the container
 * with one of these keys patched; the operator only ever touches this set. */
export const CONFIG_WHITELIST = ['VERSION', 'FEATURE_FLAGS', 'CACHE_TTL'] as const;
export type ConfigKey = (typeof CONFIG_WHITELIST)[number];

export const config = {
  port: Number(process.env.PORT ?? 8080),
  version: process.env.VERSION ?? '1.0.0',
  featureFlags: process.env.FEATURE_FLAGS ?? 'default',
  cacheTtl: Number(process.env.CACHE_TTL ?? 60),
};

export function whitelistedConfig(): Record<string, string> {
  return {
    VERSION: config.version,
    FEATURE_FLAGS: config.featureFlags,
    CACHE_TTL: String(config.cacheTtl),
  };
}
