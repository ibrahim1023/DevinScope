---
name: fixture-authoring
description: Add a new fixture scenario to DevinScope's test/eval corpus correctly. Use whenever creating or modifying directories under fixtures/.
allowed-tools:
  - read
  - write
  - edit
  - exec
---

# Authoring a fixture scenario

Fixtures are the product's test suite AND eval harness (ADR-0005). A scenario is complete only when all parts exist.

## Checklist

1. **Create `fixtures/<scenario-name>/`** — kebab-case, named after the pattern it exercises (e.g. `duplicate-skills`, not `test1`).
2. **`input/`** — the filesystem to scan. Project files at the root; global-scope files under `input/home/` (the harness maps it to a fake `$HOME`). Use real Devin config layouts — check the adapter's `paths.ts` registry, never invent locations.
3. **`expected.graph.json`** — normalized `RuntimeEntity[]`: stable IDs (`<kind>:<scope>:<name>`), provenance with `resolution` basis, paths written as `<ROOT>/...` or `<HOME>/...`.
4. **`expected.diagnostics.json`** — exact codes, severities, affected entity IDs, evidence paths (normalized).
5. **`expected.output.txt`** (CLI-level scenarios only) — golden terminal output with colors stripped.
6. **Explicit assertions** in the scenario's test: entity counts, statuses, diagnostic severities — so a golden update can't silently change semantics.
7. **`NOTES.md`** — cite the Devin doc section or observed CLI version each behavior assumption comes from (spec §30 evidence rule). If a behavior is undocumented, say so and assert `resolution: "unknown"` rather than guessing.
8. Run `pnpm eval` — the new scenario must be green without touching any other scenario.

## Anti-patterns

- Absolute machine paths, real timestamps, or real secrets in fixtures (use canaries like `ghp_CANARY_...` when testing redaction).
- Asserting `shadowed` for skill/agent/instruction duplicates — Devin does not document that precedence (ADR-0003).
- Updating goldens to make a failing scenario pass without reviewing the semantic diff.
