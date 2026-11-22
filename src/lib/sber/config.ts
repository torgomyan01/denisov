import fs from "node:fs";
import path from "node:path";

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

/**
 * Next.js `@next/env` runs dotenv-expand, which treats `$VAR` inside values as
 * interpolation (e.g. a password containing `$K3` becomes corrupted). PM2/ecosystem
 * parsers do not expand — so process.env can disagree with the file on disk.
 * Prefer the unexpanded .env value for Sber secrets.
 */
let cachedFileEnv: Record<string, string> | null = null;

const readEnvFileNoExpand = (): Record<string, string> => {
  if (cachedFileEnv) return cachedFileEnv;
  const out: Record<string, string> = {};
  try {
    const filePath = path.join(process.cwd(), ".env");
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) continue;
      const i = s.indexOf("=");
      const k = s.slice(0, i).trim();
      let v = s.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch {
    // no .env (e.g. some CI) — fall back to process.env only
  }
  cachedFileEnv = out;
  return out;
};

const sberSecret = (key: string): string => {
  const fromFile = trim(readEnvFileNoExpand()[key]);
  if (fromFile) return fromFile;
  return trim(process.env[key]);
};

export const getSberConfig = (): SberConfig => {
  const siteUrl = trim(process.env.SITE_URL) || "http://localhost:3000";
  const apiBaseUrl =
    trim(process.env.SBER_API_BASE_URL) ||
    "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1";
  const accountsBaseUrl =
    trim(process.env.SBER_ACCOUNTS_BASE_URL) ||
    "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/accounts/v1";

  const userName = sberSecret("SBER_USER_NAME");
  const merchantLogin = sberSecret("SBER_MERCHANT_LOGIN");

  return {
    userName,
    password: sberSecret("SBER_PASSWORD"),
    // merchantLogin is only for child merchants; same as userName confuses the gateway
    merchantLogin:
      merchantLogin && merchantLogin !== userName ? merchantLogin : "",
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
