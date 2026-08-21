import fg from "fast-glob";
import { basename, dirname, join, relative } from "node:path";
import { parseSkillFrontmatter } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter } from "../types.js";
import { AGENT_LOCATIONS, BUILTIN_PROFILES } from "./paths.js";

export function createAgentAdapter(): SourceAdapter {
  return {
    id: "agents",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return discoverAll(ctx);
    },
    async validate(entities) {
      return entities
        .filter((e) => BUILTIN_PROFILES.includes(e.name))
        .map((e) => ({
          code: "AGENT_BUILTIN_CONFLICT",
          title: "Custom subagent conflicts with a built-in profile",
          severity: "MEDIUM" as const,
          entityIds: [e.id],
          evidence: [e.sourcePath ?? e.name],
          explanation: `"${e.name}" conflicts with a built-in profile; it is skipped with a warning by Devin, so this definition never runs.`,
          remediation: "Rename the custom subagent.",
        }));
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  for (const loc of AGENT_LOCATIONS) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" || loc.base === undefined ? relative(ctx.root, abs) : abs;

      const parsed = parseSkillFrontmatter(content);
      const fallbackName = basename(match).startsWith("AGENT") || basename(match).startsWith("agent")
        ? basename(dirname(abs))
        : basename(match, ".md");
      const metadata: Record<string, unknown> = { locationId: loc.id };
      if (parsed.ok) {
        if (parsed.value.description !== undefined) metadata.description = parsed.value.description;
        if (typeof parsed.value.raw.model === "string") metadata.model = parsed.value.raw.model;
        if (Array.isArray(parsed.value.raw["allowed-tools"])) metadata.allowedTools = parsed.value.raw["allowed-tools"];
      } else {
        metadata.parseError = parsed.error;
      }
      const name = parsed.ok ? parsed.value.name : fallbackName;

      entities.push({
        id: entityId("agent", loc.scope, `${name}@${displayPath}`),
        kind: "agent",
        name,
        sourcePath: displayPath,
        scope: loc.scope,
        status: parsed.ok ? "available" : "invalid",
        provenance: {
          sourceType: loc.scope === "global" ? "global-config" : "filesystem",
          sourcePath: displayPath,
          resolution: "direct",
          docRef: loc.docRef,
        },
        contentHash: sha256(content),
        metadata,
      });
    }
  }
  return entities;
}
