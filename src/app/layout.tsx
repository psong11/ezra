import type { Metadata } from "next";
import { Frank_Ruhl_Libre, EB_Garamond, Inter } from "next/font/google";
import "./globals.css";

// Hebrew scripture — a serif designed for Hebrew, handles niqqud + cantillation well
const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  variable: "--font-hebrew",
  display: "swap",
});

// Greek scripture + English translations — supports polytonic Greek
const garamond = EB_Garamond({
  subsets: ["greek", "greek-ext", "latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// UI chrome
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ezra",
  description: "Ancient texts devotedly handwritten over, and over, and over.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${frankRuhl.variable} ${garamond.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#faf6ee] font-sans text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
