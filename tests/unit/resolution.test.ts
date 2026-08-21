import { describe, expect, it } from "vitest";
import { resolveEntities } from "../../src/resolution/index.js";
import { entityId } from "../../src/runtime/graph.js";
import type { RuntimeEntity, RuntimeEntityKind, RuntimeScope } from "../../src/runtime/types.js";

function entity(kind: RuntimeEntityKind, scope: RuntimeScope, name: string, idSuffix?: string): RuntimeEntity {
  return {
    id: entityId(kind, scope, idSuffix ? `${name}@${idSuffix}` : name),
    kind,
    name,
    scope,
    status: "available",
    provenance: { sourceType: "filesystem", resolution: "direct" },
    metadata: {},
  };
}

describe("resolveEntities", () => {
  it("cross-links duplicate skills but never marks them shadowed (undocumented precedence, ADR-0003)", () => {
    const out = resolveEntities([
      entity("skill", "global", "review", "home"),
      entity("skill", "project", "review", "repo"),
    ]);
    expect(out.every((e) => e.status === "available")).toBe(true);
    expect(out.every((e) => e.provenance.resolution === "unknown")).toBe(true);
    const [global, project] = out;
    expect(global!.metadata.duplicateOf).toEqual([project!.id]);
    expect(project!.metadata.duplicateOf).toEqual([global!.id]);
  });

  it("applies documented level precedence to config entities: local > project > global", () => {
    const out = resolveEntities([
      entity("config", "global", "config.json", "user"),
      entity("config", "project", "config.json", "proj"),
      entity("config", "project-local", "config.json", "local"),
    ]);
    const byId = Object.fromEntries(out.map((e) => [e.id, e]));
    const local = byId[entityId("config", "project-local", "config.json@local")]!;
    const project = byId[entityId("config", "project", "config.json@proj")]!;
    const global = byId[entityId("config", "global", "config.json@user")]!;
    expect(local.status).toBe("active");
    expect(project.status).toBe("shadowed");
    expect(global.status).toBe("shadowed");
    expect(local.provenance.resolution).toBe("documented-precedence");
    expect(global.provenance.overriddenBy).toEqual([local.id]);
    expect(local.provenance.overrides?.sort()).toEqual([project.id, global.id].sort());
  });

  it("hooks from multiple sources are all active — collected, never shadowed", () => {
    const out = resolveEntities([
      entity("hook", "global", "PreToolUse:exec", "user-config"),
      entity("hook", "project", "PreToolUse:exec", "hooks.v1"),
      entity("hook", "compatibility", "PreToolUse:exec", "claude-settings"),
    ]);
    expect(out.every((e) => e.status === "active")).toBe(true);
    expect(out.every((e) => !e.provenance.overriddenBy)).toBe(true);
  });

  it("is idempotent: entities already resolved by an adapter keep their status", () => {
    const e = entity("mcp", "global", "github", "user");
    e.status = "shadowed";
    e.provenance.resolution = "documented-precedence";
    e.provenance.overriddenBy = ["mcp:project:github@proj"];
    const out = resolveEntities([e]);
    expect(out[0]!.status).toBe("shadowed");
    expect(out[0]!.provenance.overriddenBy).toEqual(["mcp:project:github@proj"]);
  });

  it("leaves singleton entities untouched", () => {
    const e = entity("skill", "project", "solo");
    const out = resolveEntities([e]);
    expect(out[0]).toEqual(e);
  });
});
