import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "shiplog — changelog generator",
  description: "Turn commits into release notes humans actually read.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
