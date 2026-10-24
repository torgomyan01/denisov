import { prisma } from "@/lib/prisma";

const YANDEX_AUTH = "https://oauth.yandex.ru/authorize";
const YANDEX_TOKEN = "https://oauth.yandex.ru/token";
const YANDEX_INFO = "https://login.yandex.ru/info";

export type YandexProfile = {
  id: string;
  displayName: string;
  email: string | null;
  birthday: Date | null;
};

const siteOrigin = (): string => {
  const url = process.env.SITE_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/$/, "");
};

export const getYandexClientId = (): string =>
  process.env.YANDEX_OAUTH_CLIENT_ID?.trim() || "";

export const getYandexClientSecret = (): string =>
  process.env.YANDEX_OAUTH_CLIENT_SECRET?.trim() || "";

export const yandexConfigured = (): boolean =>
  Boolean(getYandexClientId() && getYandexClientSecret());

/** Must match exactly the Redirect URI in Yandex OAuth app settings. */
export const yandexRedirectUri = (): string => {
  const explicit = process.env.YANDEX_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${siteOrigin()}/api/auth/yandex/callback`;
};

export const buildYandexAuthorizeUrl = (state: string): string => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getYandexClientId(),
    redirect_uri: yandexRedirectUri(),
    scope: "login:info login:email login:birthday",
    state,
    force_confirm: "yes",
  });
  return `${YANDEX_AUTH}?${params.toString()}`;
};

export const exchangeYandexCode = async (
  code: string,
): Promise<string> => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: getYandexClientId(),
    client_secret: getYandexClientSecret(),
  });

  const response = await fetch(YANDEX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Не удалось получить токен Яндекс ID");
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Яндекс не вернул access_token");
  }
  return data.access_token;
};

export const fetchYandexProfile = async (
  accessToken: string,
): Promise<YandexProfile> => {
  const response = await fetch(`${YANDEX_INFO}?format=json`, {
    headers: { Authorization: `OAuth ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Не удалось получить профиль Яндекс ID");
  }

  const data = (await response.json()) as {
    id?: string;
    login?: string;
    display_name?: string;
    real_name?: string;
    first_name?: string;
    default_email?: string;
    emails?: string[];
    birthday?: string | null;
  };

  if (!data.id) {
    throw new Error("В профиле Яндекс нет id");
  }

  const displayName =
    data.real_name?.trim() ||
    data.display_name?.trim() ||
    data.first_name?.trim() ||
    data.login?.trim() ||
    "Гость";

  const email =
    data.default_email?.trim() ||
    data.emails?.[0]?.trim() ||
    null;

  let birthday: Date | null = null;
  if (data.birthday && /^\d{4}-\d{2}-\d{2}$/.test(data.birthday)) {
    birthday = new Date(`${data.birthday}T00:00:00.000Z`);
  }

  return {
    id: String(data.id),
    displayName,
    email,
    birthday,
  };
};

/** Create or update customer from Yandex profile and return customer id. */
export const upsertCustomerFromYandex = async (
  profile: YandexProfile,
): Promise<string> => {
  const byYandex = await prisma.customer.findUnique({
    where: { yandexId: profile.id },
  });

  if (byYandex) {
    const updated = await prisma.customer.update({
      where: { id: byYandex.id },
      data: {
        name: byYandex.name.trim() ? byYandex.name : profile.displayName,
        email: profile.email ?? byYandex.email,
        birthday: profile.birthday ?? byYandex.birthday,
      },
    });
    return updated.id;
  }

  if (profile.email) {
    const byEmail = await prisma.customer.findUnique({
      where: { email: profile.email },
    });
    if (byEmail) {
      const linked = await prisma.customer.update({
        where: { id: byEmail.id },
        data: {
          yandexId: profile.id,
          name: byEmail.name.trim() ? byEmail.name : profile.displayName,
          birthday: profile.birthday ?? byEmail.birthday,
        },
      });
      return linked.id;
    }
  }

  const created = await prisma.customer.create({
    data: {
      yandexId: profile.id,
      name: profile.displayName,
      email: profile.email,
      birthday: profile.birthday,
    },
  });
  return created.id;
};
