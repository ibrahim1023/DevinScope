import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(REPO_ROOT, "dist", "cli.js");
const FIXTURES = join(REPO_ROOT, "fixtures");

interface Run {
  root: string;
  home: string;
  tmp: string;
}

function stageFixture(name: string): Run {
  const src = join(FIXTURES, name, "input");
  const tmp = mkdtempSync(join(tmpdir(), `devinscope-cli-${name}-`));
  const root = join(tmp, "project");
  const home = join(tmp, "home");
  if (existsSync(join(src, "project"))) cpSync(join(src, "project"), root, { recursive: true });
  if (existsSync(join(src, "home"))) cpSync(join(src, "home"), home, { recursive: true });
  return { root, home, tmp };
}

async function doctor(run: Run, args: string[] = []) {
  return execa("node", [CLI, "doctor", ...args], {
    cwd: run.root,
    env: { DEVINSCOPE_HOME: run.home },
    reject: false,
    stripFinalNewline: false,
  });
}

const tmps: string[] = [];

beforeAll(async () => {
  await execa("pnpm", ["build"], { cwd: REPO_ROOT });
}, 60_000);

afterAll(() => {
  for (const t of tmps) rmSync(t, { recursive: true, force: true });
});

describe("doctor CLI", () => {
  it("clean project: exit 0, summary shows entity counts and no diagnostics", async () => {
    const run = stageFixture("clean-project");
    tmps.push(run.tmp);
    const r = await doctor(run);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("DEVINSCOPE DOCTOR");
    expect(r.stdout).toMatch(/no diagnostics/i);
    expect(r.stdout).toContain("skill");
  });

  it("broken hook: exit 1, HIGH diagnostic printed with evidence (spec §25)", async () => {
    const run = stageFixture("broken-hook");
    tmps.push(run.tmp);
    const r = await doctor(run);
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toContain("HIGH");
    expect(r.stdout).toContain("BROKEN_HOOK_CMD");
    expect(r.stdout).toContain("scripts/filter-context.sh");
  });

  it("duplicate skills: exit 0 by default, exit 1 with --strict", async () => {
    const run = stageFixture("duplicate-skills");
    tmps.push(run.tmp);
    expect((await doctor(run)).exitCode).toBe(0);
    const strict = await doctor(run, ["--strict"]);
    expect(strict.exitCode).toBe(1);
    expect(strict.stdout).toContain("DUP_SKILL");
  });

  it("--json emits schema-valid, redacted JSON on stdout", async () => {
    const run = stageFixture("broken-mcp");
    tmps.push(run.tmp);
    const r = await doctor(run, ["--json"]);
    expect(r.exitCode).toBe(1); // MCP_CMD_MISSING is HIGH
    const parsed = JSON.parse(r.stdout);
    expect(parsed.schema).toBe("devinscope/v1");
    expect(parsed.entities.length).toBeGreaterThan(0);
    expect(parsed.diagnostics.map((d: { code: string }) => d.code)).toContain("MCP_CMD_MISSING");
    // bodies stripped, hashes present
    expect(parsed.entities[0].metadata.body).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain("DEVINSCOPE_FIXTURE_UNSET_VAR_VALUE");
  });

  it("matches the clean-project terminal golden", async () => {
    const run = stageFixture("clean-project");
    tmps.push(run.tmp);
    const r = await doctor(run);
    const golden = readFileSync(join(FIXTURES, "clean-project", "expected.output.txt"), "utf8");
    const normalized = r.stdout.replaceAll(run.root, "<ROOT>").replaceAll(run.home, "<HOME>");
    expect(normalized).toBe(golden);
  });

  it("unknown command exits 2 (invalid invocation)", async () => {
    const r = await execa("node", [CLI, "frobnicate"], { reject: false });
    expect(r.exitCode).toBe(2);
  });

  it("--debug writes structured JSON logs to stderr, never stdout", async () => {
    const run = stageFixture("clean-project");
    tmps.push(run.tmp);
    const r = await doctor(run, ["--debug"]);
    const lines = r.stderr.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.event).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});
