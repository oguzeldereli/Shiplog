export type SectionKind = "breaking" | "added" | "improved" | "fixed";

export interface ChangelogItem {
  text: string;
  refs: string[];
}

export interface ChangelogSection {
  kind: SectionKind;
  items: ChangelogItem[];
}

export interface Changelog {
  title: string;
  summary: string;
  sections: ChangelogSection[];
}

// "free" routes through a server-side free-tier key (no BYOK).
export type Provider = "free" | "anthropic" | "openai" | "gemini";

export type SourceKind = "commits" | "pulls" | "issues";
