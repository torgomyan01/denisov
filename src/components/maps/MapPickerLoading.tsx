import type { ReactNode } from "react";

type MapPickerLoadingProps = {
  children: ReactNode;
  /** Tailwind height utilities; defaults to the standard 280px map height. */
  heightClassName?: string;
  isError?: boolean;
};

export const MapPickerLoading = ({
  children,
  heightClassName = "h-[280px]",
  isError = false,
}: MapPickerLoadingProps) => (
  <div
    className={`grid place-items-center rounded-[14px] border p-4 text-center text-[0.9rem] leading-[1.4] ${heightClassName} ${
      isError
        ? "border-solid border-[rgba(156,80,60,0.35)] bg-[rgba(156,80,60,0.06)] text-[#7a3d2e]"
        : "border-dashed border-[rgba(28,24,20,0.15)] bg-white/40 text-ink/50"
    }`}
    role={isError ? "alert" : undefined}
  >
    {children}
  </div>
);
