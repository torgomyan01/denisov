import {
  getVapidPublicKeyAction,
  subscribePushAction,
  unsubscribePushAction,
} from "@/actions/push";

const SW_PATH = "/sw.js";

export const PUSH_PROMPT_DISMISS_KEY = "denisov_push_prompt_dismissed";

export const supportsWebPush = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

export const isPushPromptDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

export const dismissPushPrompt = (): void => {
  try {
    window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
};

export const hasLocalPushSubscription = async (): Promise<boolean> => {
  if (!supportsWebPush()) return false;
  try {
    if (Notification.permission === "granted") {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
};

export const enableWebPush = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!supportsWebPush()) {
    return { ok: false, error: "Браузер не поддерживает push-уведомления" };
  }

  const keyResult = await getVapidPublicKeyAction();
  if (!keyResult.success || !keyResult.data?.publicKey) {
    return {
      ok: false,
      error: keyResult.success
        ? "Push не настроен на сервере"
        : keyResult.error,
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Разрешите уведомления в настройках браузера" };
  }

  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: "/",
  });
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        keyResult.data.publicKey,
      ) as BufferSource,
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Не удалось получить данные подписки" };
  }

  const result = await subscribePushAction({
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    userAgent: navigator.userAgent.slice(0, 500),
  });

  if (!result.success) {
    return { ok: false, error: result.error };
  }

  dismissPushPrompt();
  return { ok: true };
};

export const disableWebPush = async (): Promise<
  { ok: true } | { ok: false; error: string }
> => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    const result = await unsubscribePushAction(
      endpoint ? { endpoint } : {},
    );
    if (!result.success) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Не удалось отключить уведомления",
    };
  }
};
