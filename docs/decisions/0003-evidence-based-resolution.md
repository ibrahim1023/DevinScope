# ADR-0003: Evidence-based resolution — never guess precedence

**Status:** Accepted (2026-08-21)
**Context:** Product-spec §5.3/§15: conservative correctness beats pretending to know. Devin's docs document precedence for config (`org > session > project-local > project > user`), MCP (merged by name), and hooks (collected, all run), but do **not** document shadowing order for same-named skills, agents, or instruction files across scopes.

**Decision:** `Provenance.resolution` is one of `direct | documented-precedence | heuristic | unknown`. Shadowing (`status: "shadowed"`) is set only where the docs establish precedence — today: config keys and MCP servers. For skills/agents/instructions, duplicates are all reported as `available` with `resolution: "unknown"` plus a MEDIUM duplicate diagnostic listing every candidate. Inference (e.g. modal-directive conflicts) is always labeled `heuristic` with a confidence field.

**Consequences:**
- (+) Output is always defensible; every claim can be traced to a doc citation or labeled as inference. This is the product's core trust property.
- (−) Users sometimes get "unknown" where they'd prefer a verdict; mitigated by showing all candidates with full provenance so they can decide.
