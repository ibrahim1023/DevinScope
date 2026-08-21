import { existsSync } from "node:fs";
import fg from "fast-glob";
import { join, relative } from "node:path";
import { parseJsonc } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { Diagnostic, RuntimeEntity } from "../../runtime/types.js";
import { redactEnv } from "../../security/redact.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter, type SourceLocation } from "../types.js";
import { MCP_LEGACY_LOCATIONS, MCP_LOCATIONS, PRECEDENCE_DOC } from "./paths.js";

interface McpServerDef {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  disabled?: boolean;
  headers?: Record<string, string>;
}

/** Documented precedence (global-vs-local.mdx): local > project > user. */
const SCOPE_RANK: Record<string, number> = { "project-local": 0, project: 1, global: 2 };

export function createMcpAdapter(): SourceAdapter {
  return {
    id: "mcp",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return applyDocumentedPrecedence(await discoverAll(ctx));
    },
    async validate(entities, ctx) {
      return validateMcp(entities, ctx);
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  for (const [loc, legacy] of [
    ...MCP_LOCATIONS.map((l) => [l, false] as const),
    ...MCP_LEGACY_LOCATIONS.map((l) => [l, true] as const),
  ]) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" ? relative(ctx.root, abs) : abs;
      const parsed = parseJsonc(content);
      if (!parsed.ok) {
        entities.push(invalidEntity(loc, displayPath, content, parsed.error));
        continue;
      }
      const servers = (parsed.value.mcpServers ?? {}) as Record<string, McpServerDef>;
      for (const [name, def] of Object.entries(servers)) {
        entities.push(serverEntity(loc, displayPath, content, name, def, legacy));
      }
    }
  }
  return entities;
}

function baseMeta(loc: SourceLocation, displayPath: string, content: string, legacy: boolean): Pick<RuntimeEntity, "sourcePath" | "scope" | "provenance" | "contentHash"> & { metadata: Record<string, unknown> } {
  return {
    sourcePath: displayPath,
    scope: loc.scope,
    provenance: {
      sourceType: loc.scope === "global" ? "global-config" : "project-config",
      sourcePath: displayPath,
      resolution: "direct",
      docRef: loc.docRef,
    },
    contentHash: sha256(content),
    metadata: { locationId: loc.id, legacy },
  };
}

function invalidEntity(loc: SourceLocation, displayPath: string, content: string, parseError: string): RuntimeEntity {
  return {
    ...baseMeta(loc, displayPath, content, false),
    id: entityId("mcp", loc.scope, displayPath),
    kind: "mcp",
    name: displayPath,
    status: "invalid",
    metadata: { locationId: loc.id, parseError },
  };
}

function serverEntity(loc: SourceLocation, displayPath: string, content: string, name: string, def: McpServerDef, legacy: boolean): RuntimeEntity {
  const transport = def.url ? (def.transport === "sse" ? "sse" : "http") : "stdio";
  return {
    ...baseMeta(loc, displayPath, content, legacy),
    id: entityId("mcp", loc.scope, `${name}@${displayPath}`),
    kind: "mcp",
    name,
    status: def.disabled ? "disabled" : "available",
    metadata: {
      locationId: loc.id,
      legacy,
      transport,
      ...(def.command !== undefined ? { command: def.command } : {}),
      ...(def.url !== undefined ? { url: def.url } : {}),
      ...(def.env ? { env: redactEnv(def.env) } : {}),
      ...(def.env ? { envRefs: extractEnvRefs(def.env) } : {}),
      ...(def.disabled !== undefined ? { disabled: def.disabled } : {}),
    },
  };
}

function extractEnvRefs(env: Record<string, string>): string[] {
  return Object.values(env)
    .map((v) => /^\$\{env:([^}]+)\}$/.exec(v)?.[1])
    .filter((v): v is string => v !== undefined);
}

/** Merged by name: highest-priority scope active, others shadowed (documented). */
function applyDocumentedPrecedence(entities: RuntimeEntity[]): RuntimeEntity[] {
  const byName = new Map<string, RuntimeEntity[]>();
  for (const e of entities) {
    if (e.status === "invalid") continue;
    byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (SCOPE_RANK[a.scope] ?? 9) - (SCOPE_RANK[b.scope] ?? 9));
    const [winner, ...losers] = group;
    for (const e of group) {
      e.provenance.resolution = "documented-precedence";
      e.provenance.docRef = PRECEDENCE_DOC;
    }
    if (winner!.status !== "disabled") winner!.status = "active";
    for (const loser of losers) {
      if (loser.status === "disabled") continue;
      loser.status = "shadowed";
      loser.provenance.overriddenBy = [winner!.id];
      winner!.provenance.overrides = [...(winner!.provenance.overrides ?? []), loser.id];
    }
  }
  return entities;
}

async function validateMcp(entities: RuntimeEntity[], ctx: DiscoveryContext): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const e of entities) {
    if (e.status === "invalid") {
      diagnostics.push({
        code: "INVALID_JSON",
        title: "Malformed MCP config file",
        severity: "ERROR",
        entityIds: [e.id],
        evidence: [e.sourcePath ?? e.name, String(e.metadata.parseError ?? "")],
        explanation: "The MCP config file could not be parsed.",
        remediation: "Fix the JSON syntax in the file.",
      });
      continue;
    }
    if (e.metadata.legacy === true) {
      diagnostics.push({
        code: "MCP_LEGACY_LOCATION",
        title: "MCP server in legacy config location",
        severity: "INFO",
        entityIds: [e.id],
        evidence: [e.sourcePath ?? e.name],
        explanation: "Since Devin v3000.3, servers live in dedicated mcp_config.json files; Devin migrates this key automatically on startup.",
      });
    }
    const refs = (e.metadata.envRefs as string[] | undefined) ?? [];
    const missing = refs.filter((name) => process.env[name] === undefined);
    if (missing.length > 0) {
      diagnostics.push({
        code: "MCP_MISSING_ENV",
        title: "MCP server references unset environment variables",
        severity: "MEDIUM",
        entityIds: [e.id],
        evidence: missing,
        explanation: `Server "${e.name}" references environment variable name(s) not present in this environment: ${missing.join(", ")}.`,
        remediation: "Set the variable(s) or adjust the server config.",
      });
    }
    if (typeof e.metadata.url === "string" && !/^https?:\/\/.+/.test(e.metadata.url)) {
      diagnostics.push({
        code: "MCP_BAD_URL",
        title: "MCP server URL looks malformed",
        severity: "MEDIUM",
        entityIds: [e.id],
        evidence: [e.metadata.url],
        explanation: `URL "${e.metadata.url}" is not a valid http(s) URL.`,
      });
    }
    if (e.metadata.transport === "stdio" && typeof e.metadata.command === "string") {
      const cmd = e.metadata.command;
      const isPath = cmd.startsWith("./") || cmd.startsWith("../") || cmd.startsWith("/");
      if (isPath) {
        if (!existsSync(cmd)) {
          diagnostics.push(missingCmdDiag(e, `${cmd} does not exist`));
        }
      } else if (!ctx.platform.executableExists(cmd)) {
        diagnostics.push(missingCmdDiag(e, `${cmd} not found in PATH`));
      }
    }
  }
  return diagnostics;
}

function missingCmdDiag(e: RuntimeEntity, reason: string): Diagnostic {
  return {
    code: "MCP_CMD_MISSING",
    title: "MCP stdio command not available",
    severity: "HIGH",
    entityIds: [e.id],
    evidence: [e.sourcePath ?? e.name, reason],
    explanation: `Server "${e.name}" cannot start: ${reason}.`,
    remediation: "Install the command or fix the path.",
  };
}

