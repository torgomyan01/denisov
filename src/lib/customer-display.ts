import type { CustomerPublic } from "@/lib/customer-auth";
import { formatPhoneDisplay } from "@/lib/phone";

const safeText = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

export const customerFullName = (customer: CustomerPublic): string =>
  [safeText(customer.name), safeText(customer.surname)]
    .filter(Boolean)
    .join(" ");

export const customerInitials = (customer: CustomerPublic): string => {
  const first = safeText(customer.name)[0] ?? "";
  const last = safeText(customer.surname)[0] ?? "";
  const letters = `${first}${last}`.toUpperCase();
  if (letters) return letters;
  const fallback = customerFullName(customer) || "Д";
  return fallback.slice(0, 1).toUpperCase();
};

export const customerDisplayName = (customer: CustomerPublic): string => {
  const full = customerFullName(customer);
  if (full) return full;
  if (customer.phone) return formatPhoneDisplay(customer.phone);
  return "Аккаунт";
};

export const customerFirstName = (customer: CustomerPublic): string => {
  const first = safeText(customer.name);
  if (first) return first;
  return customerDisplayName(customer).split(/\s+/)[0] || "Аккаунт";
};
