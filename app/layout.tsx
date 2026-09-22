import { AuthProvider } from "@/components/session-provider";
import "./globals.css";
import type { Metadata } from "next";
import { Figtree } from 'next/font/google'
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Orbit AI Agent Bot Platform",
  description: "A minimal command center for AI agents, routines, tools, and live execution history.",
};


const figtree = Figtree({ subsets: ['latin'] })

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
