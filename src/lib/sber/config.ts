export type SberConfig = {
  userName: string;
  password: string;
  merchantLogin: string;
  /** Base without trailing slash, e.g. https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1 */
  apiBaseUrl: string;
  /** Accounts API base for set-permanent-password */
  accountsBaseUrl: string;
  siteUrl: string;
};

const trim = (value: string | undefined): string => (value ?? "").trim();

export const getSberConfig = (): SberConfig => {
  const siteUrl = trim(process.env.SITE_URL) || "http://localhost:3000";
  const apiBaseUrl =
    trim(process.env.SBER_API_BASE_URL) ||
    "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1";
  const accountsBaseUrl =
    trim(process.env.SBER_ACCOUNTS_BASE_URL) ||
    "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/accounts/v1";

  return {
    userName: trim(process.env.SBER_USER_NAME),
    password: trim(process.env.SBER_PASSWORD),
    merchantLogin: trim(process.env.SBER_MERCHANT_LOGIN),
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    accountsBaseUrl: accountsBaseUrl.replace(/\/$/, ""),
    siteUrl: siteUrl.replace(/\/$/, ""),
  };
};

export const isSberConfigured = (
  config: SberConfig = getSberConfig(),
): boolean => Boolean(config.userName && config.password);

export const sberReturnUrls = (config: SberConfig = getSberConfig()) => ({
  returnUrl: `${config.siteUrl}/order/pay/result?status=ok`,
  failUrl: `${config.siteUrl}/order/pay/result?status=fail`,
  dynamicCallbackUrl: `${config.siteUrl}/api/payments/sber/callback`,
});
