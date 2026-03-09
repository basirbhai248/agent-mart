import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Mart",
  description: "Marketplace powered by Next.js and Convex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-100 antialiased`}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
            <nav className="flex items-center gap-4 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Agent Mart
              </Link>
              <form
                role="search"
                className="ml-auto flex w-full max-w-sm items-center"
              >
                <input
                  type="search"
                  name="q"
                  placeholder="Search agents"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </form>
              <div className="flex items-center gap-4 text-sm text-zinc-300">
                <Link href="/">Home</Link>
                <Link href="/search">Search</Link>
              </div>
            </nav>
          </header>
          <main className="flex-1 py-8">{children}</main>
          <footer className="border-t border-zinc-800 py-4 text-sm text-zinc-400">
            Agent Mart
          </footer>
        </div>
      </body>
    </html>
  );
}
