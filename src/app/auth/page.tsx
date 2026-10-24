import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthApp } from "@/components/auth/AuthApp";
import {
  authLoadingClass,
  authPageClass,
  authSpinnerClass,
} from "@/components/auth/auth-styles";
import { SiteChrome } from "@/components/site/SiteChrome";
import { yandexConfigured } from "@/lib/yandex-oauth";

export const metadata: Metadata = {
  title: "Вход — ДЕНИСОВ",
  description: "Быстрый вход и регистрация в кафе Денисов",
};

export default function AuthPage() {
  return (
    <SiteChrome>
      <main>
        <Suspense
          fallback={
            <div className={authPageClass}>
              <div className={authLoadingClass}>
                <div className={authSpinnerClass} />
                <p>Загрузка…</p>
              </div>
            </div>
          }
        >
          <AuthApp yandexEnabled={yandexConfigured()} />
        </Suspense>
      </main>
    </SiteChrome>
  );
}
