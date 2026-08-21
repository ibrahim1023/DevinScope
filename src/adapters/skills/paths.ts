import type { SourceLocation } from "../types.js";

const SKILLS_DOC = "devin-docs:extensibility/skills/overview.mdx";

/**
 * Skill locations per Devin CLI docs (skills/overview.mdx "Where Skills Live").
 * Devin documents discovery locations but NOT a shadowing order between
 * scopes — duplicates stay `available` with `resolution: "unknown"` (ADR-0003).
 */
export const SKILL_LOCATIONS: SourceLocation[] = [
  { id: "skills-devin-project", kind: "skill", scope: "project", base: "project", glob: ".devin/skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
  { id: "skills-agents-project", kind: "skill", scope: "project", base: "project", glob: ".agents/skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
  { id: "skills-windsurf-project", kind: "skill", scope: "project", base: "project", glob: ".windsurf/skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
  { id: "skills-devin-global", kind: "skill", scope: "global", base: "user-config", glob: "skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
  { id: "skills-agents-global", kind: "skill", scope: "global", base: "home", glob: ".agents/skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
  { id: "skills-codeium-global", kind: "skill", scope: "global", base: "codeium", glob: "{windsurf,windsurf-next,windsurf-insiders}/skills/*/SKILL.md", resolutionBasis: "undocumented", docRef: SKILLS_DOC },
];
