import type { RuntimeGraph } from "../runtime/types.js";
import { redactText } from "../security/redact.js";

/**
 * Machine-readable output contract (docs/observability.md §2).
 * Bodies are stripped (hashes identify content); the serialized output
 * passes through the redaction chokepoint (spec §23).
 */
export function renderJson(graph: RuntimeGraph): string {
  const stripped: RuntimeGraph = {
    ...graph,
    entities: graph.entities.map((e) => {
      const { body: _stripped, ...rest } = e.metadata as Record<string, unknown> & { body?: unknown };
      return { ...e, metadata: rest };
    }),
  };
  return redactText(JSON.stringify(stripped, null, 2)) + "\n";
}
