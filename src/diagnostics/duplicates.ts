import type { Diagnostic, RuntimeEntity } from "../runtime/types.js";

const DUP_CODES: Record<string, string> = {
  skill: "DUP_SKILL",
  mcp: "DUP_MCP",
  hook: "DUP_HOOK",
  agent: "DUP_AGENT",
};

/** One duplicate diagnostic per cross-linked group (resolution engine output). */
export function duplicateDiagnostics(entities: RuntimeEntity[]): Diagnostic[] {
  const seen = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const e of entities) {
    const dupOf = e.metadata.duplicateOf as string[] | undefined;
    if (!dupOf?.length) continue;
    const code = DUP_CODES[e.kind];
    if (!code) continue;

    const group = [e.id, ...dupOf].sort();
    const groupKey = `${code}:${group.join("|")}`;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

    const all = entities.filter((o) => group.includes(o.id));
    const sameBody = new Set(all.map((o) => o.contentHash)).size === 1;
    diagnostics.push({
      code,
      title: `Duplicate ${e.kind} definitions: ${e.name}`,
      severity: "MEDIUM",
      entityIds: group,
      evidence: all.map((o) => o.sourcePath ?? o.id),
      explanation:
        `${group.length} definitions of ${e.kind} "${e.name}" exist across scopes. ` +
        `Devin's documented precedence does not specify which wins, so all are reported as available` +
        (sameBody ? " (identical content)." : " — and their contents differ."),
      remediation: `Remove or rename the definitions you don't intend to use.`,
    });
  }
  return diagnostics;
}

/** INFO summary for entities shadowed by documented precedence. */
export function shadowingDiagnostics(entities: RuntimeEntity[]): Diagnostic[] {
  return entities
    .filter((e) => e.status === "shadowed")
    .map((e) => ({
      code: "SHADOWED_ENTITY",
      title: `${e.kind} "${e.name}" is shadowed by a higher-priority definition`,
      severity: "INFO" as const,
      entityIds: [e.id, ...(e.provenance.overriddenBy ?? [])],
      evidence: [e.sourcePath ?? e.id, ...(e.provenance.overriddenBy ?? [])],
      explanation: `Documented precedence (${e.provenance.docRef ?? "Devin docs"}) gives the higher-level definition priority.`,
    }));
}
