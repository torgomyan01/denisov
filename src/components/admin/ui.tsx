"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";

export type FieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "password" | "url" | "tel";
  hint?: string;
  counter?: { current: number; max: number };
  className?: string;
  autoComplete?: string;
  readOnly?: boolean;
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
}: FieldProps) => {
  const counterClass =
    counter == null
      ? ""
      : counter.current > counter.max
        ? "bad"
        : counter.current > counter.max * 0.9
          ? "warn"
          : "";

  return (
    <div className={`field${readOnly ? " is-locked" : ""} ${className}`.trim()}>
      <div className="field-label-row">
        <label>{label}</label>
        {readOnly ? <span className="field-lock">фиксировано</span> : null}
        {!readOnly && counter ? (
          <span className={`field-counter ${counterClass}`}>
            {counter.current}/{counter.max}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
};

export type FileDropProps = {
  label: string;
  title: string;
  hint: string;
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
};

export const FileDrop = ({
  label,
  title,
  hint,
  accept,
  onFile,
  disabled = false,
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
    <div className="file-field">
      <label>{label}</label>
      <div
        className={`file-drop${over ? " is-over" : ""}${disabled ? " is-busy" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="file-ico" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M4 20h16" />
          </svg>
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
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-line" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="btn btn-dark" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const IconNav = ({ name }: { name: string }) => {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
  } as const;

  switch (name) {
    case "hero":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "dishes":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="7" height="7" rx="1.5" />
          <rect x="14" y="5" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "about":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 10v6M12 7.5h.01" />
        </svg>
      );
    case "contacts":
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4z" />
          <path d="M4 8l8 5 8-5" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M5 7h14M5 12h14M5 17h10" />
        </svg>
      );
    default:
      return null;
  }
};

export const MediaPreview = ({
  src,
  alt = "",
  logo = false,
  onOpen,
}: {
  src: string;
  alt?: string;
  logo?: boolean;
  onOpen?: () => void;
}) => {
  if (!src) {
    return (
      <div className={`preview preview-empty${logo ? " preview-logo" : ""}`}>
        Нет фото
      </div>
    );
  }

  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="preview-logo" src={src} alt={alt} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`preview${onOpen ? " preview-clickable" : ""}`}
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
  <div className="empty-state">
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);
