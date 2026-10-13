import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ДЕНИСОВ — Кафе и пекарня",
  description:
    "ДЕНИСОВ — кафе и пекарня на Московском проспекте в Санкт-Петербурге.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full font-sans text-ink">{children}</body>
    </html>
  );
}
