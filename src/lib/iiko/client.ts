import {
  getIikoConfig,
  iikoAuthMode,
  type IikoConfig,
} from "@/lib/iiko/config";

type TokenCache = {
  token: string;
  /** epoch ms when we should refresh (skew before JWT exp) */
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

export class IikoApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "IikoApiError";
    this.status = status;
    this.body = body;
  }
}

const readErrorMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as {
      errorDescription?: string;
      message?: string;
      description?: string;
    };
    return (
      parsed.errorDescription ||
      parsed.message ||
      parsed.description ||
      body.slice(0, 300)
    );
  } catch {
    return body.slice(0, 300) || "iiko request failed";
  }
};

const fetchAccessToken = async (config: IikoConfig): Promise<TokenCache> => {
  const mode = iikoAuthMode(config);
  if (mode === "none") {
    throw new IikoApiError("iiko is not configured", 0, "");
  }

  const url =
    mode === "v2"
      ? `${config.baseUrl}/api/v2/access_token`
      : `${config.baseUrl}/api/1/access_token`;

  const payload =
    mode === "v2"
      ? {
          appId: config.appId,
          clientSecret: config.clientSecret,
          apiKey: config.apiKey,
        }
      : { apiLogin: config.apiKey };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new IikoApiError(readErrorMessage(text), res.status, text);
  }

  let token = "";
  try {
    const parsed = JSON.parse(text) as { token?: string };
    token = String(parsed.token ?? "").trim();
  } catch {
    token = "";
  }
  if (!token) {
    throw new IikoApiError("iiko access_token response missing token", res.status, text);
  }

  // Tokens are ~1h; refresh 2 minutes early. Legacy responses have no exp claim parse here.
  return { token, expiresAtMs: Date.now() + 55 * 60 * 1000 };
};

export const getIikoAccessToken = async (
  config: IikoConfig = getIikoConfig(),
): Promise<string> => {
  if (tokenCache && tokenCache.expiresAtMs > Date.now()) {
    return tokenCache.token;
  }
  tokenCache = await fetchAccessToken(config);
  return tokenCache.token;
};

export const clearIikoTokenCache = (): void => {
  tokenCache = null;
};

export const iikoRequest = async <T>(
  path: string,
  body: unknown,
  config: IikoConfig = getIikoConfig(),
): Promise<T> => {
  const token = await getIikoAccessToken(config);
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    // Expired token — clear cache once and retry.
    if (res.status === 401) {
      clearIikoTokenCache();
      const retryToken = await getIikoAccessToken(config);
      const retry = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${retryToken}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const retryText = await retry.text();
      if (!retry.ok) {
        throw new IikoApiError(readErrorMessage(retryText), retry.status, retryText);
      }
      return JSON.parse(retryText) as T;
    }
    throw new IikoApiError(readErrorMessage(text), res.status, text);
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
};
