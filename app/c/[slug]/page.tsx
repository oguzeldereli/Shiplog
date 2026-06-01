import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChangelog, storageEnabled } from "@/lib/store";
import { changelogToMarkdown } from "@/lib/markdown";
import { ChangelogView } from "@/components/ChangelogView";
import { CopyButton } from "@/components/CopyButton";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!storageEnabled()) return { title: "Changelog · Shiplog" };
  const published = await getChangelog(slug).catch(() => null);
  if (!published) return { title: "Changelog not found · Shiplog" };

  const repoName = published.repo ? `${published.repo.owner}/${published.repo.repo}` : "";
  const title = repoName ? `${repoName} — changelog · Shiplog` : `${published.changelog.title || "Changelog"} · Shiplog`;
  const description =
    published.changelog.summary || "Release notes generated from commits with Shiplog.";
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublishedPage({ params }: Props) {
  const { slug } = await params;
  if (!storageEnabled()) notFound();

  const published = await getChangelog(slug).catch(() => null);
  if (!published) notFound();

  const repoName = published.repo
    ? `${published.repo.owner}/${published.repo.repo}`
    : null;
  const md = changelogToMarkdown(published.changelog);
  const date = new Date(published.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between border-b border-ink-700 pb-4">
        <div>
          {repoName && (
            <div className="text-xs uppercase tracking-widest text-ink-400">{repoName}</div>
          )}
          <h1 className="mt-1 text-lg tracking-tight text-ink-100">
            {published.changelog.title || "Changelog"}
          </h1>
          <div className="mt-1 text-xs text-ink-500">published {date}</div>
        </div>
        <CopyButton text={md} />
      </header>

      <section className="border border-ink-700 bg-ink-800/40">
        <ChangelogView c={published.changelog} />
      </section>

      <footer className="mt-10 flex flex-col items-center gap-3 border-t border-ink-700 pt-8 text-center">
        <p className="text-sm text-ink-300">
          Generated with{" "}
          <Link href="/" className="text-accent hover:underline">
            Shiplog
          </Link>{" "}
          — turn commits, PRs, and issues into release notes humans actually read.
        </p>
        <Link
          href="/"
          className="bg-accent px-5 py-2 text-sm font-semibold text-ink-900 hover:bg-accent/80"
        >
          Make your own changelog →
        </Link>
      </footer>
    </main>
  );
}
