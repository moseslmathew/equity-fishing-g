import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smallcap Observatory | Mutual fund holdings",
  description: "Compare small-cap and selected Helios equity funds, their top 15 holdings, full portfolio changes and dated sources.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
