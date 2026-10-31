"use client";

import { Bell, BellOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getPushSubscriptionStatusAction } from "@/actions/push";
import {
  profileBadge,
  profileBlockTitle,
  profileLead,
} from "@/components/profile/profile-styles";
import {
  disableWebPush,
  enableWebPush,
  hasLocalPushSubscription,
  supportsWebPush,
} from "@/lib/web-push-client";

export const PushOptIn = () => {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const refresh = useCallback(async () => {
    if (!supportsWebPush()) {
      setSupported(false);
      setReady(true);
      return;
    }
    setSupported(true);
    const status = await getPushSubscriptionStatusAction();
    if (status.success && status.data) {
      setSubscribed(status.data.subscribed);
    }
    if (await hasLocalPushSubscription()) {
      setSubscribed(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setError("");
    setHint("");
    const result = await enableWebPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubscribed(true);
    setHint("Готово. При каждом статусе заказа придёт push-уведомление.");
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    setHint("");
    const result = await disableWebPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubscribed(false);
    setHint("Уведомления о заказах отключены на этом устройстве.");
  };

  if (!ready) return null;

  return (
    <section className="rounded-2xl border border-ink/8 bg-white/70 px-[1.05rem] pt-4 pb-[1.1rem]">
      <p className={profileBadge}>Уведомления</p>
      <h3 className={`${profileBlockTitle} mt-2`}>Статус заказа</h3>
      <p className={`${profileLead} mt-2`}>
        Push на телефон или компьютер при каждом изменении статуса заказа —
        даже если сайт закрыт. На iPhone нужен Safari и «На экран Домой».
      </p>

      {!supported ? (
        <p className="mt-3 text-[0.9rem] text-ink/55">
          Этот браузер не поддерживает Web Push.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {subscribed ? (
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border border-ink/14 bg-transparent px-[1.1rem] font-sans text-[12px] font-[650] tracking-[0.08em] text-ink/80 uppercase transition-colors duration-180 hover:border-danger/35 hover:bg-danger/8 hover:text-danger disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
              onClick={() => void disable()}
            >
              <BellOff size={15} strokeWidth={2} aria-hidden="true" />
              {busy ? "Отключаем…" : "Выключить"}
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border-0 bg-clay px-[1.1rem] font-sans text-[12px] font-[650] tracking-[0.08em] text-paper uppercase transition-colors duration-180 hover:bg-ink disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
              onClick={() => void enable()}
            >
              <Bell size={15} strokeWidth={2} aria-hidden="true" />
              {busy ? "Подключаем…" : "Включить уведомления"}
            </button>
          )}
          {subscribed ? (
            <span className="text-[0.88rem] text-olive">Включены</span>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="mt-3 text-[0.88rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p className="mt-3 text-[0.88rem] text-ink/55">{hint}</p>
      ) : null}
    </section>
  );
};
