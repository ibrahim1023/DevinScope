import { describe, expect, it } from "vitest";
import { emptyGraph, entityId, sha256, sortGraph } from "../../src/runtime/graph.js";
import type { Diagnostic, RuntimeEntity } from "../../src/runtime/types.js";

function entity(partial: Partial<RuntimeEntity> & Pick<RuntimeEntity, "kind" | "scope" | "name">): RuntimeEntity {
  return {
    id: entityId(partial.kind, partial.scope, partial.name),
    status: "available",
    provenance: { sourceType: "filesystem", resolution: "direct" },
    metadata: {},
    ...partial,
  };
}

function diag(code: string, severity: Diagnostic["severity"]): Diagnostic {
  return { code, title: code, severity, entityIds: [], evidence: [], explanation: code };
}

describe("runtime graph", () => {
  it("entityId is kind:scope:name", () => {
    expect(entityId("skill", "project", "review")).toBe("skill:project:review");
  });

  it("sha256 matches the known digest of 'abc'", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("sortGraph orders entities by id and diagnostics by severity then code", () => {
    const g = emptyGraph("/repo");
    g.entities.push(entity({ kind: "skill", scope: "project", name: "b" }));
    g.entities.push(entity({ kind: "skill", scope: "global", name: "a" }));
    g.diagnostics.push(diag("ZZZ", "LOW"), diag("AAA", "ERROR"), diag("AAB", "ERROR"));
    const sorted = sortGraph(g);
    expect(sorted.entities.map((e) => e.id)).toEqual(["skill:global:a", "skill:project:b"]);
    expect(sorted.diagnostics.map((d) => d.code)).toEqual(["AAA", "AAB", "ZZZ"]);
  });

  it("emptyGraph carries the v1 schema marker and zeroed metrics", () => {
    const g = emptyGraph("/repo");
    expect(g.schema).toBe("devinscope/v1");
    expect(g.root).toBe("/repo");
    expect(g.metrics).toEqual({ instructionBytes: 0, fileCount: 0 });
  });

  it("severity ordering treats ERROR as highest and INFO as lowest", () => {
    const g = emptyGraph("/r");
    g.diagnostics.push(diag("I", "INFO"), diag("E", "ERROR"), diag("M", "MEDIUM"), diag("H", "HIGH"), diag("L", "LOW"));
    expect(sortGraph(g).diagnostics.map((d) => d.severity)).toEqual(["ERROR", "HIGH", "MEDIUM", "LOW", "INFO"]);
  });
});
