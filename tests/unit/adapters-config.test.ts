import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfigAdapter } from "../../src/adapters/config/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("config adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-config-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("discovers project and user config files as config entities", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), `{ "permissions": { "allow": ["Read(**)"] } }`);
    mkdirSync(join(home, ".config", "devin"), { recursive: true });
    writeFileSync(join(home, ".config", "devin", "config.json"), `{ "agent": { "model": "opus" } }`);

    const entities = await createConfigAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(2);
    expect(entities.map((e) => e.scope).sort()).toEqual(["global", "project"]);
    expect(entities.every((e) => e.kind === "config")).toBe(true);
  });

  it("flags user-only keys in project config as MISPLACED_SETTING (LOW)", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), `{ "agent": { "model": "opus" }, "permissions": {} }`);

    const adapter = createConfigAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    const misplaced = diagnostics.find((d) => d.code === "MISPLACED_SETTING")!;
    expect(misplaced.severity).toBe("LOW");
    expect(misplaced.evidence.join(" ")).toContain("agent");
  });

  it("preserves unknown fields and reports UNKNOWN_FIELD (INFO)", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), `{ "permissions": {}, "brandNewField": 42 }`);

    const adapter = createConfigAdapter();
    const entities = await adapter.discover(ctx(root, home));
    expect(entities[0]!.status).toBe("available");
    expect(entities[0]!.metadata.unknownFields).toEqual(["brandNewField"]);

    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.find((d) => d.code === "UNKNOWN_FIELD")!.severity).toBe("INFO");
  });

  it("marks invalid JSON as invalid entity + INVALID_JSON (ERROR) and keeps scanning other files", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), "{ broken");
    writeFileSync(join(root, ".devin", "config.local.json"), `{ "permissions": {} }`);

    const adapter = createConfigAdapter();
    const entities = await adapter.discover(ctx(root, home));
    expect(entities).toHaveLength(2);
    expect(entities.find((e) => e.status === "invalid")!.sourcePath).toContain("config.json");

    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.find((d) => d.code === "INVALID_JSON")!.severity).toBe("ERROR");
  });

  it("agent key in user config is NOT misplaced", async () => {
    mkdirSync(join(home, ".config", "devin"), { recursive: true });
    writeFileSync(join(home, ".config", "devin", "config.json"), `{ "agent": { "model": "opus" } }`);

    const adapter = createConfigAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.filter((d) => d.code === "MISPLACED_SETTING")).toEqual([]);
  });
});
