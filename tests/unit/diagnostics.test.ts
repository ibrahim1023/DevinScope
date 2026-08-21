import { describe, expect, it } from "vitest";
import { runDiagnostics } from "../../src/diagnostics/index.js";
import { emptyGraph, entityId } from "../../src/runtime/graph.js";
import type { RuntimeEntity, RuntimeEntityKind, RuntimeGraph, RuntimeScope } from "../../src/runtime/types.js";

function entity(kind: RuntimeEntityKind, scope: RuntimeScope, name: string, body?: string): RuntimeEntity {
  return {
    id: entityId(kind, scope, name),
    kind,
    name,
    scope,
    status: "available",
    provenance: { sourceType: "filesystem", resolution: "unknown" },
    metadata: body ? { body } : {},
  };
}

function graphWith(entities: RuntimeEntity[], prior: RuntimeGraph["diagnostics"] = []): RuntimeGraph {
  const g = emptyGraph("/repo");
  g.entities.push(...entities);
  g.diagnostics.push(...prior);
  return g;
}

describe("runDiagnostics", () => {
  it("emits DUP_SKILL (MEDIUM) for duplicate groups with both entity ids", () => {
    const a = entity("skill", "global", "review");
    const b = entity("skill", "project", "review");
    a.metadata.duplicateOf = [b.id];
    b.metadata.duplicateOf = [a.id];
    const diags = runDiagnostics(graphWith([a, b]));
    const dup = diags.find((d) => d.code === "DUP_SKILL")!;
    expect(dup.severity).toBe("MEDIUM");
    expect(dup.entityIds.sort()).toEqual([a.id, b.id].sort());
  });

  it("emits one duplicate diagnostic per group, not per entity", () => {
    const ents = ["a", "b", "c"].map((s) => entity("skill", "project", "multi", s));
    for (const e of ents) e.metadata.duplicateOf = ents.filter((o) => o !== e).map((o) => o.id);
    const diags = runDiagnostics(graphWith(ents));
    expect(diags.filter((d) => d.code === "DUP_SKILL")).toHaveLength(1);
  });

  it("passes adapter diagnostics through unchanged", () => {
    const prior = {
      code: "BROKEN_HOOK_CMD",
      title: "t",
      severity: "HIGH" as const,
      entityIds: ["hook:project:x"],
      evidence: [],
      explanation: "e",
    };
    const diags = runDiagnostics(graphWith([], [prior]));
    expect(diags).toContainEqual(prior);
  });

  it("flags opposing modal directives as CONFLICT_MODAL (MEDIUM, heuristic, medium confidence)", () => {
    const a = entity("instruction", "global", "global.md", "Always run the complete test suite before committing.");
    const b = entity("instruction", "project", "proj.md", "Only run tests directly affected by the change.");
    const diags = runDiagnostics(graphWith([a, b]));
    const conflict = diags.find((d) => d.code === "CONFLICT_MODAL")!;
    expect(conflict.severity).toBe("MEDIUM");
    expect(conflict.entityIds.sort()).toEqual([a.id, b.id].sort());
    expect(conflict.explanation).toMatch(/opposing/i);
    expect(conflict.evidence.join(" ")).toContain("medium");
  });

  it("does not flag same-polarity or topicless directive pairs", () => {
    const same = runDiagnostics(graphWith([
      entity("instruction", "global", "a.md", "Always write tests for new code."),
      entity("instruction", "project", "b.md", "Always add tests for bug fixes."),
    ]));
    expect(same.filter((d) => d.code === "CONFLICT_MODAL")).toEqual([]);

    const differentTopics = runDiagnostics(graphWith([
      entity("instruction", "global", "c.md", "Always run tests."),
      entity("instruction", "project", "d.md", "Never commit directly to main."),
    ]));
    expect(differentTopics.filter((d) => d.code === "CONFLICT_MODAL")).toEqual([]);
  });

  it("ignores shadowed/disabled instruction entities when conflict-checking", () => {
    const a = entity("instruction", "global", "g.md", "Always run the complete test suite.");
    a.status = "shadowed";
    const b = entity("instruction", "project", "p.md", "Only run affected tests.");
    const diags = runDiagnostics(graphWith([a, b]));
    expect(diags.filter((d) => d.code === "CONFLICT_MODAL")).toEqual([]);
  });

  it("summarizes documented shadowing as SHADOWED_ENTITY (INFO)", () => {
    const winner = entity("mcp", "project", "github");
    winner.status = "active";
    winner.provenance.resolution = "documented-precedence";
    const loser = entity("mcp", "global", "github");
    loser.status = "shadowed";
    loser.provenance.resolution = "documented-precedence";
    loser.provenance.overriddenBy = [winner.id];
    const diags = runDiagnostics(graphWith([winner, loser]));
    const info = diags.find((d) => d.code === "SHADOWED_ENTITY")!;
    expect(info.severity).toBe("INFO");
    expect(info.entityIds).toContain(loser.id);
  });
});
