/** Shared Tailwind class sets for cart drawer, checkout and map modal. */

export const cartKicker =
  "mb-[0.2rem] text-[10px] tracking-[0.22em] text-clay uppercase";

export const cartCloseButton =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-ink/12 bg-white/55 p-0 text-ink hover:border-transparent hover:bg-clay hover:text-paper";

export const cartTitle =
  "font-serif text-[1.55rem] leading-[1.1] text-ink";

const deliveryAddressBase =
  "flex flex-wrap items-start gap-[0.35rem] rounded-xl border px-[0.7rem] py-[0.55rem] text-[0.86rem] leading-[1.35]";

export const cartDeliveryAddress = (ok: boolean): string =>
  `${deliveryAddressBase} ${
    ok
      ? "border-[rgba(44,58,46,0.12)] bg-[rgba(44,58,46,0.06)] text-[#2c3a2e]"
      : "border-ink/8 bg-white/72 text-ink/48 italic"
  }`;

/** Primary dark pill button (cart footer, checkout submit, success CTA). */
export const cartCheckoutButton =
  "min-h-12 w-full cursor-pointer rounded-full border-0 bg-ink text-[12px] leading-none font-bold tracking-[0.16em] text-paper uppercase enabled:hover:bg-clay disabled:cursor-not-allowed disabled:opacity-45";

export const cartCheckoutSubmitButton = `${cartCheckoutButton} relative inline-flex items-center justify-center gap-[0.55rem] overflow-hidden transition-[translate,background-color,box-shadow] duration-200 enabled:hover:-translate-y-px enabled:hover:shadow-[0_12px_28px_rgba(33,30,25,0.18)]`;

export const cartCheckoutTitle =
  "mt-[0.15rem] font-serif text-[1.55rem] leading-[1.1] text-ink";

export const cartStepsList = "m-0 grid list-none grid-cols-3 gap-[0.35rem] p-0";

export type CartStepState = "idle" | "done" | "current";

const stepBase =
  "relative px-[0.35rem] pt-[0.45rem] pb-[0.55rem] text-center text-[10px] leading-none font-[650] tracking-[0.12em] uppercase after:absolute after:inset-x-[12%] after:bottom-0 after:h-0.5 after:rounded-full after:transition-[background-color,scale] after:duration-350 after:ease-in-out after:content-['']";

const stepState: Record<CartStepState, string> = {
  idle: "text-ink/35 after:scale-x-[0.85] after:bg-ink/10",
  done: "text-clay after:scale-x-100 after:bg-clay",
  current: "text-ink after:scale-x-100 after:bg-clay",
};

export const cartStepItem = (state: CartStepState): string =>
  `${stepBase} ${stepState[state]}`;

/** Staggered entrance; set `--i` via inline style. */
export const cartCheckoutEnter =
  "animate-cart-rise [animation-delay:calc(0.07s*var(--i,0))] motion-reduce:animate-none";

export const cartIcon = "block shrink-0";
