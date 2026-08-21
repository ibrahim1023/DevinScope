/**
 * Core normalized model (spec §12–13). Pure data — this module imports
 * nothing else from the package.
 */
export type RuntimeEntityKind =
  | "instruction"
  | "rule"
  | "skill"
  | "hook"
  | "plugin"
  | "agent"
  | "mcp"
  | "config";

export type RuntimeScope =
  | "global"
  | "project"
  | "project-local"
  | "plugin"
  | "compatibility"
  | "session"
  | "unknown";

export type RuntimeStatus =
  | "active"
  | "available"
  | "shadowed"
  | "disabled"
  | "invalid"
  | "unknown";

/**
 * Evidence label for every claim (ADR-0003):
 * - direct: observed from a file
 * - documented-precedence: derived from documented Devin semantics (docRef cites the source)
 * - heuristic: conservative inference
 * - unknown: precedence not documented — never guessed
 */
export type Resolution = "direct" | "documented-precedence" | "heuristic" | "unknown";

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "ERROR";

export interface Provenance {
  sourceType:
    | "filesystem"
    | "plugin"
    | "global-config"
    | "project-config"
    | "local-state"
    | "derived";
  sourcePath?: string;
  pluginName?: string;
  resolution: Resolution;
  /** Documentation citation backing a documented-precedence claim. */
  docRef?: string;
  overriddenBy?: string[];
  overrides?: string[];
}

export interface RuntimeEntity {
  /** Stable identity: `${kind}:${scope}:${name}` */
  id: string;
  kind: RuntimeEntityKind;
  name: string;
  sourcePath?: string;
  scope: RuntimeScope;
  status: RuntimeStatus;
  provenance: Provenance;
  /** sha256 hex of the primary file content, when one exists. */
  contentHash?: string;
  metadata: Record<string, unknown>;
}

export interface Diagnostic {
  code: string;
  title: string;
  severity: Severity;
  entityIds: string[];
  /** Normalized paths / hashes — never secret values (spec §23). */
  evidence: string[];
  explanation: string;
  remediation?: string;
}

export interface RuntimeGraph {
  schema: "devinscope/v1";
  root: string;
  entities: RuntimeEntity[];
  diagnostics: Diagnostic[];
  metrics: { instructionBytes: number; fileCount: number };
}
