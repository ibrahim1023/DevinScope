import { describe, expect, it } from "vitest";
import { emptyGraph, entityId } from "../../src/runtime/graph.js";
import { findEntities } from "../../src/runtime/query.js";
import type { RuntimeEntity, RuntimeEntityKind, RuntimeGraph, RuntimeScope } from "../../src/runtime/types.js";

function entity(kind: RuntimeEntityKind, scope: RuntimeScope, name: string): RuntimeEntity {
  return {
    id: entityId(kind, scope, name),
    kind,
    name,
    scope,
    status: "available",
    provenance: { sourceType: "filesystem", resolution: "direct" },
    metadata: {},
  };
}

function graph(...entities: RuntimeEntity[]): RuntimeGraph {
  const g = emptyGraph("/repo");
  g.entities.push(...entities);
  return g;
}

describe("findEntities", () => {
  const g = graph(
    entity("skill", "project", "review"),
    entity("skill", "global", "review"),
    entity("mcp", "project", "github"),
    entity("hook", "project", "PreToolUse:exec"),
    entity("agent", "project", "reviewer"),
  );

  it("matches by bare name across scopes, sorted project before global", () => {
    const r = findEntities(g, "review");
    expect(r.matches.map((e) => e.scope)).toEqual(["project", "global"]);
    expect(r.suggestions).toEqual([]);
  });

  it("kind prefix narrows the match", () => {
    expect(findEntities(g, "skill:review").matches).toHaveLength(2);
    expect(findEntities(g, "mcp:review").matches).toHaveLength(0);
    expect(findEntities(g, "mcp:github").matches).toHaveLength(1);
  });

  it("matches hooks by event:matcher name", () => {
    const r = findEntities(g, "hook:PreToolUse:exec");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.kind).toBe("hook");
  });

  it("offers substring suggestions when nothing matches", () => {
    const r = findEntities(g, "revi");
    expect(r.matches).toEqual([]);
    expect(r.suggestions).toContain("skill:review");
    expect(r.suggestions).toContain("agent:reviewer");
  });

  it("returns no suggestions for unrelated queries", () => {
    const r = findEntities(g, "zzzz-nothing");
    expect(r.matches).toEqual([]);
    expect(r.suggestions).toEqual([]);
  });
});
