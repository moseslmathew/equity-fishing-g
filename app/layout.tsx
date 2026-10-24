import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./workspace-navigation.css";

export const metadata: Metadata = {
  title: "Smallcap Observatory | Mutual fund holdings",
  description: "Compare small-cap and selected Helios equity funds, their top 30 holdings, full portfolio changes and dated sources.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {publishableKey && (
          <Script
            src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
            data-clerk-publishable-key={publishableKey}
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
