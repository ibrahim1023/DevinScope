# demo-repo

Spec §39 dogfood scenario:
- 7 instruction sources: global AGENTS.md, project AGENTS.md, project
  AGENTS.local.md, .devin/rules/tests.md, plugin teamkit AGENTS.md,
  plugin rules/deploy.md, ~/.claude/CLAUDE.md
- 2 modal conflicts (test scope; Friday deploys) → CONFLICT_MODAL x2
- 1 duplicate skill (explain-diff-html, project vs global, different bodies)
- 1 broken hook (missing ./scripts/filter-context.sh)
- 1 unavailable MCP (./bin/internal-mcp.sh does not exist)
- 1 project-local override (.devin/config.local.json)
