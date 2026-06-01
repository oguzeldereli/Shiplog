import { Changelog, SectionKind } from "./types";

const LABEL: Record<SectionKind, string> = {
  breaking: "Breaking",
  added: "Added",
  improved: "Improved",
  fixed: "Fixed",
};

export function changelogToMarkdown(c: Changelog): string {
  const lines: string[] = [];
  lines.push(`# ${c.title || "Changelog"}`);
  if (c.summary) lines.push("", c.summary);
  for (const section of c.sections ?? []) {
    if (!section.items?.length) continue;
    lines.push("", `## ${LABEL[section.kind] ?? section.kind}`);
    for (const item of section.items) {
      const refs = item.refs?.length ? ` (${item.refs.join(", ")})` : "";
      lines.push(`- ${item.text}${refs}`);
    }
  }
  return lines.join("\n") + "\n";
}
