import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overgrowth — grow a tree from your GitHub history",
  description:
    "Type a GitHub username and watch a living generative tree grow from years of commits, languages, stars and abandoned repos. Every builder grows a different tree.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
