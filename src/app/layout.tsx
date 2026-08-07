import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eternal Dominion — A Living Kingdom JRPG",
  description:
    "Rebuild a ruined kingdom: walk the living Great Hall, summon heroes, wage turn-based campaigns, and watch your city grow from village to civilization.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0e18] text-[#f0e2c4] antialiased">{children}</body>
    </html>
  );
}
