import type { Diagnostic, RuntimeEntity } from "../runtime/types.js";

/**
 * Conservative modal-directive conflict detection (spec §17.6).
 * Deterministic string analysis only — labeled heuristic, confidence medium.
 * Never a claim about Devin's reasoning.
 */

const POSITIVE = /\b(always|must|required)\b/i;
const NEGATIVE = /\b(never|must not|do not|only|forbidden)\b/i;
const DIRECTIVE = new RegExp(`(${POSITIVE.source}|${NEGATIVE.source})`, "i");

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "and", "or", "in", "on", "for", "with", "by",
  "is", "are", "be", "you", "your", "it", "this", "that", "all", "any",
  "always", "never", "must", "not", "do", "only", "required", "forbidden",
  "before", "after", "when", "directly",
]);

interface DirectiveSentence {
  sentence: string;
  polarity: "positive" | "negative";
  topics: Set<string>;
}

function directives(body: string): DirectiveSentence[] {
  return body
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => DIRECTIVE.test(s))
    .map((sentence) => ({
      sentence,
      // DIRECTIVE guarantees POSITIVE or NEGATIVE matched
      polarity: (NEGATIVE.test(sentence) ? "negative" : "positive") as "positive" | "negative",
      topics: new Set(
        sentence
          .toLowerCase()
          .replace(/[^a-z\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
      ),
    }));
}

function conflicts(a: DirectiveSentence, b: DirectiveSentence): boolean {
  if (a.polarity === b.polarity) return false;
  return [...a.topics].some((t) => b.topics.has(t));
}

export function conflictDiagnostics(entities: RuntimeEntity[]): Diagnostic[] {
  const active = entities.filter(
    (e) => (e.kind === "instruction" || e.kind === "rule") &&
      (e.status === "active" || e.status === "available") &&
      typeof e.metadata.body === "string",
  );
  const diagnostics: Diagnostic[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const da = directives(a.metadata.body as string);
      const db = directives(b.metadata.body as string);
      const pair = da.flatMap((x) => db.filter((y) => conflicts(x, y)).map((y) => [x, y] as const))[0];
      if (pair) {
        diagnostics.push({
          code: "CONFLICT_MODAL",
          title: "Possible instruction conflict",
          severity: "MEDIUM",
          entityIds: [a.id, b.id],
          evidence: [
            `${a.sourcePath ?? a.name}: "${pair[0].sentence}"`,
            `${b.sourcePath ?? b.name}: "${pair[1].sentence}"`,
            "confidence: medium",
          ],
          explanation:
            "Two active instruction sources contain opposing modal directives concerning a shared topic. " +
            "This is a heuristic inference, not a claim about Devin's reasoning.",
          remediation: "Reconcile the directives or scope one of the sources.",
        });
      }
    }
  }
  return diagnostics;
}
