import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Shiplog — turn commits into release notes",
  description:
    "Paste a GitHub repo or commits and get clean, categorized release notes in seconds. Free, no signup.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-ink-100 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
