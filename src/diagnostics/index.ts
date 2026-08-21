import { sortGraph } from "../runtime/graph.js";
import type { Diagnostic, RuntimeGraph } from "../runtime/types.js";
import { conflictDiagnostics } from "./conflicts.js";
import { duplicateDiagnostics, shadowingDiagnostics } from "./duplicates.js";

/**
 * Deterministic diagnostics over a resolved graph (spec §16–17).
 * Adapter-emitted diagnostics already in graph.diagnostics pass through.
 */
export function runDiagnostics(graph: RuntimeGraph): Diagnostic[] {
  const generated = [
    ...duplicateDiagnostics(graph.entities),
    ...shadowingDiagnostics(graph.entities),
    ...conflictDiagnostics(graph.entities),
  ];
  return sortGraph({
    ...graph,
    diagnostics: [...graph.diagnostics, ...generated],
  }).diagnostics;
}
