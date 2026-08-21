import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDiscovery } from "../../src/discovery/index.js";
import type { RuntimeGraph } from "../../src/runtime/types.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");

export interface FixtureRun {
  graph: RuntimeGraph;
  tmp: string;
  cleanup(): void;
}

/**
 * Copy fixtures/<name>/input to a temp dir, mapping:
 *   input/project/** → <tmp>/project (the repo root)
 *   input/home/**    → <tmp>/home    (fake $HOME)
 * Then run the production discovery pipeline (src/discovery).
 */
export async function runFixture(name: string): Promise<FixtureRun> {
  const src = join(FIXTURES_DIR, name, "input");
  const tmp = mkdtempSync(join(tmpdir(), `devinscope-fixture-${name}-`));
  const root = join(tmp, "project");
  const home = join(tmp, "home");
  if (existsSync(join(src, "project"))) cpSync(join(src, "project"), root, { recursive: true });
  if (existsSync(join(src, "home"))) cpSync(join(src, "home"), home, { recursive: true });

  const graph = await runDiscovery({ root, homeDir: home });
  return { graph, tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/** Replace volatile absolute paths with <ROOT>/<HOME> for stable goldens. */
export function normalizeGraph(graph: RuntimeGraph, tmp: string): RuntimeGraph {
  const text = JSON.stringify(graph)
    .replaceAll(join(tmp, "project"), "<ROOT>")
    .replaceAll(join(tmp, "home"), "<HOME>")
    // any remaining absolute fixture paths (entities outside root/home are impossible, but be safe)
    .replaceAll(join(FIXTURES_DIR), "<FIXTURES>");
  return JSON.parse(text) as RuntimeGraph;
}

/** Serializations used by golden files: entities and diagnostics separately. */
export function expectedPaths(name: string): { graph: string; diagnostics: string } {
  return {
    graph: join(FIXTURES_DIR, name, "expected.graph.json"),
    diagnostics: join(FIXTURES_DIR, name, "expected.diagnostics.json"),
  };
}

export function readExpected(name: string): { entities: unknown; diagnostics: unknown } {
  const paths = expectedPaths(name);
  return {
    entities: JSON.parse(readFileSync(paths.graph, "utf8")),
    diagnostics: JSON.parse(readFileSync(paths.diagnostics, "utf8")),
  };
}

export function writeExpected(name: string, graph: RuntimeGraph): void {
  const paths = expectedPaths(name);
  writeFileSync(paths.graph, JSON.stringify({ schema: graph.schema, entities: graph.entities, metrics: graph.metrics }, null, 2) + "\n");
  writeFileSync(paths.diagnostics, JSON.stringify(graph.diagnostics, null, 2) + "\n");
}

export function listFixtures(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
