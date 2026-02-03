import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
        {children}
      </body>
    </html>
  );
}
