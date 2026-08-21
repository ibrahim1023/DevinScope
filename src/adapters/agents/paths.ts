import type { SourceLocation } from "../types.js";

const SUBAGENTS_DOC = "devin-docs:subagents.mdx";

/**
 * Custom subagent locations per Devin CLI docs (subagents.mdx "Custom Subagents").
 * Layouts: flat agents/<name>.md or directory agents/<name>/AGENT.md
 * (AGENTS.md / agent.md / agents.md also accepted as the file name).
 * Built-in profile names: subagent_explore, subagent_general — a custom
 * profile conflicting with them is skipped with a warning by Devin.
 */
export const AGENT_LOCATIONS: SourceLocation[] = [
  { id: "agents-devin-project", kind: "agent", scope: "project", base: "project", glob: ".devin/agents/*.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-devin-project-dir", kind: "agent", scope: "project", base: "project", glob: ".devin/agents/*/{AGENT,AGENTS,agent,agents}.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-compat-project", kind: "agent", scope: "project", base: "project", glob: ".agents/agents/*.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-compat-project-dir", kind: "agent", scope: "project", base: "project", glob: ".agents/agents/*/{AGENT,AGENTS,agent,agents}.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-devin-global", kind: "agent", scope: "global", base: "user-config", glob: "agents/*.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-devin-global-dir", kind: "agent", scope: "global", base: "user-config", glob: "agents/*/{AGENT,AGENTS,agent,agents}.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
  { id: "agents-claude", kind: "agent", scope: "compatibility", base: "project", glob: ".claude/agents/*.md", resolutionBasis: "undocumented", docRef: SUBAGENTS_DOC },
];

export const BUILTIN_PROFILES = ["subagent_explore", "subagent_general"];
