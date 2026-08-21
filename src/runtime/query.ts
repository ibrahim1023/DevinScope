import type { RuntimeEntity, RuntimeGraph, RuntimeEntityKind } from "./types.js";

const KINDS = new Set(["instruction", "rule", "skill", "hook", "plugin", "agent", "mcp", "config"]);
const SCOPE_RANK: Record<string, number> = {
  "project-local": 0,
  project: 1,
  plugin: 2,
  compatibility: 3,
  global: 4,
  session: 5,
  unknown: 6,
};

export interface QueryResult {
  matches: RuntimeEntity[];
  /** `kind:name` suggestions when nothing matched. */
  suggestions: string[];
}

/**
 * Lookup for `why <thing>` (spec §8.2). Query forms: `name`,
 * `kind:name`, and hook `event:matcher` names via `hook:PreToolUse:exec`.
 */
export function findEntities(graph: RuntimeGraph, query: string): QueryResult {
  let kind: RuntimeEntityKind | null = null;
  let name = query;

  const colon = query.indexOf(":");
  if (colon > 0) {
    const prefix = query.slice(0, colon);
    if (KINDS.has(prefix)) {
      kind = prefix as RuntimeEntityKind;
      name = query.slice(colon + 1);
    }
  }

  const matches = graph.entities
    .filter((e) => (kind === null || e.kind === kind) && e.name === name)
    .sort((a, b) => (SCOPE_RANK[a.scope] ?? 9) - (SCOPE_RANK[b.scope] ?? 9) || a.id.localeCompare(b.id));

  if (matches.length > 0) return { matches, suggestions: [] };

  const needle = (kind ? name : query).toLowerCase();
  const suggestions = graph.entities
    .filter((e) => e.name.toLowerCase().includes(needle))
    .map((e) => `${e.kind}:${e.name}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort()
    .slice(0, 10);
  return { matches: [], suggestions };
}
