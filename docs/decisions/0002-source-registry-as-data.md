# ADR-0002: Source registry as data, one `paths.ts` per adapter

**Status:** Accepted (2026-08-21)
**Context:** Devin's configuration surface spans dozens of locations across user/project/compat scopes and changes release to release (e.g. MCP config moved out of `config.json` in v3000.3). Product-spec §11 and §32 require a centralized, evolvable registry and no scattered path assumptions.

**Decision:** Every adapter (`src/adapters/<name>/`) owns a `paths.ts` exporting a typed list of `SourceLocation { id, scope, glob, resolutionBasis, docRef }`. `docRef` cites the Devin documentation section the entry is derived from. Cross-cutting resolution of `~`, XDG, `%APPDATA%`, and project-root walking lives only in `src/platform/`.

**Consequences:**
- (+) When Devin changes a location, the diff is one data entry with a doc citation — directly implements spec §30 (version drift) and makes unsupported config an INFO diagnostic instead of a crash.
- (+) The registry doubles as living documentation of what DevinScope believes Devin reads.
- (−) Slight indirection vs. inline `fs` calls; worth it for auditability.
