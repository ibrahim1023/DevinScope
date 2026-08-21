# Evals

DevinScope is deterministic: for a given filesystem state, the correct graph and diagnostics are exactly definable. The evaluation harness is therefore the **fixture corpus scored as a gate**, not an LLM-judged loop (see ADR-0005; LLM evals are deferred until the optional `--semantic` mode, product-spec §10).

## What we evaluate

| Signal | How measured | Gate |
| --- | --- | --- |
| Discovery completeness | Every entity in `expected.graph.json` found with correct kind/scope/provenance | 100% |
| Diagnostic precision | No diagnostics emitted beyond `expected.diagnostics.json` | 100% |
| Diagnostic recall | Every expected diagnostic emitted with correct severity + evidence | 100% |
| Resolution honesty | No entity marked `shadowed` unless its `resolutionBasis` cites documented precedence (ADR-0003) | 100% — lint rule over expected files |
| Secret safety | Canary secrets never leak (tests/security) | 100% |
| Rendering stability | `expected.output.txt` goldens match | 100% |
| Performance | `doctor` on `demo-repo` fixture completes < 1s (spec §33) | CI benchmark, non-blocking warning |

## How to run

```bash
pnpm eval          # alias: vitest run tests/evals — corpus score report
```

The eval reporter prints per-scenario results and per-diagnostic-class precision/recall, e.g.:

```
fixtures: 8/8 green
duplicates:      precision 1.00  recall 1.00
broken-hooks:    precision 1.00  recall 1.00
mcp:             precision 1.00  recall 0.75  ← regression here
```

## Adding a scenario

Use the `fixture-authoring` skill. A scenario is only complete when input + expected graph + expected diagnostics exist and the explicit assertions pass. Fixtures derived from real Devin behavior must cite the doc or observed CLI version in a `NOTES.md` inside the fixture (spec §30 evidence rule).

## Dogfood loop

The `demo-repo` fixture (spec §39) is the standing dogfood case: run `pnpm build && node dist/cli.js doctor` against it before every release and confirm the summary counts match the spec's expected output (`2 conflicts, 1 duplicate/shadowed skill, 1 broken hook, 1 unavailable MCP, 7 instruction sources`).
