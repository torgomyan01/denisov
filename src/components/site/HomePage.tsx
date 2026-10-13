import Link from "next/link";
import type { SiteData } from "@/types/site";
import { brandLabel, phoneToTel } from "@/lib/format";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DishesGallery } from "@/components/site/DishesGallery";
import { Reveal } from "@/components/site/Reveal";

interface HomePageProps {
  site: SiteData;
}

export const HomePage = ({ site }: HomePageProps) => {
  const brand = brandLabel(site);
  const dishes = site.dishes.filter((d) => d.image || d.caption);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Перейти к содержимому
      </a>

      <SiteHeader site={site} />

      <main id="main">
        <section id="top" className="hero-wash relative overflow-hidden" aria-label="Главный экран">
          <div className="mx-auto max-w-[1200px] px-6 pt-16 pb-6 md:px-10 md:pt-24 md:pb-10">
            <div className="grid items-center gap-12 md:grid-cols-12 md:gap-10 lg:gap-16">
              <div className="md:col-span-6 lg:col-span-5">
                <p className="hero-a d1 font-sans text-[11px] uppercase tracking-[0.42em] text-clay">
                  {site.hero.eyebrow}
                </p>
                <div className="hero-a d1 hairline mt-5 mb-8 max-w-[140px]" aria-hidden="true" />
                <h1 className="hero-a d2 font-serif text-6xl leading-[0.9] tracking-tight md:text-7xl lg:text-[5.75rem]">
                  {site.hero.title}
                </h1>
                <p className="hero-a d3 mt-7 max-w-md font-serif text-xl italic leading-relaxed text-ink/65 md:text-2xl">
                  {site.hero.subtitle}
                </p>
                <div className="hero-a d4 mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.26em] text-paper shadow-sm transition hover:bg-clay"
                  >
                    {site.hero.menuButtonLabel}
                  </Link>
                  <a
                    href={site.hero.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/60 px-6 py-3.5 font-sans text-[12px] uppercase tracking-[0.26em] text-ink backdrop-blur transition hover:border-clay hover:text-clay"
                  >
                    {site.hero.telegramButtonLabel}
                  </a>
                </div>
                <p className="hero-a d5 mt-10 font-sans text-[11px] uppercase tracking-[0.26em] text-ink/40">
                  {site.hero.metaLine}
                </p>
              </div>

              <div className="hero-img md:col-span-6 lg:col-span-7">
                <figure className="dish relative">
                  <div className="aspect-[4/5] overflow-hidden bg-sand sm:aspect-[5/6] md:aspect-[4/5] lg:ml-auto lg:max-w-[520px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={site.hero.featuredImage}
                      alt={site.hero.featuredCaption || brand}
                      className="h-full w-full object-cover"
                      width={1040}
                      height={1300}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </div>
                  {(site.hero.featuredCaption || site.hero.featuredBadge) && (
                    <figcaption className="mt-4 flex items-baseline justify-between gap-4 lg:ml-auto lg:max-w-[520px]">
                      <span className="font-serif text-xl italic text-ink/75">
                        {site.hero.featuredCaption}
                      </span>
                      <span className="font-sans text-[10px] uppercase tracking-[0.26em] text-clay">
                        {site.hero.featuredBadge}
                      </span>
                    </figcaption>
                  )}
                </figure>
              </div>
            </div>

            <DishesGallery dishes={dishes} />
          </div>
        </section>

        <section
          id="about"
          className="mx-auto max-w-[1200px] px-6 py-20 md:px-10 md:py-28"
          aria-labelledby="about-heading"
        >
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="p" className="font-sans text-[11px] uppercase tracking-[0.42em] text-clay">
              {site.about.eyebrow}
            </Reveal>
            <Reveal
              as="h2"
              className="mt-5 font-serif text-3xl leading-snug md:text-4xl"
            >
              <span id="about-heading">{site.about.title}</span>
            </Reveal>
            <Reveal as="p" className="mt-7 font-serif text-lg leading-relaxed text-ink/60 md:text-xl">
              {site.about.text}
            </Reveal>
            <Reveal className="mt-12 grid grid-cols-3 gap-6">
              <div role="listitem">
                <p className="font-serif text-3xl text-olive md:text-4xl">{site.about.stat1Value}</p>
                <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
                  {site.about.stat1Label}
                </p>
              </div>
              <div role="listitem">
                <p className="font-serif text-3xl text-olive md:text-4xl">{site.about.stat2Value}</p>
                <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
                  {site.about.stat2Label}
                </p>
              </div>
              <div role="listitem">
                <p className="font-serif text-3xl text-olive md:text-4xl">{site.about.stat3Value}</p>
                <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
                  {site.about.stat3Label}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="visit" className="border-t border-ink/10 bg-sand/40" aria-labelledby="visit-heading">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:px-10 md:py-28">
            <div className="mx-auto grid max-w-4xl gap-12 md:grid-cols-2 md:gap-16">
              <Reveal>
                <p className="font-sans text-[11px] uppercase tracking-[0.42em] text-clay">
                  {site.contacts.eyebrow}
                </p>
                <h2 id="visit-heading" className="mt-5 font-serif text-3xl leading-tight md:text-4xl">
                  <a
                    href={phoneToTel(site.contacts.phone)}
                    className="text-ink transition hover:text-clay"
                  >
                    {site.contacts.phone}
                  </a>
                </h2>
                <p className="mt-3 font-serif text-lg italic text-ink/60 md:text-xl">
                  {site.contacts.title}
                </p>

                <address className="mt-10 not-italic space-y-6">
                  <div>
                    <p className="font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
                      {site.contacts.addressLabel}
                    </p>
                    <p className="mt-1 font-serif text-xl md:text-2xl">{site.contacts.address}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
                      {site.contacts.hoursLabel}
                    </p>
                    <p className="mt-1 font-serif text-xl md:text-2xl">{site.contacts.hours}</p>
                  </div>
                </address>

                <div className="mt-10 flex flex-wrap gap-3">
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-sans text-[12px] uppercase tracking-[0.26em] text-paper transition hover:bg-clay"
                  >
                    {site.contacts.menuButtonLabel}
                  </Link>
                  <a
                    href={site.contacts.telegramUrl || site.hero.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-3 font-sans text-[12px] uppercase tracking-[0.26em] transition hover:border-clay hover:text-clay"
                  >
                    {site.contacts.telegramButtonLabel}
                  </a>
                </div>
              </Reveal>

              <Reveal className="overflow-hidden">
                <div className="aspect-[4/5] overflow-hidden md:aspect-auto md:h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={site.contacts.image}
                    alt={`Атмосфера кафе ${brand}`}
                    className="h-full w-full object-cover"
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 py-12 md:flex-row md:items-center md:px-10"
        role="contentinfo"
      >
        <p className="font-serif text-2xl tracking-[0.35em]">{brand}</p>
        <div className="flex flex-wrap items-center gap-6 font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
          <a
            href={site.hero.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="u hover:text-clay"
          >
            {site.hero.telegramButtonLabel}
          </a>
          <Link href="/menu" className="u hover:text-clay">
            Меню
          </Link>
          <span>{site.footer.copyright}</span>
        </div>
      </footer>
    </>
  );
};
