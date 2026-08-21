import type { PlatformPaths } from "../platform/index.js";
import type { Diagnostic, RuntimeEntity, RuntimeEntityKind, RuntimeScope } from "../runtime/types.js";

/** Everything an adapter needs to discover; nothing more. */
export interface DiscoveryContext {
  root: string;
  homeDir: string;
  platform: PlatformPaths;
  readFile(absPath: string): Promise<string | null>;
}

/**
 * One declared Devin source location (ADR-0002). The registry is data;
 * `docRef` cites the Devin doc the entry is derived from so version
 * drift is auditable.
 */
export interface SourceLocation {
  id: string;
  kind: RuntimeEntityKind;
  scope: RuntimeScope;
  /** Which base directory the glob resolves against. */
  base: "project" | "user-config" | "home" | "codeium" | "local-state";
  glob: string;
  /** Whether Devin documents how duplicates of this location resolve. */
  resolutionBasis: "documented" | "undocumented";
  docRef: string;
}

export interface SourceAdapter {
  id: string;
  detect(ctx: DiscoveryContext): Promise<boolean>;
  discover(ctx: DiscoveryContext): Promise<RuntimeEntity[]>;
  validate?(entities: RuntimeEntity[], ctx: DiscoveryContext): Promise<Diagnostic[]>;
}

/** Resolve a location's base directory from context. */
export function resolveBase(ctx: DiscoveryContext, base: SourceLocation["base"]): string {
  switch (base) {
    case "project":
      return ctx.root;
    case "user-config":
      return ctx.platform.devinUserConfigDir();
    case "home":
      return ctx.homeDir;
    case "codeium":
      return ctx.platform.codeiumChannelsDir();
    case "local-state":
      return ctx.platform.devinLocalStateDir();
  }
}
