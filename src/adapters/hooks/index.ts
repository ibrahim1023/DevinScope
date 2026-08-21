import fg from "fast-glob";
import { isAbsolute, join, relative } from "node:path";
import { existsSync } from "node:fs";
import { parseJsonc } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { Diagnostic, RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter, type SourceLocation } from "../types.js";
import { HOOK_LOCATIONS } from "./paths.js";

interface HookDef {
  type?: string;
  command?: string;
  prompt?: string;
  timeout?: number;
}

interface MatcherGroup {
  matcher?: string;
  hooks?: HookDef[];
}

/** Extract the hooks object: bare for hooks.v1.json, nested under "hooks" elsewhere. */
function hooksObjectOf(loc: SourceLocation, config: Record<string, unknown>): Record<string, MatcherGroup[]> {
  if (loc.id === "hooks-v1") return config as unknown as Record<string, MatcherGroup[]>;
  const hooks = config.hooks;
  return (typeof hooks === "object" && hooks !== null ? hooks : {}) as Record<string, MatcherGroup[]>;
}

export function createHookAdapter(): SourceAdapter {
  return {
    id: "hooks",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return discoverAll(ctx);
    },
    async validate(entities, ctx) {
      return validateHooks(entities, ctx);
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  for (const loc of HOOK_LOCATIONS) {
    const base = resolveBase(ctx, loc.base);
    const matches = await fg(loc.glob, { cwd: base, onlyFiles: true, dot: true });
    for (const match of matches.sort()) {
      const abs = join(base, match);
      const content = await ctx.readFile(abs);
      if (content === null) continue;
      const displayPath = loc.base === "project" ? relative(ctx.root, abs) : abs;

      const parsed = parseJsonc(content);
      if (!parsed.ok) {
        entities.push({
          id: entityId("hook", loc.scope, displayPath),
          kind: "hook",
          name: displayPath,
          sourcePath: displayPath,
          scope: loc.scope,
          status: "invalid",
          provenance: { sourceType: "filesystem", sourcePath: displayPath, resolution: "direct", docRef: loc.docRef },
          contentHash: sha256(content),
          metadata: { locationId: loc.id, parseError: parsed.error },
        });
        continue;
      }

      const hooksObj = hooksObjectOf(loc, parsed.value);
      for (const [event, groups] of Object.entries(hooksObj)) {
        if (!Array.isArray(groups)) continue;
        for (const [gi, group] of groups.entries()) {
          const matcher = group.matcher ?? "*";
          for (const [hi, hook] of (group.hooks ?? []).entries()) {
            const name = `${event}:${matcher}`;
            entities.push({
              id: entityId("hook", loc.scope, `${name}@${displayPath}#${gi}.${hi}`),
              kind: "hook",
              name,
              sourcePath: displayPath,
              scope: loc.scope,
              status: "available",
              provenance: { sourceType: "filesystem", sourcePath: displayPath, resolution: "direct", docRef: loc.docRef },
              contentHash: sha256(content),
              metadata: {
                locationId: loc.id,
                event,
                matcher: group.matcher ?? "",
                type: hook.type ?? "command",
                ...(hook.command !== undefined ? { command: hook.command } : {}),
                ...(hook.timeout !== undefined ? { timeout: hook.timeout } : {}),
              },
            });
          }
        }
      }
    }
  }
  return entities;
}

async function validateHooks(entities: RuntimeEntity[], ctx: DiscoveryContext): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const entity of entities) {
    if (entity.status === "invalid") {
      diagnostics.push({
        code: "INVALID_JSON",
        title: "Malformed hooks file",
        severity: "ERROR",
        entityIds: [entity.id],
        evidence: [entity.sourcePath ?? entity.name, String(entity.metadata.parseError ?? "")],
        explanation: "The hooks file could not be parsed; its hooks will not run.",
        remediation: "Fix the JSON syntax in the file.",
      });
      continue;
    }

    const matcher = entity.metadata.matcher;
    if (typeof matcher === "string" && matcher !== "") {
      try {
        new RegExp(matcher);
      } catch {
        diagnostics.push({
          code: "INVALID_HOOK_MATCHER",
          title: "Hook matcher is not a valid regex",
          severity: "MEDIUM",
          entityIds: [entity.id],
          evidence: [matcher],
          explanation: `Matcher "${matcher}" does not compile as a regular expression.`,
          remediation: "Fix or remove the matcher pattern.",
        });
      }
    }

    const command = entity.metadata.command;
    if (entity.metadata.type === "command" && typeof command === "string") {
      const broken = commandProblem(command, entity, ctx);
      if (broken) {
        diagnostics.push({
          code: "BROKEN_HOOK_CMD",
          title: "Hook command is broken",
          severity: "HIGH",
          entityIds: [entity.id],
          evidence: [entity.sourcePath ?? entity.name, command, broken],
          explanation: `Hook command cannot run: ${broken}.`,
          remediation: "Create the referenced script or fix the command path.",
        });
      }
    }
  }
  return diagnostics;
}

function commandProblem(command: string, entity: RuntimeEntity, ctx: DiscoveryContext): string | null {
  const firstToken = command.trim().split(/\s+/)[0]!;
  if (firstToken.startsWith("./") || firstToken.startsWith("../") || isAbsolute(firstToken)) {
    // Devin runs hook commands with DEVIN_PROJECT_DIR set to the project root
    const resolved = isAbsolute(firstToken) ? firstToken : join(ctx.root, firstToken);
    return existsSync(resolved) ? null : `${firstToken} does not exist`;
  }
  return ctx.platform.executableExists(firstToken) ? null : `${firstToken} not found in PATH`;
}
