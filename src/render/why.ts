import pc from "picocolors";
import type { Explanation } from "../diagnostics/explain.js";
import type { RuntimeEntity } from "../runtime/types.js";
import { redactText } from "../security/redact.js";
import { formatBytes } from "./doctor.js";

function entityLine(e: RuntimeEntity): string {
  return `${e.sourcePath ?? e.id} (${e.scope}, ${e.status})`;
}

/** Terminal rendering of a `why` answer — layout follows spec Story B. */
export function renderWhy(ex: Explanation, opts: { color: boolean }): string {
  const e = ex.entity;
  const bold = (s: string) => (opts.color ? pc.bold(s) : s);
  const out: string[] = [];

  out.push(bold(`WHY: ${e.name}`));
  out.push(`Kind: ${e.kind}`);
  out.push("");

  out.push("Definition");
  out.push(`  ${e.sourcePath ?? e.id}`);
  out.push("");
  out.push(`Scope: ${e.scope}`);
  out.push(`Status: ${e.status}`);
  out.push(`Resolution: ${e.provenance.resolution}${e.provenance.docRef ? ` (${e.provenance.docRef})` : ""}`);
  if (e.contentHash) out.push(`Hash: ${e.contentHash.slice(0, 12)}…`);
  const bytes = e.metadata.bytes as number | undefined;
  const bodyChars = e.metadata.bodyChars as number | undefined;
  if (bytes !== undefined || bodyChars !== undefined) {
    out.push(`Size: ${formatBytes(bytes ?? bodyChars ?? 0)}`);
  }
  if (ex.plugin) out.push(`Plugin: ${ex.plugin.name}${ex.plugin.metadata.version ? `@${ex.plugin.metadata.version}` : ""}`);

  if (ex.duplicates.length > 0) {
    out.push("");
    out.push("Also discovered");
    for (const d of ex.duplicates) out.push(`  ${entityLine(d)}`);
  }
  if (ex.shadowedBy.length > 0) {
    out.push("");
    out.push("Shadowed by");
    for (const s of ex.shadowedBy) out.push(`  ${entityLine(s)}`);
  }
  if (ex.shadows.length > 0) {
    out.push("");
    out.push("Shadows");
    for (const s of ex.shadows) out.push(`  ${entityLine(s)}`);
  }
  if (ex.relatedInstructions.length > 0) {
    out.push("");
    out.push("Related instruction sources");
    for (const r of ex.relatedInstructions) out.push(`  ${entityLine(r)}`);
  }
  if (ex.relevantHooks.length > 0) {
    out.push("");
    out.push("Hooks that may affect execution");
    for (const h of ex.relevantHooks) out.push(`  ${h.name} — ${h.sourcePath ?? h.id}`);
  }
  if (ex.diagnostics.length > 0) {
    out.push("");
    out.push("Diagnostics");
    for (const d of ex.diagnostics) {
      out.push(`  [${d.severity}] ${d.code} — ${d.title}`);
      for (const ev of d.evidence) out.push(`    ${ev}`);
      if (d.remediation) out.push(`    → ${d.remediation}`);
    }
  }

  out.push("");
  out.push(
    e.provenance.resolution === "unknown"
      ? "Note: Devin does not document precedence for this entity kind; all candidates are shown, none declared the winner."
      : "Note: provenance reflects observed files and documented Devin semantics only.",
  );
  return redactText(out.join("\n")) + "\n";
}

/** JSON contract for why: full explanation minus bodies (redacted). */
export function renderWhyJson(ex: Explanation): string {
  const strip = (e: RuntimeEntity): RuntimeEntity => {
    const { body: _stripped, ...rest } = e.metadata as Record<string, unknown> & { body?: unknown };
    return { ...e, metadata: rest };
  };
  const payload = {
    schema: "devinscope/v1" as const,
    entity: strip(ex.entity),
    duplicates: ex.duplicates.map(strip),
    shadowedBy: ex.shadowedBy.map(strip),
    shadows: ex.shadows.map(strip),
    relatedInstructions: ex.relatedInstructions.map(strip),
    relevantHooks: ex.relevantHooks.map(strip),
    diagnostics: ex.diagnostics,
    ...(ex.plugin ? { plugin: strip(ex.plugin) } : {}),
  };
  return redactText(JSON.stringify(payload, null, 2)) + "\n";
}
