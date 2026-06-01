import { NextRequest, NextResponse } from "next/server";
import { listPullRequests, listIssues, parseRepoUrl } from "@/lib/github";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const repoInput = url.searchParams.get("repo");
  const type = url.searchParams.get("type"); // "pulls" | "issues"
  const branch = url.searchParams.get("branch") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const since = url.searchParams.get("since") ?? undefined;
  const until = url.searchParams.get("until") ?? undefined;
  const token = url.searchParams.get("token") ?? process.env.GITHUB_TOKEN ?? undefined;

  if (!repoInput) return NextResponse.json({ error: "missing repo" }, { status: 400 });
  if (type !== "pulls" && type !== "issues")
    return NextResponse.json({ error: "type must be pulls|issues" }, { status: 400 });

  const parsed = parseRepoUrl(repoInput);
  if (!parsed) return NextResponse.json({ error: "invalid repo url" }, { status: 400 });

  try {
    const result =
      type === "pulls"
        ? await listPullRequests({ ...parsed, branch, page, since, until, token })
        : await listIssues({ ...parsed, page, since, until, token });
    return NextResponse.json({ ...result, page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "fetch failed" }, { status: 502 });
  }
}
