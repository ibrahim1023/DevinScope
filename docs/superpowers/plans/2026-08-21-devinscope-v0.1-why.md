# DevinScope v0.1 Milestone 2 — `why <thing>` Implementation Plan

**Goal:** `devinscope why skill:explain-diff-html` explains one entity's provenance, status, duplicates, related sources, and diagnostics — human-readable and `--json` (spec §8.2, §18–20, Story B).

**Architecture:** Pure lookup over the M1 runtime graph (`src/runtime/query.ts`), rendering in `src/render/why.ts`, wiring in `src/cli/index.ts`. No new discovery logic.

**Spec:** [design spec](../specs/2026-08-21-devinscope-v0.1-design.md) + internal product specification (§8.2, Story B).

## Global Constraints

- All M1 global constraints apply (determinism, redaction, layer rules, exit codes).
- Lookup must answer with evidence only: never claim why Devin *chose* something — report resolution status, not hidden reasoning (spec §5.3).
- Unknown entity → exit 2 with a did-you-mean list of nearest names.

## Tasks

### Task 1: `findEntities(graph, query)` — pure lookup

- Parse query: optional `kind:` prefix (`skill:`, `plugin:`, `mcp:`, `hook:`, `agent:`, `rule:`, `instruction:`, `config:`), then name.
- Match by exact name (and hook `event:matcher` names); return all matching entities sorted by scope rank.
- Returns `{ matches: RuntimeEntity[], suggestions: string[] }` — suggestions via substring match when empty.
- Tests: exact name, kind-prefixed, hook event matching, no-match suggestions, multiple same-name matches all returned.

### Task 2: `explainEntity(graph, entity)` — related-source assembly

- Duplicates: `metadata.duplicateOf` → resolved entities.
- Diagnostics touching the entity (entityIds contains id).
- Related instruction sources: all `instruction`/`rule` entities with status active/available.
- Relevant hooks: all hook entities (any PreToolUse/PostToolUse may affect execution).
- Plugin link: `provenance.pluginName` → the plugin entity.
- Shadowing: `provenance.overriddenBy` / `overrides` → resolved entities.
- Tests over a synthetic graph covering each relation.

### Task 3: `renderWhy` + `renderWhyJson` + CLI wiring

- Terminal layout follows Story B: resolved definition, scope, status, duplicates, related sources, hooks, potential issues (diagnostics), resolution note.
- `why <thing> [--json]`; exit 0 on match, 2 on no match/invalid invocation.
- All output redacted; bodies never printed (hashes + bytes only).
- CLI contract tests on the `demo-repo` fixture + golden `expected.why-output.txt` for `why skill:explain-diff-html`.

### Task 4: M2 gate

- `pnpm verify` green; Story B reproduced on demo-repo; README command table updated if flags changed (they don't — already documented).
