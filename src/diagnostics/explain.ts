import type { Diagnostic, RuntimeEntity, RuntimeGraph } from "../runtime/types.js";

/** The `why` answer for one entity (spec §8.2): evidence, not speculation. */
export interface Explanation {
  entity: RuntimeEntity;
  duplicates: RuntimeEntity[];
  shadowedBy: RuntimeEntity[];
  shadows: RuntimeEntity[];
  relatedInstructions: RuntimeEntity[];
  relevantHooks: RuntimeEntity[];
  diagnostics: Diagnostic[];
  plugin?: RuntimeEntity;
}

export function explainEntity(graph: RuntimeGraph, entity: RuntimeEntity): Explanation {
  const byId = new Map(graph.entities.map((e) => [e.id, e]));
  const resolve = (ids: string[] | undefined): RuntimeEntity[] =>
    (ids ?? []).map((id) => byId.get(id)).filter((e): e is RuntimeEntity => e !== undefined);

  const relatedInstructions = graph.entities.filter(
    (e) =>
      (e.kind === "instruction" || e.kind === "rule") &&
      (e.status === "active" || e.status === "available") &&
      e.id !== entity.id,
  );
  const relevantHooks = graph.entities.filter(
    (e) => e.kind === "hook" && e.status !== "invalid" && e.id !== entity.id,
  );
  const diagnostics = graph.diagnostics.filter((d) => d.entityIds.includes(entity.id));
  const pluginName = entity.provenance.pluginName;
  const plugin = pluginName
    ? graph.entities.find((e) => e.kind === "plugin" && e.name === pluginName)
    : undefined;

  return {
    entity,
    duplicates: resolve(entity.metadata.duplicateOf as string[] | undefined),
    shadowedBy: resolve(entity.provenance.overriddenBy),
    shadows: resolve(entity.provenance.overrides),
    relatedInstructions,
    relevantHooks,
    diagnostics,
    ...(plugin ? { plugin } : {}),
  };
}
