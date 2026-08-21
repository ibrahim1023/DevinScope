import { createHash } from "node:crypto";
import type { RuntimeEntityKind, RuntimeGraph, RuntimeScope, Severity } from "./types.js";

export function entityId(kind: RuntimeEntityKind, scope: RuntimeScope, name: string): string {
  return `${kind}:${scope}:${name}`;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

const SEVERITY_ORDER: Record<Severity, number> = {
  ERROR: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export function emptyGraph(root: string): RuntimeGraph {
  return {
    schema: "devinscope/v1",
    root,
    entities: [],
    diagnostics: [],
    metrics: { instructionBytes: 0, fileCount: 0 },
  };
}

/** Deterministic ordering for stable snapshots and diffs (spec §22). */
export function sortGraph(graph: RuntimeGraph): RuntimeGraph {
  return {
    ...graph,
    entities: [...graph.entities].sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: [...graph.diagnostics].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code),
    ),
  };
}
