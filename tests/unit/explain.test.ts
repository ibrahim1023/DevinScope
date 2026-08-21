import { describe, expect, it } from "vitest";
import { explainEntity } from "../../src/diagnostics/explain.js";
import { emptyGraph, entityId } from "../../src/runtime/graph.js";
import type { Diagnostic, RuntimeEntity, RuntimeEntityKind, RuntimeGraph, RuntimeScope } from "../../src/runtime/types.js";

function entity(kind: RuntimeEntityKind, scope: RuntimeScope, name: string, extra?: Partial<RuntimeEntity>): RuntimeEntity {
  return {
    id: entityId(kind, scope, name),
    kind,
    name,
    scope,
    status: "available",
    provenance: { sourceType: "filesystem", resolution: "direct" },
    metadata: {},
    ...extra,
  };
}

function graph(entities: RuntimeEntity[], diagnostics: Diagnostic[] = []): RuntimeGraph {
  const g = emptyGraph("/repo");
  g.entities.push(...entities);
  g.diagnostics.push(...diagnostics);
  return g;
}

describe("explainEntity", () => {
  it("assembles duplicates, related instructions, hooks and diagnostics for a skill", () => {
    const dup = entity("skill", "global", "review");
    const skill = entity("skill", "project", "review", { metadata: { duplicateOf: [dup.id] } });
    const instr = entity("instruction", "project", "AGENTS.md", { status: "available" });
    const hook = entity("hook", "project", "PreToolUse:exec");
    const plugin = entity("plugin", "global", "superpowers");
    const diag: Diagnostic = {
      code: "DUP_SKILL",
      title: "dup",
      severity: "MEDIUM",
      entityIds: [skill.id, dup.id],
      evidence: [],
      explanation: "e",
    };
    const g = graph([skill, dup, instr, hook, plugin], [diag]);

    const ex = explainEntity(g, skill);
    expect(ex.entity).toBe(skill);
    expect(ex.duplicates).toEqual([dup]);
    expect(ex.relatedInstructions).toEqual([instr]);
    expect(ex.relevantHooks).toEqual([hook]);
    expect(ex.diagnostics).toEqual([diag]);
  });

  it("resolves shadowing links both directions", () => {
    const winner = entity("mcp", "project", "github", { status: "active" });
    const loser = entity("mcp", "global", "github", { status: "shadowed" });
    winner.provenance = { sourceType: "project-config", resolution: "documented-precedence", overrides: [loser.id] };
    loser.provenance = { sourceType: "global-config", resolution: "documented-precedence", overriddenBy: [winner.id] };
    const g = graph([winner, loser]);

    expect(explainEntity(g, winner).shadows).toEqual([loser]);
    expect(explainEntity(g, loser).shadowedBy).toEqual([winner]);
  });

  it("links a plugin-contributed entity to its plugin", () => {
    const plugin = entity("plugin", "global", "teamkit");
    const rule = entity("rule", "plugin", "teamkit:rules/deploy.md");
    rule.provenance = { sourceType: "plugin", resolution: "direct", pluginName: "teamkit" };
    const g = graph([plugin, rule]);

    const ex = explainEntity(g, rule);
    expect(ex.plugin).toBe(plugin);
  });

  it("excludes shadowed/disabled instructions from related sources", () => {
    const skill = entity("skill", "project", "x");
    const shadowed = entity("instruction", "global", "old.md", { status: "shadowed" });
    const active = entity("rule", "project", "style.md", { status: "available" });
    const g = graph([skill, shadowed, active]);

    expect(explainEntity(g, skill).relatedInstructions).toEqual([active]);
  });
});
