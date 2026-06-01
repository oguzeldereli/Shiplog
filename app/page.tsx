"use client";

import { useEffect, useState } from "react";
import { Changelog, Provider, SourceKind } from "@/lib/types";
import { changelogToMarkdown } from "@/lib/markdown";
import { SAMPLE_COMMITS } from "@/lib/sample";

const PROVIDER_LABEL: Record<Provider, string> = {
  free: "Free (no key)",
  groq: "Groq",
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  commits: "Commits",
  pulls: "Merged PRs",
  issues: "Closed issues",
};

const KEY_STORAGE = "shiplog.key";
const PROVIDER_STORAGE = "shiplog.provider";

interface RepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  branches: string[];
}

interface ListItem {
  number: number;
  title: string;
  date: string | null;
  user: string;
  labels: string[];
}

export default function Page() {
  const [provider, setProvider] = useState<Provider>("free");
  const [apiKey, setApiKey] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [branch, setBranch] = useState("");
  const [source, setSource] = useState<SourceKind>("commits");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  // picker state (pulls / issues)
  const [items, setItems] = useState<ListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [includeTitles, setIncludeTitles] = useState(true);

  const [commits, setCommits] = useState("");
  const [context, setContext] = useState("");

  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Changelog | null>(null);

  useEffect(() => {
    const p = (localStorage.getItem(PROVIDER_STORAGE) as Provider) || "free";
    setProvider(p);
    setApiKey(localStorage.getItem(`${KEY_STORAGE}.${p}`) || "");
  }, []);

  useEffect(() => {
    localStorage.setItem(PROVIDER_STORAGE, provider);
    setApiKey(localStorage.getItem(`${KEY_STORAGE}.${provider}`) || "");
  }, [provider]);

  const saveKey = (k: string) => {
    setApiKey(k);
    localStorage.setItem(`${KEY_STORAGE}.${provider}`, k);
  };

  const isoOrUndef = (d: string, end = false) =>
    d ? new Date(d + (end ? "T23:59:59Z" : "T00:00:00Z")).toISOString() : undefined;

  const resetPicker = () => {
    setItems([]);
    setPage(1);
    setHasMore(false);
    setSelected(new Map());
  };

  const loadRepo = async () => {
    if (!repoUrl.trim()) return;
    setLoadingRepo(true);
    setError(null);
    setNote(null);
    resetPicker();
    try {
      const res = await fetch(`/api/repo?repo=${encodeURIComponent(repoUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to load repo");
      setMeta(data);
      setBranch(data.defaultBranch);
      setNote(`${data.owner}/${data.repo} — ${data.branches.length} branches`);
    } catch (e: any) {
      setError(e.message);
      setMeta(null);
    } finally {
      setLoadingRepo(false);
    }
  };

  const loadItems = async (toPage: number) => {
    if (!meta || source === "commits") return;
    setLoadingItems(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        repo: `${meta.owner}/${meta.repo}`,
        type: source,
        page: String(toPage),
      });
      if (source === "pulls" && branch) params.set("branch", branch);
      const s = isoOrUndef(since);
      const u = isoOrUndef(until, true);
      if (s) params.set("since", s);
      if (u) params.set("until", u);

      const res = await fetch(`/api/items?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to load list");
      setItems(data.items);
      setPage(toPage);
      setHasMore(data.hasMore);
      setNote(
        data.items.length
          ? `page ${toPage} — ${data.items.length} ${SOURCE_LABEL[source].toLowerCase()}`
          : `no ${SOURCE_LABEL[source].toLowerCase()} on this page / range`
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const toggle = (item: ListItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.number)) next.delete(item.number);
      else next.set(item.number, item.title);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      const allSelected = items.every((i) => next.has(i.number));
      for (const i of items) {
        if (allSelected) next.delete(i.number);
        else next.set(i.number, i.title);
      }
      return next;
    });
  };

  const fetchContent = async () => {
    if (!meta) return;
    setFetching(true);
    setError(null);
    setNote(null);
    try {
      const body: any = {
        repo: `${meta.owner}/${meta.repo}`,
        source,
        includeTitles,
      };
      if (source !== "issues" && branch) body.branch = branch;
      const s = isoOrUndef(since);
      const u = isoOrUndef(until, true);
      if (s) body.since = s;
      if (u) body.until = u;
      if (source !== "commits") {
        body.selected = [...selected.entries()].map(([number, title]) => ({ number, title }));
      }

      const res = await fetch("/api/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "fetch failed");
      setCommits(data.text);
      setNote(
        data.commitCount > 0
          ? `loaded ${data.commitCount} commits`
          : "no commits found for that selection"
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, commits, context, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
      setResult(data.changelog as Changelog);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyMarkdown = async () => {
    if (result) await navigator.clipboard.writeText(changelogToMarkdown(result));
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([changelogToMarkdown(result)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "CHANGELOG.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const needsKey = provider !== "free";
  const isPicker = source !== "commits";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-baseline justify-between border-b border-ink-700 pb-4">
        <div>
          <h1 className="text-xl tracking-tight">
            <span className="text-accent">shiplog</span>
            <span className="text-ink-400"> / changelog generator</span>
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            Turn commits, PRs, or issues into release notes humans actually read.
          </p>
        </div>
        <a href="https://github.com" className="text-xs text-ink-400 hover:text-ink-100">
          github →
        </a>
      </header>

      {/* provider */}
      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Model provider">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        {needsKey ? (
          <Field label={`${PROVIDER_LABEL[provider]} API key`} className="md:col-span-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </Field>
        ) : (
          <div className="md:col-span-2 flex items-end">
            <p className="text-xs text-ink-400 leading-relaxed">
              No key needed — runs on a shared free tier (rate-limited). For real
              volume, switch to a provider and bring your own key.
            </p>
          </div>
        )}
      </section>

      {/* repo */}
      <section className="mb-6 border border-ink-700 bg-ink-800/30 p-4">
        <Field label="GitHub repo (public)">
          <div className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadRepo()}
              placeholder="vercel/next.js  or  https://github.com/vercel/next.js"
              className="flex-1 bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              onClick={loadRepo}
              disabled={loadingRepo || !repoUrl.trim()}
              className="border border-ink-600 px-4 py-2 text-sm hover:border-accent disabled:opacity-40"
            >
              {loadingRepo ? "loading…" : "load repo"}
            </button>
          </div>
        </Field>

        {meta && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Source">
                <div className="flex gap-1">
                  {(Object.keys(SOURCE_LABEL) as SourceKind[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSource(s);
                        resetPicker();
                      }}
                      className={`flex-1 border px-2 py-2 text-xs ${
                        source === s
                          ? "border-accent text-accent"
                          : "border-ink-600 text-ink-300 hover:border-ink-500"
                      }`}
                    >
                      {SOURCE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Branch">
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    resetPicker();
                  }}
                  disabled={source === "issues"}
                  className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-40"
                >
                  {meta.branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                      {b === meta.defaultBranch ? "  (default)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="From (optional)">
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </Field>
              <Field label="To (optional)">
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </Field>
              <div className="flex items-end">
                {isPicker ? (
                  <button
                    onClick={() => loadItems(1)}
                    disabled={loadingItems}
                    className="w-full border border-ink-600 px-4 py-2 text-sm hover:border-accent disabled:opacity-40"
                  >
                    {loadingItems ? "loading…" : `list ${SOURCE_LABEL[source].toLowerCase()}`}
                  </button>
                ) : (
                  <button
                    onClick={fetchContent}
                    disabled={fetching}
                    className="w-full border border-ink-600 px-4 py-2 text-sm hover:border-accent disabled:opacity-40"
                  >
                    {fetching ? "fetching…" : "fetch commits"}
                  </button>
                )}
              </div>
            </div>

            {/* picker */}
            {isPicker && items.length > 0 && (
              <div className="border border-ink-700 bg-ink-900/60">
                <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2 text-xs">
                  <button onClick={selectAllOnPage} className="text-ink-300 hover:text-accent">
                    select all on page
                  </button>
                  <span className="text-ink-400">{selected.size} selected</span>
                </div>
                <ul className="max-h-72 overflow-y-auto divide-y divide-ink-800">
                  {items.map((it) => (
                    <li key={it.number}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-ink-800/50">
                        <input
                          type="checkbox"
                          checked={selected.has(it.number)}
                          onChange={() => toggle(it)}
                          className="mt-1 accent-[#7cf2b0]"
                        />
                        <span className="min-w-0">
                          <span className="text-xs text-ink-400">#{it.number}</span>{" "}
                          <span className="text-sm text-ink-200">{it.title}</span>
                          {it.labels.length > 0 && (
                            <span className="ml-2 text-xs text-ink-500">
                              {it.labels.join(", ")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-ink-700 px-3 py-2 text-xs">
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadItems(page - 1)}
                      disabled={page <= 1 || loadingItems}
                      className="text-ink-300 hover:text-accent disabled:opacity-30"
                    >
                      ← prev
                    </button>
                    <span className="text-ink-500">page {page}</span>
                    <button
                      onClick={() => loadItems(page + 1)}
                      disabled={!hasMore || loadingItems}
                      className="text-ink-300 hover:text-accent disabled:opacity-30"
                    >
                      next →
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-ink-400">
                    <input
                      type="checkbox"
                      checked={includeTitles}
                      onChange={(e) => setIncludeTitles(e.target.checked)}
                      className="accent-[#7cf2b0]"
                    />
                    include {source === "pulls" ? "PR" : "issue"} titles
                  </label>
                </div>
                <div className="border-t border-ink-700 px-3 py-2">
                  <button
                    onClick={fetchContent}
                    disabled={fetching || selected.size === 0}
                    className="w-full border border-ink-600 px-4 py-2 text-sm hover:border-accent disabled:opacity-40"
                  >
                    {fetching
                      ? "fetching commits…"
                      : `fetch commits from ${selected.size} selected ${
                          source === "pulls" ? "PR" : "issue"
                        }${selected.size === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            )}
            {source === "issues" && (
              <p className="text-xs text-ink-400">
                Issues have no commits directly — shiplog walks each issue&apos;s
                timeline to pull commits from the PRs that closed it and any commits
                that referenced it.
              </p>
            )}
          </div>
        )}
      </section>

      {/* content */}
      <section className="mb-4">
        <Field
          label="Content"
          right={
            <button
              onClick={() => setCommits(SAMPLE_COMMITS)}
              className="text-xs text-ink-400 hover:text-accent"
            >
              load sample
            </button>
          }
        >
          <textarea
            value={commits}
            onChange={(e) => setCommits(e.target.value)}
            rows={12}
            placeholder="fetch from a repo above, or paste commits here — one per line"
            className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-xs focus:border-accent focus:outline-none"
          />
        </Field>
      </section>

      <section className="mb-6">
        <Field label="Project context (optional)">
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. project management SaaS for engineering teams"
            className="w-full bg-ink-800 border border-ink-600 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </Field>
      </section>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={generating || (needsKey && !apiKey) || !commits.trim()}
          className="bg-accent text-ink-900 px-6 py-2 text-sm font-semibold hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? "generating…" : "generate changelog"}
        </button>
        {note && <span className="text-xs text-ink-400">{note}</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {result && (
        <section className="border border-ink-700 bg-ink-800/40">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
            <div className="text-xs uppercase tracking-widest text-ink-400">output</div>
            <div className="flex gap-3">
              <button onClick={copyMarkdown} className="text-xs text-ink-300 hover:text-accent">
                copy md
              </button>
              <button onClick={downloadMarkdown} className="text-xs text-ink-300 hover:text-accent">
                download
              </button>
            </div>
          </div>
          <ChangelogView c={result} />
        </section>
      )}

      <footer className="mt-16 border-t border-ink-700 pt-4 text-xs text-ink-400">
        keys stay in your browser. requests go browser → this server → provider →
        back. nothing stored.
      </footer>
    </main>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={props.className}>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs uppercase tracking-widest text-ink-400">{props.label}</label>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

const SECTION_TITLE: Record<string, string> = {
  breaking: "Breaking",
  added: "Added",
  improved: "Improved",
  fixed: "Fixed",
};

function ChangelogView({ c }: { c: Changelog }) {
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
