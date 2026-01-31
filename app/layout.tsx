import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrivyLink - Private SOL Transfers",
  description: "Send SOL privately via magic links. No direct on-chain connection between sender and receiver. Built for Solana Privacy Hack 2026.",
  keywords: ["Solana", "privacy", "SOL", "crypto", "transfer", "magic link", "private"],
  authors: [{ name: "renner16", url: "https://github.com/renner16" }],
  openGraph: {
    title: "PrivyLink - Private SOL Transfers",
    description: "Send SOL privately via magic links. No direct on-chain link between sender and receiver.",
    url: "https://privylink.vercel.app",
    siteName: "PrivyLink",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrivyLink - Private SOL Transfers",
    description: "Send SOL privately via magic links on Solana.",
    creator: "@_renner_araujo",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Providers>
        <body
          suppressHydrationWarning
          className={`${inter.variable} ${geistMono.variable} antialiased`}
        >
          {children}
        </body>
      </Providers>
    </html>
  );
}
