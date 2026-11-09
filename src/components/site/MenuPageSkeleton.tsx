const bone =
  "relative overflow-hidden rounded-full bg-ink/[.06] before:absolute before:inset-0 before:-translate-x-full before:animate-mp-shimmer before:bg-[linear-gradient(90deg,transparent,rgba(251,248,241,.65),transparent)] before:content-[''] motion-reduce:before:animate-none";

const boneBlock =
  "relative overflow-hidden bg-ink/[.055] before:absolute before:inset-0 before:-translate-x-full before:animate-mp-shimmer before:bg-[linear-gradient(90deg,transparent,rgba(251,248,241,.7),transparent)] before:content-[''] motion-reduce:before:animate-none";

const CHIP_WIDTHS = ["5.5rem", "6.8rem", "4.8rem", "7.2rem", "5.2rem", "6.1rem"] as const;

const CARD_DELAYS = [
  "delay-0",
  "delay-75",
  "delay-[120ms]",
  "delay-150",
  "delay-[180ms]",
  "delay-200",
] as const;

const SkeletonCard = ({ delayClass }: { delayClass: string }) => (
  <article
    className={`flex min-h-full flex-col overflow-hidden rounded-[22px] border border-ink/[.07] bg-white/[.58] shadow-[0_10px_28px_rgba(33,30,25,.04)] animate-mp-skel motion-reduce:animate-none ${delayClass}`}
  >
    <div
      className={`${boneBlock} aspect-[4/3] w-full rounded-none bg-[linear-gradient(145deg,rgba(239,231,216,.95),rgba(251,248,241,.98))]`}
    />
    <div className="flex flex-1 flex-col gap-[0.55rem] px-[0.7rem] pt-[0.85rem] pb-[0.95rem] sm:gap-[0.65rem] sm:px-[1.05rem] sm:pt-4 sm:pb-[1.15rem]">
      <div className="flex items-center justify-between gap-3">
        <div className={`${bone} h-[1.05rem] w-[62%]`} />
        <div className={`${bone} h-[1rem] w-[3.4rem] shrink-0`} />
      </div>
      <div className={`${bone} h-[0.7rem] w-[88%] rounded-[6px]`} />
      <div className={`${bone} h-[0.7rem] w-[58%] rounded-[6px]`} />
      <div className={`${bone} mt-auto h-[34px] w-full rounded-full sm:h-[38px]`} />
    </div>
  </article>
);

const SkeletonSection = ({
  cardCount,
  startDelay,
}: {
  cardCount: number;
  startDelay: number;
}) => (
  <section className="scroll-mt-[9.5rem]">
    <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-end gap-x-4 gap-y-[0.85rem]">
      <div
        className="h-[2.6rem] w-0.5 rounded-full bg-[linear-gradient(180deg,#9C6B4A,rgba(156,107,74,.15))]"
        aria-hidden="true"
      />
      <div className="space-y-[0.45rem]">
        <div className={`${bone} h-[0.55rem] w-[4.5rem]`} />
        <div className={`${bone} h-[1.55rem] w-[9.5rem] rounded-[8px] sm:h-[1.85rem] sm:w-[12rem]`} />
      </div>
      <div className={`${bone} mb-[0.25rem] h-[0.55rem] w-[4.2rem]`} />
    </header>
    <div className="grid grid-cols-2 gap-3 sm:gap-[1.15rem] min-[980px]:grid-cols-3 min-[980px]:gap-5">
      {Array.from({ length: cardCount }, (_, i) => (
        <SkeletonCard
          key={i}
          delayClass={CARD_DELAYS[(startDelay + i) % CARD_DELAYS.length] ?? "delay-0"}
        />
      ))}
    </div>
  </section>
);

/** Soft product-grid placeholder shown while `/menu` server data loads. */
export const MenuPageSkeleton = () => (
  <div
    className="relative isolate min-h-screen overflow-x-clip font-sans text-ink antialiased [background:linear-gradient(180deg,rgba(239,231,216,.55)_0%,transparent_28%),linear-gradient(135deg,#FBF8F1_0%,#F4EDE1_48%,#FBF8F1_100%)]"
    aria-busy="true"
    aria-live="polite"
  >
    <div
      className="pointer-events-none absolute inset-0 z-[-1] [background:radial-gradient(ellipse_55%_35%_at_8%_12%,rgba(156,107,74,.1),transparent_60%),radial-gradient(ellipse_45%_30%_at_92%_18%,rgba(91,98,72,.08),transparent_55%),radial-gradient(ellipse_40%_25%_at_50%_100%,rgba(156,107,74,.06),transparent_50%)]"
      aria-hidden="true"
    />

    <div className="sticky top-0 z-50 bg-paper/90 backdrop-blur-[14px]">
      <header className="relative border-b border-ink/10" role="banner">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-10">
          <div className={`${bone} h-7 w-[7.5rem] rounded-[6px] sm:w-[9rem]`} />
          <div className="flex items-center gap-3">
            <div className={`${bone} hidden h-9 w-[5.5rem] sm:block`} />
            <div className={`${bone} size-9 rounded-full`} />
          </div>
        </div>
      </header>
      <nav className="w-full border-b border-b-ink/10 py-[0.55rem]" aria-hidden="true">
        <div className="mx-auto flex max-w-[1120px] gap-x-[0.6rem] overflow-hidden px-[1.35rem] pt-1 pb-[0.45rem] md:justify-center md:px-9">
          {CHIP_WIDTHS.map((width, i) => (
            <div
              key={width}
              className={`${bone} h-[2.15rem] shrink-0 animate-mp-skel motion-reduce:animate-none`}
              style={{ width, animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
      </nav>
    </div>

    <main id="main">
      <div className="mx-auto max-w-[1120px] px-5 pt-8 pb-4 md:px-8 md:pt-11">
        <section className="mb-7 animate-mp-hero text-center motion-reduce:animate-none">
          <div className={`${bone} mx-auto h-[0.55rem] w-[11rem]`} />
          <div
            className={`${bone} mx-auto mt-[0.95rem] h-[2.4rem] w-[min(72%,14rem)] rounded-[10px] sm:h-[3rem] sm:w-[16rem]`}
          />
          <div className={`${bone} mx-auto mt-[0.7rem] h-[1.35rem] w-[6.5rem] rounded-[8px]`} />
          <div className={`${bone} mx-auto mt-5 h-[0.75rem] w-[min(90%,22rem)] rounded-[6px]`} />
          <div className={`${bone} mx-auto mt-2 h-[0.75rem] w-[min(70%,16rem)] rounded-[6px]`} />
        </section>
      </div>

      <div className="mx-auto max-w-[1120px] px-5 pt-4 pb-[6.5rem] md:px-8 md:pb-[5.5rem]">
        <div className="flex flex-col gap-11">
          <SkeletonSection cardCount={6} startDelay={0} />
          <SkeletonSection cardCount={3} startDelay={2} />
        </div>
        <p className="sr-only">Загрузка меню…</p>
      </div>
    </main>
  </div>
);
