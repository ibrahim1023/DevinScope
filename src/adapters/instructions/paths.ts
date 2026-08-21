import type { SourceLocation } from "../types.js";

const RULES_DOC = "devin-docs:extensibility/rules.mdx";

/**
 * Instruction/rule locations per Devin CLI docs (rules.mdx).
 * Devin documents *where* these load, not a shadowing order between
 * scopes — so resolutionBasis is "undocumented" throughout (ADR-0003).
 */
export const INSTRUCTION_LOCATIONS: SourceLocation[] = [
  { id: "project-agents", kind: "instruction", scope: "project", base: "project", glob: "AGENTS.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "project-agents-local", kind: "instruction", scope: "project-local", base: "project", glob: "AGENTS.local.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "project-agent-singular", kind: "instruction", scope: "project", base: "project", glob: "AGENT.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "project-windsurfrules", kind: "instruction", scope: "project", base: "project", glob: ".windsurfrules", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "project-claude", kind: "instruction", scope: "compatibility", base: "project", glob: "CLAUDE.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "devin-rules", kind: "rule", scope: "project", base: "project", glob: ".devin/rules/*.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "devin-global-rules-file", kind: "rule", scope: "project", base: "project", glob: ".devin/global_rules.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "windsurf-rules", kind: "rule", scope: "compatibility", base: "project", glob: ".windsurf/rules/*.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "windsurf-global-rules", kind: "rule", scope: "compatibility", base: "project", glob: ".windsurf/global_rules.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "cursor-rules", kind: "rule", scope: "compatibility", base: "project", glob: ".cursor/rules/*.{md,mdc}", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "global-agents", kind: "instruction", scope: "global", base: "user-config", glob: "AGENTS.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "global-agent-singular", kind: "instruction", scope: "global", base: "user-config", glob: "AGENT.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "global-claude", kind: "instruction", scope: "global", base: "home", glob: ".claude/CLAUDE.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "home-devin-rules", kind: "rule", scope: "global", base: "home", glob: ".devin/rules/*.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
  { id: "home-devin-global-rules", kind: "rule", scope: "global", base: "home", glob: ".devin/global_rules.md", resolutionBasis: "undocumented", docRef: RULES_DOC },
];
