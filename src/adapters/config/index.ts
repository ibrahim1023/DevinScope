import fg from "fast-glob";
import { join, relative } from "node:path";
import { parseJsonc } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { Diagnostic, RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter } from "../types.js";
import { CONFIG_LOCATIONS, KNOWN_CONFIG_KEYS, USER_ONLY_KEYS } from "./paths.js";

export function createConfigAdapter(): SourceAdapter {
  return {
    id: "config",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return discoverAll(ctx);
    },
    async validate(entities) {
      return validateConfig(entities);
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  for (const loc of CONFIG_LOCATIONS) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" ? relative(ctx.root, abs) : abs;
      const parsed = parseJsonc(content, { knownTopLevelKeys: KNOWN_CONFIG_KEYS });
      const metadata: Record<string, unknown> = { locationId: loc.id };
      if (parsed.ok) {
        metadata.keys = Object.keys(parsed.value);
        metadata.unknownFields = parsed.unknownFields;
      } else {
        metadata.parseError = parsed.error;
      }
      entities.push({
        id: entityId("config", loc.scope, displayPath),
        kind: "config",
        name: displayPath,
        sourcePath: displayPath,
        scope: loc.scope,
        status: parsed.ok ? "available" : "invalid",
        provenance: {
          sourceType: loc.scope === "global" ? "global-config" : "project-config",
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

async function validateConfig(entities: RuntimeEntity[]): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const e of entities) {
    if (e.status === "invalid") {
      diagnostics.push({
        code: "INVALID_JSON",
        title: "Malformed config file",
        severity: "ERROR",
        entityIds: [e.id],
        evidence: [e.sourcePath ?? e.name, String(e.metadata.parseError ?? "")],
        explanation: "The config file could not be parsed; Devin may ignore it entirely.",
        remediation: "Fix the JSON syntax in the file.",
      });
      continue;
    }
    const unknown = (e.metadata.unknownFields as string[] | undefined) ?? [];
    if (unknown.length > 0) {
      diagnostics.push({
        code: "UNKNOWN_FIELD",
        title: "Unrecognized config fields preserved but not interpreted",
        severity: "INFO",
        entityIds: [e.id],
        evidence: unknown,
        explanation: "DevinScope preserved these fields but does not currently interpret their semantics (they may be newer than this version).",
      });
    }
    if (e.scope !== "global") {
      const keys = (e.metadata.keys as string[] | undefined) ?? [];
      const misplaced = keys.filter((k) => USER_ONLY_KEYS.includes(k));
      if (misplaced.length > 0) {
        diagnostics.push({
          code: "MISPLACED_SETTING",
          title: "User-only settings found in project config",
          severity: "LOW",
          entityIds: [e.id],
          evidence: misplaced,
          explanation: `These settings are user-config only per Devin's documented level table and have no effect here: ${misplaced.join(", ")}.`,
          remediation: "Move them to ~/.config/devin/config.json.",
        });
      }
    }
  }
  return diagnostics;
}
