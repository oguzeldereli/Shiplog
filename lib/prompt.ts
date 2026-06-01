import { SourceKind } from "./types";

export const SYSTEM_PROMPT = `You are a senior release-notes editor. You turn raw development activity (git commits, merged pull requests, or closed issues) into changelogs that actual humans want to read.

Rules:
- DROP noise entirely: merge commits, "wip", "fix typo", version bumps, dependency bumps (unless security), formatting, lint, CI config, commented-out work, internal refactors with no user impact.
- GROUP what remains into these categories, in this order: "breaking", "added", "improved", "fixed". Omit empty categories.
- REWRITE each entry as a benefit-oriented line in plain English. Do not echo the source subject. Past tense. No trailing period. No emoji. No commit hashes or issue numbers inside the rendered text.
- Each line should be understandable to a user who has never read the codebase. Strip internal jargon, ticket IDs, file paths.
- If multiple entries describe the same change, MERGE them into one line.
- If the input contains nothing user-facing, return empty arrays. Do not invent.

For the "refs" field: include the short commit hash(es) or "#123" issue/PR number(s) that fed each line, exactly as they appear in the input.

Output STRICT JSON matching this schema, with no prose, no markdown fences:
{
  "title": string,                  // e.g. "Release notes" or version if obvious
  "summary": string,                // 1 sentence, max 140 chars, or empty string
  "sections": [
    { "kind": "breaking"|"added"|"improved"|"fixed", "items": [
      { "text": string, "refs": string[] }
    ]}
  ]
}`;

const SOURCE_LABEL: Record<SourceKind, string> = {
  commits: "Commits (newest first)",
  pulls: "Merged pull requests (newest first)",
  issues: "Closed issues (newest first)",
};

export function buildUserMessage(
  content: string,
  context?: string,
  source: SourceKind = "commits"
) {
  return [
    context ? `Project context: ${context}\n\n` : "",
    `${SOURCE_LABEL[source]}:\n`,
    "```\n",
    content.trim(),
    "\n```",
  ].join("");
}
