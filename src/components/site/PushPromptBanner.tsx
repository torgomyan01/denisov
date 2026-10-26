"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getPushSubscriptionStatusAction } from "@/actions/push";
import {
  dismissPushPrompt,
  enableWebPush,
  hasLocalPushSubscription,
  isPushPromptDismissed,
  supportsWebPush,
} from "@/lib/web-push-client";

type PushPromptBannerProps = {
  /** Only logged-in customers should see the prompt. */
  enabled: boolean;
};

/**
 * One-time sticky prompt under the header: enable order push or dismiss.
 * Hidden after enable, dismiss, unsupported browser, or existing subscription.
 */
export const PushPromptBanner = ({ enabled }: PushPromptBannerProps) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      if (!supportsWebPush()) return;
      if (isPushPromptDismissed()) return;
      if (Notification.permission === "denied") {
        dismissPushPrompt();
        return;
      }
      if (await hasLocalPushSubscription()) return;

      const status = await getPushSubscriptionStatusAction();
      if (cancelled) return;
      if (status.success && status.data?.subscribed) return;

      setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  const onEnable = async () => {
    setBusy(true);
    setError("");
    const result = await enableWebPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (Notification.permission === "denied") {
        dismissPushPrompt();
        setVisible(false);
      }
      return;
    }
    setVisible(false);
  };

  const onDismiss = () => {
    dismissPushPrompt();
    setVisible(false);
  };

  return (
    <div
      className="border-t border-clay/18 bg-[linear-gradient(180deg,rgba(239,231,216,0.55)_0%,rgba(251,248,241,0.35)_100%)] px-4 py-3 md:px-10"
      role="region"
      aria-label="Уведомления о заказе"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 sm:flex-nowrap">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-clay/12 text-clay">
          <Bell size={16} strokeWidth={2} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-[0.92rem] leading-[1.35] text-ink/78">
          Включите уведомления, чтобы знать, когда заказ{" "}
          <span className="font-[650] text-ink">готов</span>,{" "}
          <span className="font-[650] text-ink">в пути</span> или{" "}
          <span className="font-[650] text-ink">выдан</span> — даже если сайт
          закрыт.
        </p>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            type="button"
            className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-[0.35rem] rounded-full border-0 bg-clay px-[1rem] font-sans text-[11px] font-[650] tracking-[0.1em] text-paper uppercase transition-colors duration-180 hover:bg-ink disabled:cursor-wait disabled:opacity-55 sm:flex-none"
            disabled={busy}
            onClick={() => void onEnable()}
          >
            {busy ? "Подключаем…" : "Включить"}
          </button>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/12 bg-white/70 text-ink/55 transition-colors duration-180 hover:border-ink/25 hover:text-ink"
            aria-label="Закрыть"
            disabled={busy}
            onClick={onDismiss}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      {error ? (
        <p className="mx-auto mt-2 max-w-[1200px] text-[0.85rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
