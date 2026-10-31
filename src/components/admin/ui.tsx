"use client";

import {
  btnDark,
  btnLine,
  cx,
  fieldClass,
  inputClass,
} from "@/components/admin/styles";
import {
  BookOpen,
  Info,
  LayoutTemplate,
  List,
  Mail,
  MapPin,
  Menu,
  PanelTop,
  QrCode,
  ShoppingBag,
  Upload,
  Users,
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { maskRuPhone } from "@/lib/phone";

export type FieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "password" | "url" | "tel" | "number";
  hint?: string;
  counter?: { current: number; max: number };
  className?: string;
  autoComplete?: string;
  readOnly?: boolean;
  compact?: boolean;
};

export const Field = ({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
  hint,
  counter,
  className = "",
  autoComplete,
  readOnly = false,
  compact = false,
}: FieldProps) => {
  const counterTone =
    counter == null
      ? ""
      : counter.current > counter.max
        ? "text-danger"
        : counter.current > counter.max * 0.9
          ? "text-[#9a6700]"
          : "text-ink/48";
  const controlClass = inputClass({ locked: readOnly, compact, multiline });

  return (
    <div className={cx(fieldClass, className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label>{label}</label>
        {readOnly ? (
          <span className="rounded-full bg-clay/10 px-[0.55rem] py-[0.2rem] text-[10px] font-semibold uppercase tracking-[0.14em] text-clay">
            фиксировано
          </span>
        ) : null}
        {!readOnly && counter ? (
          <span className={cx("text-[11px] tabular-nums", counterTone)}>
            {counter.current}/{counter.max}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          className={controlClass}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : type === "tel" && !readOnly ? (
        <input
          className={controlClass}
          type="tel"
          inputMode="numeric"
          value={value}
          placeholder={placeholder ?? "+7 900 000-00-00"}
          autoComplete={autoComplete ?? "tel"}
          maxLength={18}
          onChange={(e) => onChange?.(maskRuPhone(e.target.value))}
          onFocus={(e) => {
            if (!e.target.value) onChange?.("+7 ");
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v === "+7" || v === "+7 ") onChange?.("");
          }}
        />
      ) : (
        <input
          className={controlClass}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {hint ? <p className="text-xs leading-[1.4] text-ink/48">{hint}</p> : null}
    </div>
  );
};

export type ToggleFieldProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
  disabled?: boolean;
};

export const ToggleField = ({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
}: ToggleFieldProps) => (
  <div className={fieldClass}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-[0.85rem] py-[0.75rem] text-left transition-colors duration-160",
        checked
          ? "border-clay/40 bg-clay/8"
          : "border-ink/12 bg-paper/95 hover:border-clay/25",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      onClick={() => onChange(!checked)}
    >
      <span className="text-[0.9rem] font-[650] text-ink">{label}</span>
      <span
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-160",
          checked ? "bg-clay" : "bg-ink/18",
        )}
        aria-hidden="true"
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-160",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
    {hint ? <p className="text-xs leading-[1.4] text-ink/48">{hint}</p> : null}
  </div>
);

export type FileDropProps = {
  label: string;
  title: string;
  hint: string;
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
};

const FILE_DROP_BASE =
  "relative flex cursor-pointer items-center overflow-hidden border-[1.5px] transition duration-200 [&_strong]:block [&_strong]:font-semibold [&_span]:mt-0.5 [&_span]:block [&_span]:text-ink/48 [&_input[type=file]]:absolute [&_input[type=file]]:inset-0 [&_input[type=file]]:size-full [&_input[type=file]]:cursor-pointer [&_input[type=file]]:opacity-0";

const FILE_DROP_DEFAULT =
  "min-h-[72px] gap-[14px] rounded-2xl px-4 py-[14px] [&_strong]:text-sm [&_span]:text-xs";

const FILE_DROP_COMPACT =
  "min-h-[52px] gap-[10px] rounded-xl px-3 py-[10px] [&_strong]:text-xs [&_span]:text-[11px]";

const FILE_DROP_IDLE =
  "border-dashed border-clay/35 bg-[linear-gradient(180deg,rgba(251,248,241,0.95),rgba(244,239,230,0.7))] hover:-translate-y-px hover:border-clay hover:bg-white hover:bg-none hover:shadow-[0_10px_28px_rgba(156,107,74,0.1)]";

const FILE_DROP_OVER =
  "-translate-y-px border-solid border-clay bg-clay/6 shadow-[0_10px_28px_rgba(156,107,74,0.1)]";

export const FileDrop = ({
  label,
  title,
  hint,
  accept,
  onFile,
  disabled = false,
  compact = false,
}: FileDropProps) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const takeFile = (file: File | undefined) => {
    if (!file || disabled) return;
    onFile(file);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setOver(true);
  };

  const onDragLeave = () => setOver(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    takeFile(e.dataTransfer.files?.[0]);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    takeFile(file);
  };

  return (
    <div className="flex flex-col gap-2 [&>label]:m-0 [&>label]:block [&>label]:text-[10px] [&>label]:font-semibold [&>label]:uppercase [&>label]:tracking-[0.18em] [&>label]:text-ink/48">
      <label>{label}</label>
      <div
        className={cx(
          FILE_DROP_BASE,
          compact ? FILE_DROP_COMPACT : FILE_DROP_DEFAULT,
          over ? FILE_DROP_OVER : FILE_DROP_IDLE,
          disabled && "pointer-events-none opacity-70",
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div
          className={cx(
            "grid shrink-0 place-items-center bg-clay/12 text-clay",
            compact ? "size-8 rounded-[9px]" : "size-[42px] rounded-xl",
          )}
          aria-hidden="true"
        >
          <Upload size={18} strokeWidth={1.75} />
        </div>
        <div>
          <strong>{title}</strong>
          <span>{hint}</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = "Удалить",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid animate-fade-in place-items-center bg-[#181612]/55 p-4 backdrop-blur-[6px]" role="presentation" onClick={onCancel}>
      <div
        className="w-[min(420px,100%)] animate-panel-in rounded-[20px] border border-ink/12 bg-paper px-[1.35rem] pt-[1.35rem] pb-[1.2rem] shadow-[0_24px_60px_rgba(0,0,0,0.25)] [&_h3]:m-0 [&_h3]:font-serif [&_h3]:text-[1.55rem] [&_p]:mt-[0.55rem] [&_p]:mb-[1.2rem] [&_p]:leading-normal [&_p]:text-ink/48"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnLine} onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={btnDark} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const IconNav = ({ name }: { name: string }) => {
  const props = { size: 15, strokeWidth: 1.75, "aria-hidden": true as const };

  switch (name) {
    case "hero":
      return <PanelTop {...props} />;
    case "about":
      return <Info {...props} />;
    case "contacts":
      return <Mail {...props} />;
    case "menu":
      return <Menu {...props} />;
    case "pickup":
      return <MapPin {...props} />;
    case "orders":
      return <ShoppingBag {...props} />;
    case "fulfillment":
      return <QrCode {...props} />;
    case "users":
      return <Users {...props} />;
    case "docs":
      return <BookOpen {...props} />;
    case "sections":
      return <List {...props} />;
    default:
      return <LayoutTemplate {...props} />;
  }
};

const PREVIEW_BASE =
  "w-full border border-ink/12 bg-sand shadow-[0_8px_24px_rgba(33,30,25,0.06)]";

const PREVIEW_FRAME =
  "aspect-[4/5] rounded-2xl bg-[linear-gradient(135deg,rgba(239,231,216,0.9),rgba(244,239,230,0.6))] object-cover";

const PREVIEW_COMPACT =
  "aspect-square max-h-[140px] rounded-[10px] bg-[linear-gradient(145deg,rgba(239,231,216,0.75),rgba(251,248,241,0.95))] object-contain";

const PREVIEW_LOGO =
  "h-16 w-auto max-w-full rounded-[14px] border border-ink/12 bg-sand px-[14px] py-[10px] object-contain";

export const MediaPreview = ({
  src,
  alt = "",
  logo = false,
  compact = false,
  onOpen,
}: {
  src: string;
  alt?: string;
  logo?: boolean;
  compact?: boolean;
  onOpen?: () => void;
}) => {
  if (!src) {
    return (
      <div
        className={cx(
          "grid place-items-center text-center text-xs uppercase tracking-[0.06em] text-ink/48",
          logo
            ? cx(PREVIEW_LOGO, "aspect-[4/5]")
            : cx(PREVIEW_BASE, PREVIEW_FRAME, "p-4"),
        )}
      >
        Нет фото
      </div>
    );
  }

  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={PREVIEW_LOGO} src={src} alt={alt} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cx(
        PREVIEW_BASE,
        compact ? PREVIEW_COMPACT : PREVIEW_FRAME,
        onOpen &&
          "cursor-zoom-in transition-transform duration-[250ms] hover:scale-[1.015]",
      )}
      src={src}
      alt={alt}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onOpen();
            }
          : undefined
      }
    />
  );
};

export const EmptyState = ({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) => (
  <div className="rounded-[18px] border-[1.5px] border-dashed border-clay/28 bg-paper/55 px-5 py-10 text-center [&_h3]:m-0 [&_h3]:font-serif [&_h3]:text-[1.55rem] [&_p]:mx-auto [&_p]:mt-[0.55rem] [&_p]:mb-[1.1rem] [&_p]:max-w-[28rem] [&_p]:text-[0.95rem] [&_p]:text-ink/48">
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);
