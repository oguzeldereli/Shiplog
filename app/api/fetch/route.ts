import { NextRequest, NextResponse } from "next/server";
import { buildContent, parseRepoUrl, SelectedItem } from "@/lib/github";
import { SourceKind } from "@/lib/types";

const VALID: SourceKind[] = ["commits", "pulls", "issues"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const repoInput = body.repo as string;
  const source = (body.source as SourceKind) ?? "commits";
  const branch = body.branch as string | undefined;
  const since = body.since as string | undefined;
  const until = body.until as string | undefined;
  const selected = (body.selected as SelectedItem[]) ?? [];
  const includeTitles = body.includeTitles !== false;
  const token = (body.token as string) ?? process.env.GITHUB_TOKEN ?? undefined;

  if (!repoInput) return NextResponse.json({ error: "missing repo" }, { status: 400 });
  if (!VALID.includes(source))
    return NextResponse.json({ error: "source must be commits|pulls|issues" }, { status: 400 });

  const parsed = parseRepoUrl(repoInput);
  if (!parsed) return NextResponse.json({ error: "invalid repo url" }, { status: 400 });

  if (source !== "commits" && selected.length === 0)
    return NextResponse.json({ error: `select at least one ${source === "pulls" ? "PR" : "issue"}` }, { status: 400 });

  try {
    const { text, commitCount } = await buildContent({
      source,
      ...parsed,
      branch,
      since,
      until,
      selected,
      includeTitles,
      token,
    });
    return NextResponse.json({ ...parsed, source, commitCount, text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "fetch failed" }, { status: 502 });
  }
}
