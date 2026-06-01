import { Provider } from "./types";
import { SYSTEM_PROMPT } from "./prompt";

// "free" is resolved to a concrete provider (groq/gemini) before reaching here.
export type LLMProvider = Exclude<Provider, "free">;

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
};

export async function callProvider(args: {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  userMessage: string;
}): Promise<string> {
  const { provider, apiKey, userMessage } = args;
  const model = args.model || DEFAULT_MODELS[provider];

  // Groq is OpenAI-compatible — same request shape, different base URL.
  if (provider === "groq" || provider === "openai") {
    const base =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}
