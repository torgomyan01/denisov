import type { OrderStatus } from "@/lib/orders";

const EASE_OUT = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export const profilePanelCard =
  "rounded-[22px] border border-ink/10 bg-white/72 px-[1.2rem] pt-5 pb-[1.4rem] shadow-[0_16px_40px_rgba(33,30,25,0.05)] backdrop-blur-sm min-[700px]:px-[1.6rem] min-[700px]:pt-[1.55rem] min-[700px]:pb-[1.7rem]";

export const profilePanelHead =
  "mb-[1.15rem] flex items-start justify-between gap-4 border-b border-ink/10 pb-4";

export const profileBadge =
  "mb-[0.35rem] inline-flex text-[10px] font-[650] tracking-[0.18em] text-clay uppercase";

export const profileTitle =
  "font-serif text-[length:clamp(1.7rem,3vw,2.15rem)] leading-[1.1] font-medium";

export const profileLead =
  "mt-[0.4rem] max-w-[40ch] text-[0.92rem] leading-[1.45] text-ink/48";

export const profileBack =
  "mb-[0.65rem] inline-flex items-center gap-1 font-sans text-[11px] leading-none font-[650] tracking-[0.12em] text-clay uppercase no-underline hover:text-ink";

export const profileEditBtn =
  "min-h-10 shrink-0 cursor-pointer rounded-full border border-ink/10 bg-white/70 px-4 font-sans text-[11px] leading-none font-[650] tracking-[0.1em] text-ink uppercase transition-colors duration-180 hover:enabled:border-clay/20 hover:enabled:bg-clay/8 disabled:cursor-wait disabled:opacity-50";

export const profileBlockTitle =
  "text-[0.72rem] font-[650] tracking-[0.14em] text-ink/48 uppercase";

export const profileOrdersMuted = "mt-1 text-[0.92rem]";
export const profileOrdersError = "mt-1 text-[0.92rem] text-danger";

const statusBase =
  "inline-flex items-center rounded-full px-[0.55rem] py-[0.22rem] text-[0.72rem] tracking-[0.06em] whitespace-nowrap uppercase";

const statusTone: Record<OrderStatus, string> = {
  new: "bg-clay/14 text-clay-deep",
  confirmed: "bg-clay/14 text-clay-deep",
  preparing: "bg-clay/14 text-clay-deep",
  ready: "bg-clay/14 text-clay-deep",
  delivering: "bg-clay/14 text-clay-deep",
  completed: "bg-olive/14 text-olive",
  cancelled: "bg-danger/12 text-[#8a2f22]",
};

export const profileOrderStatus = (status: OrderStatus): string =>
  `${statusBase} ${statusTone[status] ?? "bg-ink/8 text-ink"}`;

export const profileOrderEta = (large: boolean): string =>
  `inline-flex items-center gap-[0.35rem] text-clay-deep ${
    large
      ? "mt-3 text-[0.95rem] font-[650]"
      : "mt-[0.55rem] text-[0.86rem]"
  }`;

export const profileOrderProgress = (large: boolean): string =>
  `overflow-hidden rounded-full bg-ink/8 ${
    large ? "mt-[0.85rem] h-1.5" : "mt-[0.65rem] h-1"
  }`;

export const profileOrderProgressBar = `block h-full rounded-[inherit] bg-[image:linear-gradient(90deg,#9c6b4a,#6f4a34)] transition-[width] duration-450 ${EASE_OUT} motion-reduce:transition-none`;
