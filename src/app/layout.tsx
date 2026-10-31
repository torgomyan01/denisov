import type { Metadata } from "next";
import { SiteCart } from "@/components/cart/SiteCart";
import { StoreProvider } from "@/components/cart/StoreProvider";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ДЕНИСОВ — Кафе и пекарня",
  description:
    "ДЕНИСОВ — кафе и пекарня на Московском проспекте в Санкт-Петербурге.",
  manifest: "/site.webmanifest",
  themeColor: "#1F1E1A",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
