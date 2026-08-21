import fg from "fast-glob";
import { dirname, join, relative } from "node:path";
import { parseSkillFrontmatter } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter } from "../types.js";
import { SKILL_LOCATIONS } from "./paths.js";
import { toPosixPath } from "../../platform/index.js";

export function createSkillAdapter(): SourceAdapter {
  return {
    id: "skills",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return discoverAll(ctx);
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  for (const loc of SKILL_LOCATIONS) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" ? toPosixPath(relative(ctx.root, abs)) : toPosixPath(abs);
      const skillDir = dirname(abs);
      const supporting = await fg(["**/*", "!SKILL.md"], { cwd: skillDir, onlyFiles: true, dot: true });

      const parsed = parseSkillFrontmatter(content);
      const metadata: Record<string, unknown> = {
        locationId: loc.id,
        supportingFiles: supporting.length,
        bodyChars: parsed.ok ? parsed.value.body.length : content.length,
        unknownFields: parsed.ok ? parsed.unknownFields : [],
      };
      // codeium channel skills: record which channel contributed them
      const channelMatch = /(windsurf(?:-next|-insiders)?)/.exec(match);
      if (loc.id === "skills-codeium-global" && channelMatch) metadata.channel = channelMatch[1];

      if (!parsed.ok) {
        metadata.parseError = parsed.error;
      } else if (parsed.value.description !== undefined) {
        metadata.description = parsed.value.description;
      }

      const name = parsed.ok ? parsed.value.name : match.split("/").at(-2)!;
      entities.push({
        id: entityId("skill", loc.scope, `${name}@${displayPath}`),
        kind: "skill",
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
