import { z } from 'zod';

export interface ActionDefinition {
  name: string;
  description: string; // shown to the Analyzer AND spoken by the voice agent
  paramsSchema: z.ZodTypeAny;
  reversible: boolean;
}

/**
 * The bounded action catalog. The Analyzer may ONLY propose actions from this
 * list; the executor refuses anything not present here AND not present in the
 * incident's approved options. Single source of truth shared by both.
 */
export const ACTION_CATALOG: readonly ActionDefinition[] = [
  {
    name: 'restart_service',
    description:
      'Recreate the service container from the SAME image. Clears transient in-memory faults, but does NOT undo a bad deploy (a code/release regression will still be present after restart).',
    paramsSchema: z.object({}).strict(),
    reversible: true,
  },
  {
    name: 'rollback_image',
    description:
      'Recreate the service from the last known-good image tag (default "v1") to undo a bad deploy/release regression. Use this when a recent deploy introduced the fault.',
    paramsSchema: z.object({ tag: z.string().min(1).default('v1') }).strict(),
    reversible: true,
  },
  {
    name: 'scale_replicas',
    description: 'Set the prod-app replica count to absorb load or relieve resource pressure.',
    paramsSchema: z.object({ count: z.number().int().min(1).max(10) }).strict(),
    reversible: true,
  },
  {
    name: 'clear_cache',
    description: 'Call prod-app /admin/clear-cache to flush a poisoned in-memory cache.',
    paramsSchema: z.object({}).strict(),
    reversible: true,
  },
  {
    name: 'apply_config_patch',
    description:
      'Recreate prod-app with a single whitelisted env config key patched to a new value.',
    paramsSchema: z.object({ key: z.string().min(1), value: z.string() }).strict(),
    reversible: true,
  },
  {
    name: 'escalate_to_human',
    description: 'Terminal action: notify a secondary human because Siren cannot safely remediate.',
    paramsSchema: z.object({ reason: z.string().min(1) }).strict(),
    reversible: false,
  },
] as const;

export const ACTION_NAMES = ACTION_CATALOG.map((a) => a.name);

export function getActionDefinition(name: string): ActionDefinition | undefined {
  return ACTION_CATALOG.find((a) => a.name === name);
}

/** Serialize the catalog for prompting the Analyzer (params rendered as a hint string). */
export function serializeCatalog(): { name: string; description: string; params: string }[] {
  return ACTION_CATALOG.map((a) => ({
    name: a.name,
    description: a.description,
    params: describeParams(a.paramsSchema),
  }));
}

function describeParams(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const keys = Object.keys(shape);
    if (keys.length === 0) return '{}';
    return (
      '{ ' +
      keys
        .map((k) => {
          const def = shape[k]!;
          return `${k}: ${baseTypeName(def)}`;
        })
        .join(', ') +
      ' }'
    );
  }
  return 'object';
}

function baseTypeName(schema: z.ZodTypeAny): string {
  let s: z.ZodTypeAny = schema;
  // unwrap optional/default wrappers
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    s = s._def.innerType as z.ZodTypeAny;
  }
  if (s instanceof z.ZodString) return 'string';
  if (s instanceof z.ZodNumber) return 'number';
  if (s instanceof z.ZodBoolean) return 'boolean';
  return 'value';
}
