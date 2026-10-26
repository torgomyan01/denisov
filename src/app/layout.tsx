import type { Metadata } from "next";
import { SiteCart } from "@/components/cart/SiteCart";
import { StoreProvider } from "@/components/cart/StoreProvider";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ДЕНИСОВ — Кафе и пекарня",
  description:
    "ДЕНИСОВ — кафе и пекарня на Московском проспекте в Санкт-Петербурге.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full font-sans text-ink">
        <StoreProvider>
          {children}
          <SiteCart />
          <CookieConsentBanner />
        </StoreProvider>
      </body>
    </html>
  );
}
