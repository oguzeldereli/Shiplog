import { NextRequest, NextResponse } from "next/server";
import { fetchRepoMeta, parseRepoUrl } from "@/lib/github";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const repoInput = url.searchParams.get("repo");
  const token = url.searchParams.get("token") ?? process.env.GITHUB_TOKEN ?? undefined;

  if (!repoInput) return NextResponse.json({ error: "missing repo" }, { status: 400 });
  const parsed = parseRepoUrl(repoInput);
  if (!parsed) return NextResponse.json({ error: "invalid repo url" }, { status: 400 });

  try {
    const meta = await fetchRepoMeta({ ...parsed, token });
    return NextResponse.json(meta);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "fetch failed" }, { status: 502 });
  }
}
