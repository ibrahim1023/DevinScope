import type { RuntimeEntity } from "../runtime/types.js";

/**
 * Evidence-based resolution (ADR-0003). Precedence is applied ONLY where
 * Devin documents it:
 * - config/mcp: project-local > project > global (documented level table)
 * - hooks: collected from all sources, all run — never shadowed
 * - skills/agents/instructions/rules: discovery documented, shadowing NOT —
 *   duplicates stay available with resolution "unknown" and cross-links.
 * Idempotent: entities an adapter already resolved (documented-precedence
 * with a terminal status) are left alone.
 */
const LEVEL_RANK: Record<string, number> = { "project-local": 0, project: 1, global: 2 };
const LEVEL_RESOLVED_KINDS = new Set(["config", "mcp"]);
const CONFIG_PRECEDENCE_DOC = "devin-docs:reference/configuration/global-vs-local.mdx";

export function resolveEntities(entities: RuntimeEntity[]): RuntimeEntity[] {
  const byKindName = new Map<string, RuntimeEntity[]>();
  for (const e of entities) {
    const key = `${e.kind}:${e.name}`;
    byKindName.set(key, [...(byKindName.get(key) ?? []), e]);
  }

  for (const group of byKindName.values()) {
    if (group.length < 2) continue;
    const kind = group[0]!.kind;

    if (group.every((e) => e.provenance.resolution === "documented-precedence")) continue;

    if (LEVEL_RESOLVED_KINDS.has(kind)) {
      applyLevelPrecedence(group);
    } else if (kind === "hook") {
      for (const e of group) {
        if (e.status === "available") e.status = "active";
      }
    } else {
      // skills, agents, instructions, rules, plugins: no documented order
      for (const e of group) {
        e.provenance.resolution = "unknown";
        e.metadata.duplicateOf = group.filter((o) => o.id !== e.id).map((o) => o.id);
      }
    }
  }
  return entities;
}

function applyLevelPrecedence(group: RuntimeEntity[]): void {
  const sorted = [...group].sort((a, b) => (LEVEL_RANK[a.scope] ?? 9) - (LEVEL_RANK[b.scope] ?? 9));
  const [winner, ...losers] = sorted;
  for (const e of sorted) {
    e.provenance.resolution = "documented-precedence";
    e.provenance.docRef = CONFIG_PRECEDENCE_DOC;
  }
  if (winner!.status !== "disabled" && winner!.status !== "invalid") winner!.status = "active";
  for (const loser of losers) {
    if (loser.status === "disabled" || loser.status === "invalid") continue;
    loser.status = "shadowed";
    loser.provenance.overriddenBy = [winner!.id];
    winner!.provenance.overrides = [...(winner!.provenance.overrides ?? []), loser.id];
  }
}
