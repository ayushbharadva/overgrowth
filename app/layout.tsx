import type { Metadata } from "next";
import "./globals.css";
import Background from "./Background";

const title = "Overgrowth — grow a tree from your GitHub history";
const description =
  "Type a GitHub username and watch a living generative tree grow from years of commits, languages, stars and abandoned repos. Every builder grows a different tree.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Background />
        {children}
      </body>
    </html>
  );
}
