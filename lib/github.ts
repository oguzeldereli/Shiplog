import { SourceKind } from "./types";

export interface FetchedCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface ListItem {
  number: number;
  title: string;
  date: string | null; // merged_at (PRs) or closed_at (issues)
  user: string;
  labels: string[];
}

export interface RepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  branches: string[];
}

export interface SelectedItem {
  number: number;
  title: string;
}

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const s = input.trim();
  const m =
    s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i) ||
    s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

function ghHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "shiplog",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function ghRes(url: string, token?: string): Promise<Response> {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res;
}

async function gh(url: string, token?: string): Promise<any> {
  return (await ghRes(url, token)).json();
}

// Reads the Link header to decide if another page exists.
async function ghPage(url: string, token?: string): Promise<{ data: any[]; hasMore: boolean }> {
  const res = await ghRes(url, token);
  const data = (await res.json()) as any[];
  const link = res.headers.get("link");
  return { data, hasMore: !!link && /rel="next"/.test(link) };
}

function inRange(ts: string | null, since?: string, until?: string): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  if (since && t < new Date(since).getTime()) return false;
  if (until && t > new Date(until).getTime()) return false;
  return true;
}

function toCommit(c: {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
}): FetchedCommit {
  return {
    sha: c.sha.slice(0, 7),
    message: c.commit.message,
    author: c.commit.author?.name ?? "",
    date: c.commit.author?.date ?? "",
  };
}

// ── repo meta ────────────────────────────────────────────────────────────────

export async function fetchRepoMeta(opts: {
  owner: string;
  repo: string;
  token?: string;
}): Promise<RepoMeta> {
  const { owner, repo, token } = opts;
  const meta = await gh(`https://api.github.com/repos/${owner}/${repo}`, token);

  const branches: string[] = [];
  for (let page = 1; page <= 5; page++) {
    const { data, hasMore } = await ghPage(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
      token
    );
    branches.push(...(data as Array<{ name: string }>).map((b) => b.name));
    if (!hasMore) break;
  }
  return { owner, repo, defaultBranch: meta.default_branch ?? "main", branches };
}

// ── pickers: paginated lists of PRs / issues ─────────────────────────────────

export async function listPullRequests(opts: {
  owner: string;
  repo: string;
  branch?: string;
  page?: number;
  perPage?: number;
  since?: string;
  until?: string;
  token?: string;
}): Promise<{ items: ListItem[]; hasMore: boolean }> {
  const { owner, repo, branch, page = 1, perPage = 30, since, until, token } = opts;
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "closed");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  if (branch) url.searchParams.set("base", branch);

  const { data, hasMore } = await ghPage(url.toString(), token);
  const items = (data as any[])
    .filter((p) => p.merged_at && inRange(p.merged_at, since, until))
    .map((p) => ({
      number: p.number,
      title: p.title,
      date: p.merged_at,
      user: p.user?.login ?? "",
      labels: (p.labels ?? []).map((l: any) => l.name),
    }));
  return { items, hasMore };
}

export async function listIssues(opts: {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
  since?: string;
  until?: string;
  token?: string;
}): Promise<{ items: ListItem[]; hasMore: boolean }> {
  const { owner, repo, page = 1, perPage = 30, since, until, token } = opts;
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set("state", "closed");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  if (since) url.searchParams.set("since", since);

  const { data, hasMore } = await ghPage(url.toString(), token);
  const items = (data as any[])
    .filter((i) => !i.pull_request && inRange(i.closed_at, since, until))
    .map((i) => ({
      number: i.number,
      title: i.title,
      date: i.closed_at,
      user: i.user?.login ?? "",
      labels: (i.labels ?? []).map((l: any) => l.name),
    }));
  return { items, hasMore };
}

// ── commit aggregation ───────────────────────────────────────────────────────

export async function fetchCommitsPaged(opts: {
  owner: string;
  repo: string;
  branch?: string;
  since?: string;
  until?: string;
  maxPages?: number;
  token?: string;
}): Promise<FetchedCommit[]> {
  const { owner, repo, branch, since, until, maxPages = 5, token } = opts;
  const out: FetchedCommit[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    if (branch) url.searchParams.set("sha", branch);
    if (since) url.searchParams.set("since", since);
    if (until) url.searchParams.set("until", until);
    const { data, hasMore } = await ghPage(url.toString(), token);
    out.push(...(data as any[]).map(toCommit));
    if (!hasMore) break;
  }
  return out;
}

export async function fetchPRCommits(opts: {
  owner: string;
  repo: string;
  number: number;
  token?: string;
}): Promise<FetchedCommit[]> {
  const { owner, repo, number, token } = opts;
  const out: FetchedCommit[] = [];
  for (let page = 1; page <= 3; page++) {
    const { data, hasMore } = await ghPage(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/commits?per_page=100&page=${page}`,
      token
    );
    out.push(...(data as any[]).map(toCommit));
    if (!hasMore) break;
  }
  return out;
}

async function fetchCommitBySha(opts: {
  owner: string;
  repo: string;
  sha: string;
  token?: string;
}): Promise<FetchedCommit | null> {
  const { owner, repo, sha, token } = opts;
  try {
    const c = await gh(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, token);
    return toCommit(c);
  } catch {
    return null; // referenced commit may live in a fork / be unreachable
  }
}

// An issue has no commits of its own — we walk its timeline to find the PRs that
// closed/referenced it and the commits that referenced it, then pull those.
async function fetchIssueLinks(opts: {
  owner: string;
  repo: string;
  number: number;
  token?: string;
}): Promise<{ prNumbers: number[]; commitShas: string[] }> {
  const { owner, repo, number, token } = opts;
  const prNumbers = new Set<number>();
  const commitShas = new Set<string>();
  for (let page = 1; page <= 5; page++) {
    const { data, hasMore } = await ghPage(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}/timeline?per_page=100&page=${page}`,
      token
    );
    for (const ev of data as any[]) {
      if ((ev.event === "referenced" || ev.event === "closed") && ev.commit_id) {
        commitShas.add(ev.commit_id);
      }
      if (ev.event === "cross-referenced" && ev.source?.issue?.pull_request) {
        prNumbers.add(ev.source.issue.number);
      }
    }
    if (!hasMore) break;
  }
  return { prNumbers: [...prNumbers], commitShas: [...commitShas] };
}

export async function aggregateIssueCommits(opts: {
  owner: string;
  repo: string;
  number: number;
  token?: string;
}): Promise<FetchedCommit[]> {
  const { owner, repo, number, token } = opts;
  const { prNumbers, commitShas } = await fetchIssueLinks({ owner, repo, number, token });

  const byPr = await Promise.all(
    prNumbers.map((n) => fetchPRCommits({ owner, repo, number: n, token }))
  );
  const direct = await Promise.all(
    commitShas.map((sha) => fetchCommitBySha({ owner, repo, sha, token }))
  );

  const seen = new Set<string>();
  const out: FetchedCommit[] = [];
  for (const c of [...byPr.flat(), ...direct]) {
    if (c && !seen.has(c.sha)) {
      seen.add(c.sha);
      out.push(c);
    }
  }
  return out;
}

// ── text rendering for the LLM ───────────────────────────────────────────────

function commitLine(c: FetchedCommit): string {
  return `${c.sha} ${c.message.split("\n")[0]}`;
}

export function commitsToText(commits: FetchedCommit[]): string {
  return commits.map(commitLine).join("\n");
}

// Groups commits under their originating PR/issue, optionally with the title.
export function groupedToText(
  groups: Array<{ item: SelectedItem; commits: FetchedCommit[] }>,
  includeTitles: boolean
): string {
  const blocks: string[] = [];
  for (const g of groups) {
    const header = includeTitles ? `#${g.item.number} ${g.item.title}` : "";
    const lines = g.commits.map((c) => (includeTitles ? `  ${commitLine(c)}` : commitLine(c)));
    if (!g.commits.length && includeTitles) {
      blocks.push(`${header}\n  (no linked commits found)`);
    } else {
      blocks.push([header, ...lines].filter(Boolean).join("\n"));
    }
  }
  return blocks.join("\n");
}

// ── orchestrator used by /api/fetch ──────────────────────────────────────────

export async function buildContent(opts: {
  source: SourceKind;
  owner: string;
  repo: string;
  branch?: string;
  since?: string;
  until?: string;
  selected?: SelectedItem[];
  includeTitles?: boolean;
  token?: string;
}): Promise<{ text: string; commitCount: number }> {
  const { source, owner, repo, branch, since, until, selected = [], includeTitles = true, token } =
    opts;

  if (source === "commits") {
    const commits = await fetchCommitsPaged({ owner, repo, branch, since, until, token });
    return { text: commitsToText(commits), commitCount: commits.length };
  }

  // pulls | issues — both resolve selected items to their commits.
  const groups = await Promise.all(
    selected.map(async (item) => {
      const commits =
        source === "pulls"
          ? await fetchPRCommits({ owner, repo, number: item.number, token })
          : await aggregateIssueCommits({ owner, repo, number: item.number, token });
      return { item, commits };
    })
  );
  const commitCount = groups.reduce((n, g) => n + g.commits.length, 0);
  return { text: groupedToText(groups, includeTitles), commitCount };
}
