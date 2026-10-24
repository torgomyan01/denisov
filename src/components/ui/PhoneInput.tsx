"use client";

import { maskRuPhone } from "@/lib/phone";

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (masked: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  name?: string;
}

export const PhoneInput = ({
  id,
  value,
  onChange,
  placeholder = "+7 900 000-00-00",
  required = false,
  disabled = false,
  autoComplete = "tel",
  className = "",
  name,
}: PhoneInputProps) => {
  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={value}
      maxLength={18}
      onChange={(e) => onChange(maskRuPhone(e.target.value))}
      onFocus={(e) => {
        if (!e.target.value) onChange("+7 ");
      }}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === "+7" || v === "+7 ") onChange("");
      }}
    />
  );
};
