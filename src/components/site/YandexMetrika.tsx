"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { YANDEX_METRIKA_ID } from "@/lib/yandex-metrika";

/**
 * Yandex.Metrika for App Router SPA:
 * init with defer + hit on every client navigation.
 */
export const YandexMetrika = () => {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  const query = searchParams.toString();
  const url = pathname + (query ? `?${query}` : "");

  useEffect(() => {
    if (!ready) return;
    if (pathname.startsWith("/admin")) return;
    window.ym?.(YANDEX_METRIKA_ID, "hit", url);
  }, [ready, pathname, url]);

  return (
    <>
      <Script
        id="yandex-metrika"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      >
        {`
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {
    if (document.scripts[j].src === r) { return; }
  }
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');

ym(${YANDEX_METRIKA_ID}, 'init', {
  defer: true,
  ssr: true,
  webvisor: true,
  clickmap: true,
  ecommerce: "dataLayer",
  accurateTrackBounce: true,
  trackLinks: true,
  referrer: document.referrer,
  url: location.href
});
        `}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
};
