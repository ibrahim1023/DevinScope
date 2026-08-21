import fg from "fast-glob";
import { basename, join, relative } from "node:path";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter } from "../types.js";
import { INSTRUCTION_LOCATIONS } from "./paths.js";

export function createInstructionsAdapter(): SourceAdapter {
  return {
    id: "instructions",

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
  for (const loc of INSTRUCTION_LOCATIONS) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" ? relative(ctx.root, abs) : abs;
      entities.push({
        id: entityId(loc.kind, loc.scope, displayPath),
        kind: loc.kind,
        name: basename(match),
        sourcePath: displayPath,
        scope: loc.scope,
        status: "available",
        provenance: {
          sourceType: loc.scope === "global" ? "global-config" : "filesystem",
          sourcePath: displayPath,
          resolution: "direct",
          docRef: loc.docRef,
        },
        contentHash: sha256(content),
        metadata: { bytes: Buffer.byteLength(content, "utf8"), locationId: loc.id, body: content },
      });
    }
  }
  return entities;
}
