import fg from "fast-glob";
import { join, relative, sep } from "node:path";
import { parseJsonc } from "../../parsers/index.js";
import { entityId, sha256 } from "../../runtime/graph.js";
import type { Diagnostic, RuntimeEntity } from "../../runtime/types.js";
import { resolveBase, type DiscoveryContext, type SourceAdapter } from "../types.js";
import { PLUGIN_LOCATIONS } from "./paths.js";

const MANIFEST_CANDIDATES = [
  { path: ".devin-plugin/plugin.json", format: "devin" },
  { path: ".claude-plugin/plugin.json", format: "claude" },
  { path: "plugin.json", format: "agent-plugins" },
] as const;

export function createPluginAdapter(): SourceAdapter {
  return {
    id: "plugins",
    async detect(ctx) {
      return (await discoverAll(ctx)).length > 0;
    },
    async discover(ctx) {
      return discoverAll(ctx);
    },
    async validate(entities) {
      const diagnostics: Diagnostic[] = entities
        .filter((e) => e.metadata.manifestFormat === null)
        .map((e) => ({
          code: "PLUGIN_NO_MANIFEST",
          title: "Plugin directory has no recognized manifest",
          severity: "LOW" as const,
          entityIds: [e.id],
          evidence: [e.sourcePath ?? e.name],
          explanation: "No .devin-plugin/plugin.json, .claude-plugin/plugin.json, or plugin.json found; Devin may not load this plugin.",
          remediation: "Add a plugin manifest (see Devin plugin docs).",
        }));

      // Repo-required plugins that no installed plugin provides (name or repo tail match)
      const installed = entities.filter((e) => e.metadata.locationId === "plugin-cache");
      for (const req of entities.filter((e) => e.metadata.declared === "required")) {
        const tail = req.name.split("/").at(-1)!;
        const found = installed.some((p) => p.name === req.name || p.name === tail || String(p.metadata.cacheDir).includes(tail));
        if (!found) {
          diagnostics.push({
            code: "PLUGIN_REQUIRED_MISSING",
            title: "Repo requires a plugin that is not installed",
            severity: "MEDIUM",
            entityIds: [req.id],
            evidence: [req.name],
            explanation: `.devin/config.json requires "${req.name}" but no matching plugin is installed at user level; Devin would fail or skip the install.`,
            remediation: `Run: devin plugins install ${req.name}`,
          });
        }
      }
      return diagnostics;
    },
  };
}

async function discoverAll(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const entities: RuntimeEntity[] = [];
  const cacheLoc = PLUGIN_LOCATIONS[0]!;
  const cacheBase = join(resolveBase(ctx, cacheLoc.base), "cli", "plugins", "cache");
  const dirs = await fg("*/*", { cwd: cacheBase, onlyDirectories: true, dot: true }).catch(() => [] as string[]);
  for (const dir of dirs.sort()) {
    entities.push(...(await pluginFromDir(ctx, join(cacheBase, dir), dir)));
  }
  entities.push(...(await requiredPlugins(ctx)));
  return entities;
}

async function pluginFromDir(ctx: DiscoveryContext, dir: string, relDir: string): Promise<RuntimeEntity[]> {
  let manifest: Record<string, unknown> | null = null;
  let manifestFormat: string | null = null;
  let manifestPath: string | null = null;

  for (const candidate of MANIFEST_CANDIDATES) {
    const abs = join(dir, candidate.path);
    const content = await ctx.readFile(abs);
    if (content === null) continue;
    const parsed = parseJsonc(content);
    if (parsed.ok) {
      manifest = parsed.value;
      manifestFormat = candidate.format;
      manifestPath = abs;
      break;
    }
  }

  const [skills, agents, hooks, mcps, rules] = await Promise.all([
    fg("skills/*/SKILL.md", { cwd: dir, onlyFiles: true }),
    fg(["agents/*.md", "agents/*/AGENT.md"], { cwd: dir, onlyFiles: true }),
    fg("hooks.json", { cwd: dir, onlyFiles: true }),
    fg(["mcp_config.json", "mcp.json", ".mcp.json"], { cwd: dir, onlyFiles: true, dot: true }),
    fg(["AGENTS.md", "rules/*.md"], { cwd: dir, onlyFiles: true }),
  ]);

  const name = typeof manifest?.name === "string" ? manifest.name : relDir.split(sep).at(-2) ?? relDir;
  const displayPath = manifestPath ?? dir;
  const pluginEntity: RuntimeEntity = {
    id: entityId("plugin", "global", `${name}@${relDir}`),
    kind: "plugin",
    name,
    sourcePath: displayPath,
    scope: "global",
    status: manifest ? "available" : "unknown",
    provenance: {
      sourceType: "plugin",
      sourcePath: displayPath,
      resolution: manifest ? "direct" : "unknown",
      docRef: PLUGIN_LOCATIONS[0]!.docRef,
    },
    metadata: {
      locationId: "plugin-cache",
      manifestFormat,
      cacheDir: relDir,
      ...(typeof manifest?.version === "string" ? { version: manifest.version } : {}),
      contributions: { skills: skills.length, agents: agents.length, hooks: hooks.length, mcps: mcps.length, rules: rules.length },
    },
  };

  // Plugins inject instructions too: root AGENTS.md (always-on) and rules/*.md
  // (triggered) per plugins/overview.mdx — surface them as instruction/rule entities.
  const instructionEntities: RuntimeEntity[] = [];
  for (const rel of [...rules].sort()) {
    const abs = join(dir, rel);
    const content = await ctx.readFile(abs);
    if (content === null) continue;
    const isRuleFile = rel.startsWith("rules/");
    const kind = isRuleFile ? ("rule" as const) : ("instruction" as const);
    instructionEntities.push({
      id: entityId(kind, "plugin", `${name}:${rel}`),
      kind,
      name: `${name}:${rel}`,
      sourcePath: abs,
      scope: "plugin",
      status: "available",
      provenance: {
        sourceType: "plugin",
        sourcePath: abs,
        pluginName: name,
        resolution: "direct",
        docRef: PLUGIN_LOCATIONS[0]!.docRef,
      },
      contentHash: sha256(content),
      metadata: { locationId: "plugin-cache", bytes: Buffer.byteLength(content, "utf8"), body: content },
    });
  }

  return [pluginEntity, ...instructionEntities];
}

async function requiredPlugins(ctx: DiscoveryContext): Promise<RuntimeEntity[]> {
  const loc = PLUGIN_LOCATIONS[1]!;
  const abs = join(resolveBase(ctx, loc.base), ".devin", "config.json");
  const content = await ctx.readFile(abs);
  if (content === null) return [];
  const parsed = parseJsonc(content);
  if (!parsed.ok) return [];
  const required = parsed.value.requiredPlugins;
  if (!Array.isArray(required)) return [];
  const displayPath = relative(ctx.root, abs);
  return required
    .map((entry) => (typeof entry === "string" ? entry : (entry as { repo?: string }).repo))
    .filter((name): name is string => typeof name === "string")
    .map((name) => ({
      id: entityId("plugin", "project", `${name}@required`),
      kind: "plugin" as const,
      name,
      sourcePath: displayPath,
      scope: "project" as const,
      status: "available" as const,
      provenance: {
        sourceType: "project-config" as const,
        sourcePath: displayPath,
        resolution: "direct" as const,
        docRef: loc.docRef,
      },
      contentHash: sha256(content),
      metadata: { locationId: loc.id, declared: "required" },
    }));
}
