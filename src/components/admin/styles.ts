import type { OrderStatus } from "@/lib/orders";

/** Joins truthy class fragments. */
export const cx = (
  ...parts: Array<string | false | null | undefined>
): string => parts.filter(Boolean).join(" ");

/* ——— Buttons ——— */

const BTN =
  "inline-flex cursor-pointer items-center justify-center gap-[0.45rem] whitespace-nowrap rounded-full px-[18px] py-[11px] text-[11px] font-semibold uppercase tracking-[0.14em] no-underline transition duration-200 not-disabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55";

export const btnDark = `${BTN} bg-ink text-paper not-disabled:hover:bg-clay not-disabled:hover:shadow-[0_10px_24px_rgba(156,107,74,0.25)]`;

export const btnLine = `${BTN} border border-ink/12 bg-white/55 text-ink not-disabled:hover:border-clay not-disabled:hover:text-clay`;

export const btnGhostSoft = `${BTN} border border-transparent bg-white/35 text-ink not-disabled:hover:border-ink/12 not-disabled:hover:bg-white`;

/** Primary / secondary buttons inside the dark sticky save bar. */
export const btnSaveDark = `${BTN} bg-clay text-paper not-disabled:hover:bg-[#b07d58] not-disabled:hover:shadow-[0_10px_24px_rgba(156,107,74,0.25)]`;

export const btnSaveLine = `${BTN} border border-paper/22 bg-transparent text-paper not-disabled:hover:border-paper/55 not-disabled:hover:text-white`;

const BTN_SM =
  "cursor-pointer rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]";

export const btnSmGhost = `${BTN_SM} border border-ink/12 bg-transparent text-ink hover:border-clay hover:text-clay`;

export const btnSmDanger = `${BTN_SM} bg-transparent text-danger hover:underline`;

export const btnDangerText =
  "cursor-pointer bg-transparent text-[10px] font-semibold uppercase tracking-[0.12em] text-danger hover:underline";

/* ——— Form fields ——— */

/** Field wrapper: stacks the label above the control. */
export const fieldClass =
  "flex flex-col gap-2 [&_label]:m-0 [&_label]:block [&_label]:text-[10px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-[0.18em] [&_label]:text-ink/48";

const INPUT_SHELL =
  "w-full border border-ink/12 font-sans font-medium outline-none transition duration-200 placeholder:text-ink/35";

const INPUT_SHAPE_DEFAULT =
  "rounded-[14px] px-[15px] py-[13px] text-[15px] leading-[1.45]";

const INPUT_SHAPE_COMPACT =
  "rounded-[10px] px-[11px] py-[9px] text-[13px] leading-[1.45]";

const INPUT_EDITABLE =
  "bg-paper text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:border-clay/35 focus:border-clay focus:bg-white focus:shadow-[0_0_0_4px_rgba(156,107,74,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]";

const INPUT_LOCKED =
  "cursor-default border-dashed bg-[#f4efe6]/85 text-ink/72 shadow-none";

interface InputClassOptions {
  locked?: boolean;
  compact?: boolean;
  multiline?: boolean;
}

export const inputClass = ({
  locked = false,
  compact = false,
  multiline = false,
}: InputClassOptions = {}): string =>
  cx(
    INPUT_SHELL,
    compact ? INPUT_SHAPE_COMPACT : INPUT_SHAPE_DEFAULT,
    locked ? INPUT_LOCKED : INPUT_EDITABLE,
    multiline && "min-h-[104px] resize-y",
  );

/* ——— Shell ——— */

export const adminRootClass =
  "min-h-screen bg-[#f4efe6] bg-[image:radial-gradient(ellipse_70%_50%_at_8%_-10%,rgba(156,107,74,0.1),transparent_55%),radial-gradient(ellipse_45%_35%_at_100%_0%,rgba(44,58,46,0.06),transparent_50%),radial-gradient(ellipse_40%_30%_at_50%_100%,rgba(156,107,74,0.05),transparent_60%)] font-sans text-ink";

/* ——— Navigation & tabs ——— */

export const navGroupClass = (highlighted: boolean): string =>
  cx(
    "rounded-xl border transition duration-200",
    highlighted ? "border-ink/12 bg-white/45" : "border-transparent",
  );

export const navChevronClass = (open: boolean, inline = false): string =>
  cx(
    "inline-flex shrink-0 items-center justify-center text-xs leading-none opacity-55 transition-transform duration-[180ms]",
    inline ? "ml-[0.15rem] w-auto" : "w-4",
    open ? "rotate-0" : "-rotate-90",
  );

export const navSubItemClass = (active: boolean): string =>
  cx(
    "flex w-full cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-[0.55rem] py-[0.4rem] text-left transition duration-150 hover:border-ink/12",
    active
      ? "bg-ink text-paper shadow-[0_6px_16px_rgba(33,30,25,0.14)]"
      : "bg-transparent text-ink/48 hover:bg-white/85 hover:text-ink",
  );

export const navSubIconClass = (active: boolean): string =>
  cx(
    "grid size-5 shrink-0 place-items-center rounded-md [&_svg]:size-3",
    active ? "bg-paper/14 text-paper" : "bg-clay/10 text-clay",
  );

export const navBadgeClass = (active: boolean): string =>
  cx(
    "ml-auto inline-grid h-5 min-w-5 animate-admin-badge place-items-center rounded-full px-[0.35rem] text-[10px] font-bold leading-none tracking-normal",
    active ? "bg-[#f3b7a4] text-[#5c2416]" : "bg-[#c45c3a] text-white",
  );

export const tabClass = (active: boolean): string =>
  cx(
    "inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border px-[15px] py-[9px] text-xs font-semibold uppercase tracking-[0.12em] transition duration-200",
    active
      ? "border-ink bg-ink text-white shadow-[0_6px_18px_rgba(33,30,25,0.18)]"
      : "border-ink/12 bg-white/55 text-ink/48 hover:border-clay/40 hover:bg-white hover:text-ink",
  );

export const chipClass = (dirty: boolean): string =>
  cx(
    "inline-flex items-center gap-[0.35rem] rounded-full border px-[0.7rem] py-[0.35rem] text-[10px] font-bold uppercase tracking-[0.12em]",
    dirty
      ? "border-clay/35 bg-clay/10 text-clay"
      : "border-[#2f6b4f]/25 bg-[#2f6b4f]/8 text-[#2f6b4f]",
  );

/* ——— Editor pieces ——— */

export const adminGridClass = (withPreview: boolean): string =>
  cx(
    "grid gap-5",
    withPreview &&
      "min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] min-[1100px]:items-start",
  );

export const logoModeClass = (active: boolean): string =>
  cx(
    "flex w-full cursor-pointer flex-col items-start gap-1 rounded-2xl border px-4 py-[0.85rem] text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 [&_strong]:text-sm [&_strong]:font-semibold [&_span]:text-xs [&_span]:leading-[1.35] [&_span]:text-ink/48",
    active
      ? "border-clay bg-clay/8 shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
      : "border-ink/12 bg-paper hover:border-clay/40",
  );

export const menuCatChevronClass = (open: boolean): string =>
  cx(
    "ml-[0.15rem] size-[0.55rem] shrink-0 border-r-[1.5px] border-b-[1.5px] border-clay transition-transform duration-200",
    open ? "-mt-[0.15rem] rotate-45" : "-rotate-45",
  );

export const menuItemUploadClass = (busy: boolean): string =>
  cx(
    "relative inline-flex w-full max-w-[220px] min-w-[72px] cursor-pointer items-center justify-center rounded-full border border-clay/20 bg-paper/90 px-3 py-[0.4rem] text-[10px] font-bold uppercase tracking-[0.08em] text-clay transition duration-200 hover:border-clay/45 hover:bg-paper [&_input]:absolute [&_input]:inset-0 [&_input]:cursor-pointer [&_input]:opacity-0",
    busy && "pointer-events-none cursor-wait opacity-55",
  );

/* ——— Toast ——— */

export type ToastTone = "success" | "error";

const TOAST_BASE =
  "pointer-events-none fixed right-5 bottom-6 z-[10000] max-w-[min(360px,calc(100vw_-_2rem))] rounded-[14px] px-[18px] py-[13px] text-sm text-white shadow-[0_12px_30px_rgba(44,58,46,0.25)] transition duration-300";

const TOAST_TONE: Record<ToastTone, string> = {
  success: "bg-[#2f6b4f]",
  error: "bg-[#8f2f28]",
};

export const toastClass = (tone: ToastTone, visible: boolean): string =>
  cx(
    TOAST_BASE,
    TOAST_TONE[tone],
    visible ? "translate-y-0 opacity-100" : "translate-y-[10px] opacity-0",
  );

/* ——— Order status badge ——— */

const ORDER_BADGE_BASE =
  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-[0.2rem] text-[0.72rem] uppercase tracking-[0.04em]";

const ORDER_BADGE_TONE: Record<OrderStatus, string> = {
  new: "bg-clay/18 text-[#7a4e32]",
  confirmed: "bg-[#5a7aa0]/16 text-[#35506e]",
  preparing: "bg-[#5a7aa0]/16 text-[#35506e]",
  ready: "bg-[#6b8f71]/18 text-[#3f6a46]",
  delivering: "bg-[#6b8f71]/18 text-[#3f6a46]",
  completed: "bg-ink/8 text-ink",
  cancelled: "bg-danger/14 text-[#8a2f22]",
};

export const orderBadgeClass = (status: OrderStatus): string =>
  cx(ORDER_BADGE_BASE, ORDER_BADGE_TONE[status]);
