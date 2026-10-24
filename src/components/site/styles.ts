const easeOut = "ease-[cubic-bezier(.22,1,.36,1)]";

/** Animated underline on hover (header / footer links). */
export const underlineLink =
  "relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-[400ms] after:ease-in-out after:content-[''] hover:after:w-full";

/** Scroll-reveal for landing sections; `data-in` is set by IntersectionObserver. */
export const revealHome = `translate-y-5 opacity-0 transition-[opacity,translate] duration-[900ms] ${easeOut} data-[in]:translate-y-0 data-[in]:opacity-100`;

/** Scroll-reveal for menu categories and cards. */
export const revealMenu = `translate-y-[22px] opacity-0 transition-[opacity,translate] duration-700 ${easeOut} data-[in]:translate-y-0 data-[in]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none`;

/** Stagger for menu cards by column rhythm (index % 4). */
export const menuCardDelay: readonly string[] = [
  "",
  "delay-[60ms]",
  "delay-[120ms]",
  "delay-[180ms]",
];
