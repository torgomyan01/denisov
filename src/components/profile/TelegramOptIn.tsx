"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
  getTelegramStatusAction,
} from "@/actions/telegram";
import {
  profileBadge,
  profileBlockTitle,
  profileLead,
} from "@/components/profile/profile-styles";

export const TelegramOptIn = () => {
  const [ready, setReady] = useState(false);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const refresh = useCallback(async () => {
    const status = await getTelegramStatusAction();
    if (status.success && status.data) {
      setLinked(status.data.linked);
      setUsername(status.data.username);
      setConfigured(status.data.configured);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    setError("");
    setHint("");
    const result = await createTelegramLinkAction();
    setBusy(false);
    if (!result.success || !result.data) {
      setError(result.success ? "Ошибка" : result.error);
      return;
    }
    setHint("Откройте бота и нажмите Start — затем вернитесь сюда.");
    window.open(result.data.deepLink, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      void refresh();
    }, 2500);
  };

  const disconnect = async () => {
    setBusy(true);
    setError("");
    setHint("");
    const result = await disconnectTelegramAction();
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setLinked(false);
    setUsername(null);
    setHint("Telegram отключён. Уведомления в бот больше не приходят.");
  };

  if (!ready) return null;

  return (
    <section className="rounded-2xl border border-ink/8 bg-white/70 px-[1.05rem] pt-4 pb-[1.1rem]">
      <p className={profileBadge}>Telegram</p>
      <h3 className={`${profileBlockTitle} mt-2`}>Уведомления в боте</h3>
      <p className={`${profileLead} mt-2`}>
        Подключите бота — при каждом изменении статуса заказа придёт подробное
        сообщение в Telegram.
      </p>

      {!configured ? (
        <p className="mt-3 text-[0.9rem] text-ink/55">
          Telegram-бот пока не настроен на сайте.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {linked ? (
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border border-ink/14 bg-transparent px-[1.1rem] font-sans text-[12px] font-[650] tracking-[0.08em] text-ink/80 uppercase transition-colors duration-180 hover:border-danger/35 hover:bg-danger/8 hover:text-danger disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Отключаем…" : "Отключить Telegram"}
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border-0 bg-clay px-[1.1rem] font-sans text-[12px] font-[650] tracking-[0.08em] text-paper uppercase transition-colors duration-180 hover:bg-ink disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
              onClick={() => void connect()}
            >
              <Send size={15} strokeWidth={2} aria-hidden="true" />
              {busy ? "Открываем…" : "Подключить Telegram"}
            </button>
          )}
          {linked ? (
            <span className="text-[0.88rem] text-olive">
              Подключено{username ? ` · @${username}` : ""}
            </span>
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
