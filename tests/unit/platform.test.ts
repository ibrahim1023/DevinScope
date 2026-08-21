import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPlatform } from "../../src/platform/index.js";

describe("platform", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-platform-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("devinUserConfigDir follows XDG under an overridden home", () => {
    const p = createPlatform({ homeDir: "/fake" });
    expect(p.devinUserConfigDir()).toBe(join("/fake", ".config", "devin"));
  });

  it("devinLocalStateDir resolves under home", () => {
    const p = createPlatform({ homeDir: "/fake" });
    expect(p.devinLocalStateDir()).toBe(join("/fake", ".local", "share", "devin"));
  });

  it("codeiumChannelsDir resolves under home", () => {
    const p = createPlatform({ homeDir: "/fake" });
    expect(p.codeiumChannelsDir()).toBe(join("/fake", ".codeium"));
  });

  it("findProjectRoot walks up to the nearest .git ancestor", () => {
    mkdirSync(join(tmp, "repo", ".git"), { recursive: true });
    mkdirSync(join(tmp, "repo", "a", "b"), { recursive: true });
    const p = createPlatform({ homeDir: tmp });
    expect(p.findProjectRoot(join(tmp, "repo", "a", "b"))).toBe(join(tmp, "repo"));
  });

  it("findProjectRoot detects .jj roots too", () => {
    mkdirSync(join(tmp, "repo", ".jj"), { recursive: true });
    const p = createPlatform({ homeDir: tmp });
    expect(p.findProjectRoot(join(tmp, "repo"))).toBe(join(tmp, "repo"));
  });

  it("findProjectRoot returns null when no VCS root exists", () => {
    const p = createPlatform({ homeDir: tmp });
    expect(p.findProjectRoot(tmp)).toBeNull();
  });

  it("executableExists finds node and rejects a bogus binary", () => {
    const p = createPlatform({ homeDir: tmp });
    expect(p.executableExists("node")).toBe(true);
    expect(p.executableExists("definitely-not-a-real-binary-xyz")).toBe(false);
  });

  it("homeDir defaults to os.homedir and honors override", () => {
    expect(createPlatform({ homeDir: tmp }).homeDir()).toBe(tmp);
    expect(createPlatform().homeDir()).toBe(homedir());
  });

  it("readFile returns null for missing files and content for present ones", async () => {
    writeFileSync(join(tmp, "a.txt"), "hello");
    const p = createPlatform({ homeDir: tmp });
    await expect(p.readFile(join(tmp, "a.txt"))).resolves.toBe("hello");
    await expect(p.readFile(join(tmp, "missing.txt"))).resolves.toBeNull();
  });
});
