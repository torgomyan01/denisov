export type IikoConfig = {
  baseUrl: string;
  apiKey: string;
  appId: string;
  clientSecret: string;
  organizationId: string;
  terminalGroupId: string;
  paymentTypeId: string;
  /** Must match iiko payment type: Cash | Card | External | … */
  paymentTypeKind: string;
  city: string;
  sourceKey: string;
};

const trim = (value: string | undefined): string => (value ?? "").trim();

export const getIikoConfig = (): IikoConfig => ({
  baseUrl: trim(process.env.IIKO_API_BASE_URL) || "https://api-ru.iiko.services",
  apiKey: trim(process.env.IIKO_API_KEY),
  appId: trim(process.env.IIKO_APP_ID),
  clientSecret: trim(process.env.IIKO_CLIENT_SECRET),
  organizationId: trim(process.env.IIKO_ORGANIZATION_ID),
  terminalGroupId: trim(process.env.IIKO_TERMINAL_GROUP_ID),
  paymentTypeId: trim(process.env.IIKO_PAYMENT_TYPE_ID),
  paymentTypeKind: trim(process.env.IIKO_PAYMENT_TYPE_KIND) || "Card",
  city: trim(process.env.IIKO_CITY) || "Санкт-Петербург",
  sourceKey: trim(process.env.IIKO_SOURCE_KEY) || "denisov-web",
});

/** True when we have enough credentials to call iiko Cloud. */
export const isIikoConfigured = (config: IikoConfig = getIikoConfig()): boolean => {
  if (!config.apiKey || !config.organizationId) return false;
  // Official v2 auth needs all three; legacy apiLogin-only still works on some tenants.
  const hasV2 = Boolean(config.appId && config.clientSecret);
  return hasV2 || Boolean(config.apiKey);
};

export const iikoAuthMode = (
  config: IikoConfig = getIikoConfig(),
): "v2" | "legacy" | "none" => {
  if (!config.apiKey) return "none";
  if (config.appId && config.clientSecret) return "v2";
  return "legacy";
};
