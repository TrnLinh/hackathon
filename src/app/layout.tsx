import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Chorus — Shared memories, many voices",
    template: "%s | Chorus",
  },
  description:
    "Create a photozine from shared photos and stories, with everyone involved having a say.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
