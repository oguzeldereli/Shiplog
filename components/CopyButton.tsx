"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy markdown" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs text-ink-300 hover:text-accent"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
