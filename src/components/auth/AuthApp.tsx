"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  getCustomerAction,
  loginCustomerAction,
  registerCustomerAction,
} from "@/actions/customer-auth";
import {
  authInputBaseClass,
  authInputClass,
  authLoadingClass,
  authPageClass,
  authSpinnerClass,
} from "@/components/auth/auth-styles";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { applyCartAfterAuth } from "@/lib/cart-auth-sync";
import { useAppDispatch, useAppStore } from "@/store/hooks";

type Mode = "login" | "register";

const ERROR_MAP: Record<string, string> = {
  yandex_not_configured: "Яндекс ID ещё не настроен (нет ключей в .env).",
  yandex_denied: "Вход через Яндекс отменён.",
  yandex_state: "Сессия входа устарела. Попробуйте ещё раз.",
  yandex_failed: "Не удалось войти через Яндекс. Попробуйте позже.",
};

interface AuthAppProps {
  yandexEnabled: boolean;
}

const BRAND_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

const brandStyle: CSSProperties = {
  backgroundImage: `linear-gradient(160deg, rgba(33, 30, 25, 0.92), rgba(44, 58, 46, 0.88)), ${BRAND_PATTERN}`,
};

const fieldClass = "flex animate-auth-field flex-col gap-[0.45rem] motion-reduce:animate-none";
const labelClass =
  "text-[10px] font-semibold tracking-[0.18em] text-ink/45 uppercase";

const YandexIcon = () => (
  <svg className="size-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm1.1 4.5h-1.55c-1.95 0-3.3 1.25-3.3 3.05 0 1.35.65 2.25 1.85 3.05l1.7 1.15V17h1.85V7.05c0-.35-.2-.55-.55-.55zm-1.45 4.85c-.7-.5-1.1-.95-1.1-1.7 0-.85.55-1.4 1.4-1.4h.15v3.1z"
    />
  </svg>
);

const safeNextPath = (raw: string | null): string => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/profile";
  if (raw.startsWith("/auth")) return "/profile";
  return raw;
};

export const AuthApp = ({ yandexEnabled }: AuthAppProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err && ERROR_MAP[err]) setError(ERROR_MAP[err]);
    if (searchParams.get("ok") === "yandex") setError("");

    void (async () => {
      const result = await getCustomerAction();
      if (result.success && result.data) {
        await applyCartAfterAuth(dispatch, store);
        router.replace(safeNextPath(searchParams.get("next")));
        return;
      }
      setBooting(false);
    })();
  }, [searchParams, router, dispatch, store]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register" && !acceptTerms) {
        setError(
          "Отметьте согласие с пользовательским соглашением и политикой конфиденциальности",
        );
        return;
      }

      const result =
        mode === "register"
          ? await registerCustomerAction({
              name,
              phone,
              password,
              passwordConfirm,
              acceptTerms: true as const,
            })
          : await loginCustomerAction({ phone, password });

      if (!result.success || !result.data) {
        setError(result.success ? "Ошибка" : result.error);
        return;
      }
      await applyCartAfterAuth(dispatch, store);
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setAcceptTerms(false);
  };

  const tabClass = (active: boolean): string =>
    `relative z-[1] cursor-pointer border-0 bg-transparent px-2 py-3 text-[11px] tracking-[0.2em] uppercase transition-colors duration-300 motion-reduce:transition-none ${
      active ? "text-paper" : "text-ink/50"
    }`;

  return (
    <div className={authPageClass}>
      <div className="relative z-[1] mx-auto grid min-h-screen max-w-[1120px] p-5 min-[960px]:grid-cols-[1.05fr_0.95fr] min-[960px]:items-stretch min-[960px]:gap-6 min-[960px]:p-8">
        <aside
          className="relative hidden flex-col justify-between overflow-hidden rounded-[28px] px-11 py-10 text-paper min-[960px]:flex min-[960px]:animate-auth-rise motion-reduce:animate-none"
          style={brandStyle}
          aria-hidden="true"
        >
          <div className="pointer-events-none absolute -right-1/5 -bottom-[10%] h-[55%] w-[70%] bg-[image:radial-gradient(ellipse,rgba(156,107,74,0.35),transparent_65%)]" />
          <div>
            <p className="font-sans text-[11px] tracking-ultra text-paper/55 uppercase">
              Кафе · Санкт-Петербург
            </p>
            <h2 className="mt-5 font-serif text-[length:clamp(3.5rem,6vw,5.5rem)] leading-[0.92] tracking-[0.08em]">
              ДЕНИСОВ
            </h2>
            <div className="mt-6 mb-5 h-px w-[72px] origin-left animate-auth-line bg-clay/85 [animation-delay:350ms] motion-reduce:animate-none" />
            <p className="max-w-[22rem] font-serif text-[1.35rem] leading-[1.45] text-paper/72 italic">
              Локальная кухня и свежая выпечка. Войдите, чтобы быстрее
              оформлять заказы.
            </p>
          </div>
          <p className="font-sans text-[11px] tracking-wide2 text-paper/40 uppercase">
            Московский пр., 71/3
          </p>
        </aside>

        <section className="flex animate-auth-rise flex-col justify-center px-5 pt-6 pb-8 [animation-delay:120ms] motion-reduce:animate-none min-[960px]:px-9 min-[960px]:py-10">
          {booting ? (
            <div className={authLoadingClass}>
              <div className={authSpinnerClass} />
              <p>Загрузка…</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[420px] rounded-[28px] border border-ink/8 bg-paper/78 px-6 pt-7 pb-[1.85rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_24px_60px_rgba(33,30,25,0.08)] backdrop-blur-lg min-[640px]:px-8 min-[640px]:pt-[2.1rem] min-[640px]:pb-[2.2rem]">
              <p className="text-[11px] tracking-ultra text-clay uppercase">
                Быстрый вход
              </p>
              <h1 className="mt-[0.65rem] font-serif text-[length:clamp(2.4rem,5vw,3.1rem)] leading-none tracking-[0.02em]">
                {mode === "login" ? "Войти" : "Регистрация"}
              </h1>
              <p className="mt-3 min-h-[3em] leading-[1.5] text-ink/55 transition-opacity duration-350">
                {mode === "login"
                  ? "Войдите по телефону и паролю или через Яндекс ID."
                  : "Имя, телефон и пароль — этого достаточно для заказа."}
              </p>

              <div
                className="relative mt-7 grid grid-cols-2 gap-1 rounded-full border border-ink/6 bg-sand/75 p-[0.3rem]"
                role="tablist"
              >
                <div
                  className={`pointer-events-none absolute top-[0.3rem] bottom-[0.3rem] left-[0.3rem] w-[calc(50%-0.3rem)] rounded-full bg-ink transition-[translate] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    mode === "register" ? "translate-x-full" : ""
                  }`}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={tabClass(mode === "login")}
                  onClick={() => switchMode("login")}
                >
                  Вход
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  className={tabClass(mode === "register")}
                  onClick={() => switchMode("register")}
                >
                  Регистрация
                </button>
              </div>

              <form
                className="mt-6 flex flex-col gap-4"
                onSubmit={(e) => void onSubmit(e)}
                key={mode}
              >
                {mode === "register" ? (
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="auth-name">
                      Имя
                    </label>
                    <input
                      id="auth-name"
                      className={authInputClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Александр"
                    />
                  </div>
                ) : null}

                <div className={fieldClass}>
                  <label className={labelClass} htmlFor="auth-phone">
                    Телефон
                  </label>
                  <PhoneInput
                    id="auth-phone"
                    className={authInputClass}
                    value={phone}
                    onChange={setPhone}
                    required
                    placeholder="+7 900 000-00-00"
                  />
                </div>

                <div className={fieldClass}>
                  <label className={labelClass} htmlFor="auth-password">
                    Пароль
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      className={`${authInputBaseClass} pr-22`}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={
                        mode === "register" ? "new-password" : "current-password"
                      }
                      placeholder={
                        mode === "register"
                          ? "Не короче 6 символов"
                          : "Ваш пароль"
                      }
                      minLength={mode === "register" ? 6 : 1}
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-[0.55rem] -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent px-[0.55rem] py-[0.4rem] text-[11px] font-semibold tracking-[0.08em] text-ink/45 uppercase hover:bg-clay/8 hover:text-clay"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Скрыть пароль" : "Показать пароль"
                      }
                    >
                      {showPassword ? "Скрыть" : "Показать"}
                    </button>
                  </div>
                </div>

                {mode === "register" ? (
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="auth-password-confirm">
                      Повторите пароль
                    </label>
                    <input
                      id="auth-password-confirm"
                      className={authInputClass}
                      type={showPassword ? "text" : "password"}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Ещё раз"
                      minLength={6}
                    />
                  </div>
                ) : null}

                {mode === "register" ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-ink/8 bg-sand/40 px-3.5 py-3 text-[0.88rem] leading-[1.4] text-ink/72">
                    <input
                      type="checkbox"
                      className="mt-[0.2rem] size-4 shrink-0 cursor-pointer accent-clay"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      required
                    />
                    <span>
                      Я соглашаюсь с{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-[650] text-clay underline-offset-2 hover:underline"
                      >
                        пользовательским соглашением
                      </a>{" "}
                      и{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-[650] text-clay underline-offset-2 hover:underline"
                      >
                        политикой конфиденциальности
                      </a>
                    </span>
                  </label>
                ) : null}

                {error ? (
                  <p className="animate-auth-shake rounded-[14px] border border-[#b42318]/15 bg-[#b42318]/8 px-4 py-[0.85rem] text-[0.9rem] text-[#8f1d16] motion-reduce:animate-none">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="mt-[0.35rem] w-full cursor-pointer rounded-full border-0 bg-ink px-5 py-4 text-[12px] tracking-wide2 text-paper uppercase transition-[background-color,translate,box-shadow] duration-250 hover:enabled:-translate-y-0.5 hover:enabled:bg-clay hover:enabled:shadow-[0_12px_28px_rgba(156,107,74,0.22)] active:enabled:translate-y-0 disabled:cursor-wait disabled:opacity-55 motion-reduce:transition-none"
                  disabled={busy}
                >
                  {busy
                    ? "Подождите…"
                    : mode === "login"
                      ? "Войти"
                      : "Зарегистрироваться"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4 text-[11px] tracking-[0.2em] text-ink/35 uppercase">
                <span className="h-px flex-1 bg-ink/10" />
                или
                <span className="h-px flex-1 bg-ink/10" />
              </div>

              {yandexEnabled ? (
                <>
                  <a
                    href="/api/auth/yandex"
                    className="flex w-full items-center justify-center gap-[0.65rem] rounded-full bg-[#fc3f1d] px-5 py-4 text-[12px] font-semibold tracking-[0.18em] text-white uppercase no-underline transition-[translate,box-shadow,filter] duration-250 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(252,63,29,0.28)] hover:brightness-[1.04] motion-reduce:transition-none"
                    onClick={(e) => {
                      if (mode === "register" && !acceptTerms) {
                        e.preventDefault();
                        setError(
                          "Отметьте согласие с условиями, чтобы войти через Яндекс",
                        );
                      }
                    }}
                  >
                    <YandexIcon />
                    Войти с Яндекс ID
                  </a>
                  <p className="mt-3 text-center text-[0.78rem] leading-[1.4] text-ink/45">
                    Нажимая кнопку Яндекс ID
                    {mode === "register" ? " при регистрации" : ""}, вы
                    принимаете условия сервиса.{" "}
                    <SiteLegalLinks />
                  </p>
                </>
              ) : (
                <p className="rounded-2xl border border-dashed border-ink/14 px-4 py-[0.95rem] text-[0.9rem] leading-[1.45] text-ink/50">
                  Яндекс ID появится после добавления ключей в `.env`
                  (`YANDEX_OAUTH_CLIENT_ID` и `YANDEX_OAUTH_CLIENT_SECRET`).
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
