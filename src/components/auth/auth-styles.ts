export const authPageClass =
  "relative min-h-screen overflow-hidden bg-[image:radial-gradient(ellipse_70%_55%_at_12%_0%,rgba(156,107,74,0.14),transparent_55%),radial-gradient(ellipse_55%_45%_at_100%_10%,rgba(44,58,46,0.08),transparent_50%),radial-gradient(ellipse_40%_35%_at_50%_100%,rgba(156,107,74,0.07),transparent_60%),linear-gradient(165deg,#fbf8f1_0%,#efe7d8_48%,#f7f2e8_100%)] text-ink before:pointer-events-none before:absolute before:-top-1/5 before:-right-[10%] before:size-[min(55vw,520px)] before:animate-auth-orb before:rounded-full before:bg-[image:radial-gradient(circle,rgba(156,107,74,0.12),transparent_70%)] before:content-[''] after:pointer-events-none after:absolute after:-bottom-[15%] after:-left-[10%] after:size-[min(48vw,420px)] after:animate-auth-orb after:rounded-full after:bg-[image:radial-gradient(circle,rgba(91,98,72,0.1),transparent_70%)] after:content-[''] motion-reduce:before:animate-none motion-reduce:after:animate-none";

export const authLoadingClass =
  "grid min-h-[60vh] animate-auth-rise place-items-center gap-4 text-ink/45 motion-reduce:animate-none";

export const authSpinnerClass =
  "size-7 animate-auth-spin rounded-full border-2 border-ink/12 border-t-clay motion-reduce:animate-none";

export const authInputBaseClass =
  "w-full rounded-2xl border border-ink/10 bg-paper/95 py-[0.95rem] pl-[1.05rem] font-sans text-[15px] leading-[1.4] font-medium text-ink outline-none transition-[border-color,box-shadow,background-color,translate] duration-250 hover:border-clay/35 focus:-translate-y-px focus:border-clay focus:bg-white focus:shadow-[0_0_0_4px_rgba(156,107,74,0.12)] motion-reduce:transition-none";

export const authInputClass = `${authInputBaseClass} pr-[1.05rem]`;
