import { NextRequest, NextResponse } from "next/server";
import { callProvider, extractJson } from "@/lib/providers";
import { buildUserMessage } from "@/lib/prompt";
import { Provider, SourceKind } from "@/lib/types";
import { rateLimit, clientKey } from "@/lib/ratelimit";

// Free tier: served by a server-side key, so we cap usage per client.
const FREE_LIMIT = 8;
const FREE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  let provider = body.provider as Provider;
  let apiKey = body.apiKey as string;
  const commits = (body.commits as string) ?? "";
  const context = (body.context as string) ?? "";
  const source = (body.source as SourceKind) ?? "commits";
  const model = body.model as string | undefined;

  if (!provider || !["free", "anthropic", "openai", "gemini"].includes(provider)) {
    return NextResponse.json(
      { error: "provider must be free|anthropic|openai|gemini" },
      { status: 400 }
    );
  }
  if (!commits.trim()) return NextResponse.json({ error: "no content provided" }, { status: 400 });

  // Free, keyless path: use the server's Gemini free-tier key.
  if (provider === "free") {
    const freeKey = process.env.GEMINI_FREE_KEY;
    if (!freeKey) {
      return NextResponse.json(
        { error: "free tier not configured on this deployment — pick a provider and bring a key" },
        { status: 503 }
      );
    }
    if (!rateLimit(clientKey(req), FREE_LIMIT, FREE_WINDOW_MS)) {
      return NextResponse.json(
        { error: `free-tier limit reached (${FREE_LIMIT}/hour) — bring your own key to keep going` },
        { status: 429 }
      );
    }
    provider = "gemini";
    apiKey = freeKey;
  } else if (!apiKey) {
    return NextResponse.json({ error: "missing apiKey (BYOK)" }, { status: 400 });
  }

  try {
    const raw = await callProvider({
      provider,
      apiKey,
      model,
      userMessage: buildUserMessage(commits, context, source),
    });
    const changelog = extractJson(raw);
    return NextResponse.json({ changelog });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "generation failed" }, { status: 502 });
  }
}
