import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Console | Purdue Pioneers",
  description: "Submit research queries and track agent runs for Purdue Pioneers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
