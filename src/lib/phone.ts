/** Digits only, RU mobile: leading 8→7, max 11 digits starting with 7. */
export const extractRuPhoneDigits = (raw: string): string => {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }
  if (!digits.startsWith("7") && digits.length > 0) {
    digits = `7${digits}`;
  }

  return digits.slice(0, 11);
};

/** Live mask while typing: +7 XXX XXX-XX-XX */
export const maskRuPhone = (raw: string): string => {
  const digits = extractRuPhoneDigits(raw);
  if (!digits) return "";

  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length === 0) return out;

  out += ` ${rest.slice(0, 3)}`;
  if (rest.length <= 3) return out;

  out += ` ${rest.slice(3, 6)}`;
  if (rest.length <= 6) return out;

  out += `-${rest.slice(6, 8)}`;
  if (rest.length <= 8) return out;

  out += `-${rest.slice(8, 10)}`;
  return out;
};

/** Normalize RU phone to +7XXXXXXXXXX or null if incomplete/invalid. */
export const normalizePhone = (raw: string): string | null => {
  const digits = extractRuPhoneDigits(raw);
  if (digits.length !== 11 || !digits.startsWith("7")) return null;
  return `+${digits}`;
};

export const formatPhoneDisplay = (phone: string): string => {
  const digits = extractRuPhoneDigits(phone);
  if (digits.length !== 11) return phone;
  return maskRuPhone(digits);
};

export const isCompleteRuPhone = (raw: string): boolean =>
  normalizePhone(raw) !== null;
