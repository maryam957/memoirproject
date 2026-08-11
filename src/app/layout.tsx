import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { DraftProvider } from "@/lib/draft-context";

// Self-hosted at build time by next/font, so the flow never waits on a
// third-party font server — and no request leaks to Google at runtime.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "The Memoir Project",
  description:
    "Gather memories from the people who love them — in their own voices — into one memoir.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        <DraftProvider>{children}</DraftProvider>
      </body>
    </html>
  );
}
