import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CompanyRequisites } from "@/components/site/CompanyRequisites";
import type { CustomerPublic } from "@/lib/customer-auth";
import type { SiteData } from "@/types/site";

type LegalDocumentProps = {
  site: SiteData;
  customer: CustomerPublic | null;
  title: string;
  updatedAt: string;
  children: ReactNode;
};

export const LegalDocument = ({
  site,
  customer,
  title,
  updatedAt,
  children,
}: LegalDocumentProps) => (
  <>
    <SiteHeader site={site} customer={customer} />
    <main className="bg-[linear-gradient(180deg,rgba(239,231,216,0.35)_0%,transparent_18%)]">
      <article className="mx-auto max-w-[760px] px-6 py-12 md:px-10 md:py-16">
        <p className="m-0 font-sans text-[11px] tracking-[0.18em] text-clay uppercase">
          Документ
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] tracking-[0.02em] text-ink">
          {title}
        </h1>
        <p className="mt-3 text-[0.9rem] text-ink/48">
          Обновлено: {updatedAt}
        </p>
        <div className="mt-10 flex flex-col gap-6 text-[1.02rem] leading-[1.65] text-ink/78 [&_h2]:mt-2 [&_h2]:font-serif [&_h2]:text-[1.35rem] [&_h2]:leading-[1.25] [&_h2]:font-medium [&_h2]:tracking-[0.01em] [&_h2]:text-ink [&_p]:m-0 [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 text-[0.92rem] text-ink/50">
          <Link href="/" className="text-clay underline-offset-4 hover:underline">
            На главную
          </Link>
          {" · "}
          <Link
            href="/privacy"
            className="text-clay underline-offset-4 hover:underline"
          >
            Политика конфиденциальности
          </Link>
          {" · "}
          <Link
            href="/terms"
            className="text-clay underline-offset-4 hover:underline"
          >
            Пользовательское соглашение
          </Link>
        </p>
      </article>
    </main>
    <footer role="contentinfo">
      <CompanyRequisites />
    </footer>
  </>
);
