// Persistence for published changelogs — the attribution/growth loop.
// Reuses the same Upstash Redis instance as rate limiting. Uses the REST
// command API (POST body) so it can store arbitrary-size JSON values.

import { Changelog, SourceKind } from "./types";

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export interface PublishedChangelog {
  id: string;
  changelog: Changelog;
  repo?: { owner: string; repo: string };
  source: SourceKind;
  createdAt: string;
}

export function storageEnabled(): boolean {
  return !!(URL && TOKEN);
}

async function cmd(args: (string | number)[]): Promise<any> {
  if (!URL || !TOKEN) throw new Error("storage not configured");
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return (await res.json()).result;
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // no look-alikes
export function newId(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export async function putChangelog(payload: PublishedChangelog): Promise<void> {
  await cmd(["SET", `cl:${payload.id}`, JSON.stringify(payload)]);
}

export async function getChangelog(id: string): Promise<PublishedChangelog | null> {
  if (!/^[a-z0-9]{4,16}$/.test(id)) return null;
  const v = await cmd(["GET", `cl:${id}`]);
  return v ? (JSON.parse(v) as PublishedChangelog) : null;
}
