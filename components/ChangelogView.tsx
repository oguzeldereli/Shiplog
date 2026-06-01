import { Changelog } from "@/lib/types";

const SECTION_TITLE: Record<string, string> = {
  breaking: "Breaking",
  added: "Added",
  improved: "Improved",
  fixed: "Fixed",
};

export function ChangelogView({ c }: { c: Changelog }) {
  return (
    <article className="px-6 py-6">
      <h2 className="text-2xl">{c.title || "Changelog"}</h2>
      {c.summary && <p className="mt-2 text-sm text-ink-300">{c.summary}</p>}
      <div className="mt-6 space-y-6">
        {(c.sections ?? []).map((s) =>
          s.items?.length ? (
            <div key={s.kind}>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-accent">
                {SECTION_TITLE[s.kind] ?? s.kind}
              </h3>
              <ul className="space-y-1.5">
                {s.items.map((item, i) => (
                  <li key={i} className="text-sm text-ink-200">
                    <span>{item.text}</span>
                    {item.refs?.length > 0 && (
                      <span className="ml-2 text-xs text-ink-400">{item.refs.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </article>
  );
}
