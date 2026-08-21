import { createAgentAdapter } from "../adapters/agents/index.js";
import { createConfigAdapter } from "../adapters/config/index.js";
import { createHookAdapter } from "../adapters/hooks/index.js";
import { createInstructionsAdapter } from "../adapters/instructions/index.js";
import { createMcpAdapter } from "../adapters/mcp/index.js";
import { createPluginAdapter } from "../adapters/plugins/index.js";
import { createSkillAdapter } from "../adapters/skills/index.js";
import type { DiscoveryContext, SourceAdapter } from "../adapters/types.js";
import { runDiagnostics } from "../diagnostics/index.js";
import { createPlatform, type PlatformPaths } from "../platform/index.js";
import { log } from "../platform/log.js";
import { resolveEntities } from "../resolution/index.js";
import { emptyGraph, sortGraph } from "../runtime/graph.js";
import type { Diagnostic, RuntimeEntity, RuntimeGraph } from "../runtime/types.js";

export function allAdapters(): SourceAdapter[] {
  return [
    createInstructionsAdapter(),
    createSkillAdapter(),
    createHookAdapter(),
    createMcpAdapter(),
    createConfigAdapter(),
    createPluginAdapter(),
    createAgentAdapter(),
  ];
}

export interface DiscoveryOptions {
  root: string;
  homeDir?: string;
  platform?: PlatformPaths;
}

/** discovery → resolution → diagnostics → normalized graph (spec §14). */
export async function runDiscovery(opts: DiscoveryOptions): Promise<RuntimeGraph> {
  const started = Date.now();
  const platform = opts.platform ?? createPlatform(opts.homeDir ? { homeDir: opts.homeDir } : undefined);
  const ctx: DiscoveryContext = {
    root: opts.root,
    homeDir: platform.homeDir(),
    platform,
    readFile: (p) => platform.readFile(p),
  };
  log.debug("discovery.start", { root: opts.root });

  const graph = emptyGraph(opts.root);
  let entities: RuntimeEntity[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const adapter of allAdapters()) {
    try {
      const found = await adapter.discover(ctx);
      log.debug("adapter.found", { adapter: adapter.id, count: found.length });
      entities.push(...found);
      if (adapter.validate) {
        diagnostics.push(...(await adapter.validate(found, ctx)));
      }
    } catch (err) {
      // an adapter failing must not take down the whole scan (spec §30)
      log.debug("adapter.error", { adapter: adapter.id, error: String(err) });
      diagnostics.push({
        code: "ADAPTER_FAILED",
        title: `Discovery adapter "${adapter.id}" failed`,
        severity: "HIGH",
        entityIds: [],
        evidence: [String(err)],
        explanation: "An unexpected error occurred while scanning this source category; results for it are incomplete.",
      });
    }
  }

  entities = resolveEntities(entities);
  graph.entities = entities;
  graph.diagnostics = diagnostics;
  graph.diagnostics = runDiagnostics(graph);
  graph.metrics = {
    instructionBytes: entities
      .filter((e) => e.kind === "instruction" || e.kind === "rule")
      .reduce((sum, e) => sum + ((e.metadata.bytes as number | undefined) ?? 0), 0),
    fileCount: entities.length,
  };
  log.debug("discovery.complete", { entities: entities.length, diagnostics: graph.diagnostics.length, ms: Date.now() - started });
  return sortGraph(graph);
}
