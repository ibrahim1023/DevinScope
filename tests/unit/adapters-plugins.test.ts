import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPluginAdapter } from "../../src/adapters/plugins/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("plugin adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;
  let cache: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-plugins-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    cache = join(home, ".local", "share", "devin", "cli", "plugins", "cache");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("discovers cached plugins with manifest, version and contribution counts", async () => {
    const pluginDir = join(cache, "github.com_acme_review-tools", "1.2.0");
    mkdirSync(join(pluginDir, ".devin-plugin"), { recursive: true });
    writeFileSync(join(pluginDir, ".devin-plugin", "plugin.json"), JSON.stringify({ name: "review-tools", version: "1.2.0" }));
    mkdirSync(join(pluginDir, "skills", "review"), { recursive: true });
    writeFileSync(join(pluginDir, "skills", "review", "SKILL.md"), "---\nname: review\n---\nbody\n");
    mkdirSync(join(pluginDir, "agents"), { recursive: true });
    writeFileSync(join(pluginDir, "agents", "auditor.md"), "---\nname: auditor\n---\nbody\n");
    writeFileSync(join(pluginDir, "hooks.json"), "{}");

    const entities = await createPluginAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(1);
    const p = entities[0]!;
    expect(p.kind).toBe("plugin");
    expect(p.name).toBe("review-tools");
    expect(p.scope).toBe("global");
    expect(p.provenance.sourceType).toBe("plugin");
    expect(p.metadata.version).toBe("1.2.0");
    expect(p.metadata.contributions).toEqual({ skills: 1, agents: 1, hooks: 1, mcps: 0, rules: 0 });
  });

  it("falls back to .claude-plugin/plugin.json when no .devin-plugin manifest exists", async () => {
    const pluginDir = join(cache, "github.com_acme_legacy", "0.9.0");
    mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
    writeFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "legacy" }));

    const entities = await createPluginAdapter().discover(ctx(root, home));
    expect(entities[0]!.name).toBe("legacy");
    expect(entities[0]!.metadata.manifestFormat).toBe("claude");
  });

  it("flags plugin directories without any manifest as PLUGIN_NO_MANIFEST (LOW)", async () => {
    const pluginDir = join(cache, "github.com_acme_broken", "0.1.0");
    mkdirSync(join(pluginDir, "skills"), { recursive: true });

    const adapter = createPluginAdapter();
    const entities = await adapter.discover(ctx(root, home));
    expect(entities[0]!.status).toBe("unknown");

    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.find((d) => d.code === "PLUGIN_NO_MANIFEST")!.severity).toBe("LOW");
  });

  it("discovers repo-level requiredPlugins from .devin/config.json", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), JSON.stringify({ requiredPlugins: ["acme/review-tools"] }));

    const entities = await createPluginAdapter().discover(ctx(root, home));
    const req = entities.find((e) => e.name === "acme/review-tools")!;
    expect(req.scope).toBe("project");
    expect(req.metadata.declared).toBe("required");
  });
});
