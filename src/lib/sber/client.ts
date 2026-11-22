import https from "node:https";
import { URL } from "node:url";
import {
  getSberConfig,
  isSberConfigured,
  sberReturnUrls,
  type SberConfig,
} from "@/lib/sber/config";

export type SberRegisterResult =
  | { ok: true; orderId: string; formUrl: string }
  | { ok: false; error: string };

export type SberOrderStatusResult =
  | {
      ok: true;
      orderStatus: number;
      paymentState: string | null;
      actionCode: number | null;
      orderNumber: string | null;
      deposited: boolean;
      declined: boolean;
    }
  | { ok: false; error: string };

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};

/** Local antivirus MITM often breaks Node fetch TLS — set SBER_TLS_INSECURE=1 only on that machine. */
const allowInsecureTls = (): boolean =>
  process.env.SBER_TLS_INSECURE === "1" ||
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

const networkErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "Не удалось связаться со Sber";
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : "";
  const detail = `${error.message}${cause ? `: ${cause}` : ""}`;
  if (/self-signed|CERT|certificate/i.test(detail)) {
    return "TLS к Sber заблокирован (часто антивирус). Для локали: SBER_TLS_INSECURE=1";
  }
  return detail || "Не удалось связаться со Sber";
};

const postJson = async (
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: JsonRecord; status: number }> => {
  const target = new URL(url);
  const payload = JSON.stringify(body);
  const insecure = allowInsecureTls();

  const { status, text } = await new Promise<{
    status: number;
    text: string;
  }>((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        rejectUnauthorized: !insecure,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(25_000, () => {
      req.destroy(new Error("Таймаут ответа Sber (25с)"));
    });
    req.write(payload);
    req.end();
  });

  let data: JsonRecord = {};
  try {
    data = asRecord(JSON.parse(text));
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  return { ok: status >= 200 && status < 300, data, status };
};

const errorFromPayload = (data: JsonRecord, fallback: string): string => {
  const code = asString(data.errorCode);
  const message =
    asString(data.errorMessage) ||
    asString(data.error) ||
    asString(data.message) ||
    fallback;
  if (code && code !== "0") return `${message} (код ${code})`;
  return message || fallback;
};

/**
 * One-stage register → payer is redirected to formUrl (card / SberPay).
 * amountRub is whole rubles; gateway expects kopecks.
 */
export const sberRegisterOrder = async (input: {
  orderNumber: string;
  amountRub: number;
  description?: string;
  customerEmail?: string;
  customerPhone?: string;
  config?: SberConfig;
}): Promise<SberRegisterResult> => {
  const config = input.config ?? getSberConfig();
  if (!isSberConfigured(config)) {
    return { ok: false, error: "Sber эквайринг не настроен (.env)" };
  }

  const amountKopeks = Math.round(input.amountRub * 100);
  if (!Number.isFinite(amountKopeks) || amountKopeks <= 0) {
    return { ok: false, error: "Некорректная сумма оплаты" };
  }

  const urls = sberReturnUrls(config);
  const body: Record<string, unknown> = {
    userName: config.userName,
    password: config.password,
    orderNumber: input.orderNumber.slice(0, 36),
    amount: amountKopeks,
    currency: "643",
    returnUrl: urls.returnUrl,
    failUrl: urls.failUrl,
    dynamicCallbackUrl: urls.dynamicCallbackUrl,
    description: (input.description || `Заказ ${input.orderNumber}`).slice(
      0,
      512,
    ),
  };
  if (input.customerEmail?.trim()) {
    body.email = input.customerEmail.trim().slice(0, 255);
  }
  if (input.customerPhone?.trim()) {
    body.phone = input.customerPhone.replace(/\D/g, "").slice(0, 20);
  }
  if (config.merchantLogin) {
    body.merchantLogin = config.merchantLogin;
  }

  try {
    const { data, status } = await postJson(
      `${config.apiBaseUrl}/register.do`,
      body,
    );
    const errorCode = asString(data.errorCode);
    const orderId = asString(data.orderId);
    const formUrl = asString(data.formUrl);
    if (errorCode && errorCode !== "0") {
      return { ok: false, error: errorFromPayload(data, "Ошибка регистрации оплаты") };
    }
    if (!orderId || !formUrl) {
      return {
        ok: false,
        error: errorFromPayload(
          data,
          status >= 400
            ? `Шлюз Sber недоступен (HTTP ${status})`
            : "Шлюз не вернул ссылку на оплату",
        ),
      };
    }
    return { ok: true, orderId, formUrl };
  } catch (error) {
    return { ok: false, error: networkErrorMessage(error) };
  }
};

/** orderStatus: 0 registered, 1 held, 2 deposited, 3 reversed, 4 refunded, 6 declined */
export const sberGetOrderStatus = async (input: {
  sberOrderId: string;
  config?: SberConfig;
}): Promise<SberOrderStatusResult> => {
  const config = input.config ?? getSberConfig();
  if (!isSberConfigured(config)) {
    return { ok: false, error: "Sber эквайринг не настроен (.env)" };
  }

  try {
    const { data } = await postJson(
      `${config.apiBaseUrl}/getOrderStatusExtended.do`,
      {
        userName: config.userName,
        password: config.password,
        orderId: input.sberOrderId,
      },
    );
    const errorCode = asString(data.errorCode);
    if (errorCode && errorCode !== "0") {
      return { ok: false, error: errorFromPayload(data, "Ошибка статуса оплаты") };
    }

    const orderStatus = asNumber(data.orderStatus) ?? -1;
    const paymentAmountInfo = asRecord(data.paymentAmountInfo);
    const paymentState = asString(paymentAmountInfo.paymentState) || null;
    const actionCode = asNumber(data.actionCode);
    const deposited =
      orderStatus === 2 ||
      paymentState === "DEPOSITED" ||
      paymentState === "Approved";
    const declined =
      orderStatus === 6 ||
      orderStatus === 3 ||
      orderStatus === 4 ||
      paymentState === "DECLINED" ||
      paymentState === "REVERSED" ||
      paymentState === "REFUNDED";

    return {
      ok: true,
      orderStatus,
      paymentState,
      actionCode,
      orderNumber: asString(data.orderNumber) || null,
      deposited,
      declined,
    };
  } catch (error) {
    return { ok: false, error: networkErrorMessage(error) };
  }
};

/** One-time: replace temporary gateway password with a permanent one. */
export const sberSetPermanentPassword = async (input: {
  login: string;
  tmpPassword: string;
  password: string;
  accountsBaseUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const config = getSberConfig();
  const base = (input.accountsBaseUrl || config.accountsBaseUrl).replace(
    /\/$/,
    "",
  );
  try {
    const { data, status } = await postJson(`${base}/set-permanent-password`, {
      login: input.login,
      tmpPassword: input.tmpPassword,
      password: input.password,
    });
    const errorCode = asString(data.errorCode);
    if ((errorCode && errorCode !== "0") || status >= 400) {
      return {
        ok: false,
        error: errorFromPayload(data, `Не удалось сменить пароль (HTTP ${status})`),
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: networkErrorMessage(error) };
  }
};
