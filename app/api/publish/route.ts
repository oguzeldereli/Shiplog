import { NextRequest, NextResponse } from "next/server";
import {
  PublishedChangelog,
  newId,
  putChangelog,
  storageEnabled,
} from "@/lib/store";
import { Changelog, SourceKind } from "@/lib/types";

function looksLikeChangelog(x: any): x is Changelog {
  return x && typeof x === "object" && Array.isArray(x.sections);
}

export async function POST(req: NextRequest) {
  if (!storageEnabled()) {
    return NextResponse.json(
      { error: "publishing not configured (set UPSTASH_REDIS_REST_URL/TOKEN)" },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const changelog = body.changelog;
  if (!looksLikeChangelog(changelog)) {
    return NextResponse.json({ error: "missing or invalid changelog" }, { status: 400 });
  }

  const repo =
    body.repo && typeof body.repo.owner === "string" && typeof body.repo.repo === "string"
      ? { owner: body.repo.owner, repo: body.repo.repo }
      : undefined;

  const payload: PublishedChangelog = {
    id: newId(),
    changelog,
    repo,
    source: (body.source as SourceKind) ?? "commits",
    createdAt: new Date().toISOString(),
  };

  try {
    await putChangelog(payload);
    return NextResponse.json({ id: payload.id, path: `/c/${payload.id}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "publish failed" }, { status: 502 });
  }
}
