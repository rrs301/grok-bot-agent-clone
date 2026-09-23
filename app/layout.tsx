import { AuthProvider } from "@/components/session-provider";
import "./globals.css";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/toast";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Orbit AI Agent Platform",
    template: "%s | Orbit AI Agent Platform",
  },
  description:
    "Build, configure, and run AI agents with connected tools, scheduled routines, chat history, and live E2B desktop execution.",
  applicationName: "Orbit AI Agent Platform",
  keywords: [
    "AI agents",
    "agent workspace",
    "OpenAI agents",
    "Composio tools",
    "E2B desktop",
    "Inngest routines",
  ],
  authors: [{ name: "Orbit AI" }],
  creator: "Orbit AI",
  publisher: "Orbit AI",
  openGraph: {
    title: "Orbit AI Agent Platform",
    description:
      "A command center for AI agents, connected tools, routines, and live execution history.",
    url: appUrl,
    siteName: "Orbit AI Agent Platform",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Orbit AI Agent Platform logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Orbit AI Agent Platform",
    description:
      "Create agents, connect tools, schedule routines, and monitor live execution in one workspace.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

const figtree = Figtree({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }} className={figtree.className}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
