import pc from "picocolors";
import type { Diagnostic, RuntimeGraph, Severity } from "../runtime/types.js";

const SEVERITIES: Severity[] = ["ERROR", "HIGH", "MEDIUM", "LOW", "INFO"];

function paint(color: boolean, severity: Severity, text: string): string {
  if (!color) return text;
  switch (severity) {
    case "ERROR": return pc.bgRed(pc.black(text));
    case "HIGH": return pc.red(text);
    case "MEDIUM": return pc.yellow(text);
    case "LOW": return pc.cyan(text);
    case "INFO": return pc.dim(text);
  }
}

function renderDiagnostic(d: Diagnostic, color: boolean): string[] {
  const head = `${d.code} — ${d.title}`;
  const lines = [`  ${color ? pc.bold(head) : head}`];
  for (const ev of d.evidence) lines.push(`    ${ev}`);
  if (d.remediation) lines.push(`    → ${d.remediation}`);
  return lines;
}

export function renderDoctor(graph: RuntimeGraph, opts: { color: boolean }): string {
  const out: string[] = ["DEVINSCOPE DOCTOR", ""];

  if (graph.diagnostics.length === 0) {
    out.push("No diagnostics.", "");
  } else {
    for (const severity of SEVERITIES) {
      const group = graph.diagnostics.filter((d) => d.severity === severity);
      if (group.length === 0) continue;
      out.push(paint(opts.color, severity, severity));
      for (const d of group) out.push(...renderDiagnostic(d, opts.color));
      out.push("");
    }
  }

  const byKind = new Map<string, number>();
  for (const e of graph.entities) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
  const kinds = [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${n} ${k}`).join(", ");

  out.push("SUMMARY");
  out.push(`${graph.entities.length} entities${kinds ? ` — ${kinds}` : ""}`);
  out.push(`Static instruction footprint: ${formatBytes(graph.metrics.instructionBytes)}`);

  const counts = SEVERITIES.map((s) => [s, graph.diagnostics.filter((d) => d.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
  if (counts) out.push(`Diagnostics: ${counts}`);

  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** doctor exit code: 1 on HIGH/ERROR; --strict also on MEDIUM (spec §25 ruling). */
export function doctorExitCode(diagnostics: Diagnostic[], strict: boolean): number {
  const severities = new Set(diagnostics.map((d) => d.severity));
  if (severities.has("ERROR") || severities.has("HIGH")) return 1;
  if (strict && severities.has("MEDIUM")) return 1;
  return 0;
}
