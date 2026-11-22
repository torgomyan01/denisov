# Кафе ДЕНИСОВ (Next.js)

Сайт кафе + админ-панель на Next.js App Router, Prisma и MySQL.

**Для клиента (как пользоваться админкой):** [docs/rukovodstvo-admina.md](docs/rukovodstvo-admina.md)

## Требования

- Node.js 20+
- MySQL/MariaDB с базой `denisov_db`

## SSH-туннель к БД на сервере

Локальный Next.js ходит в MySQL через туннель:

```bash
ssh -L 3306:127.0.0.1:3306 root@81.177.136.171
```

В `.env`:

```env
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/denisov_db"
```

Важно: `root` без пароля часто даёт `ERROR 1698 Access denied` — на сервере у `root@localhost` обычно `unix_socket`, а туннель идёт по TCP. Нужен пользователь с паролем, например на сервере:

```sql
CREATE USER IF NOT EXISTS 'denisov'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON denisov_db.* TO 'denisov'@'localhost';
FLUSH PRIVILEGES;
```

Проверка с локальной машины (туннель должен быть открыт):

```bash
node scripts/check-db.mjs
```

Деплой-лог на сервере: `tail -f /var/log/denisov-deploy-status.log`

## Запуск

```bash
copy .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- Сайт: http://localhost:3000
- Меню: http://localhost:3000/menu
- Вход / регистрация: http://localhost:3000/auth
- Админ: http://localhost:3000/admin
- Пароль по умолчанию: `denisov2026` (`.env` → `ADMIN_PASSWORD`)

## Яндекс ID (ключ для входа)

1. Открой [oauth.yandex.ru](https://oauth.yandex.ru/) и войди в Яндекс.
2. **Создать приложение** → название, например `Denisov`.
3. Платформы: отметь **Веб-сервисы**.
4. **Redirect URI** (точно так):
   - локально: `http://localhost:3000/api/auth/yandex/callback`
   - прод: `https://cafedenisov.ru/api/auth/yandex/callback`
5. Доступы (права):
   - Доступ к адресу электронной почты
   - Доступ к дате рождения
   - Доступ к логину, имени и фамилии, полу
6. Сохрани приложение → скопируй **ClientID** и **Client secret**.
7. Впиши в `.env`:

```env
YANDEX_OAUTH_CLIENT_ID="..."
YANDEX_OAUTH_CLIENT_SECRET="..."
YANDEX_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/yandex/callback"
SITE_URL="http://localhost:3000"
```

8. Перезапусти `npm run dev`. Кнопка «Войти с Яндекс ID» на `/auth` заработает.

### Яндекс.Метрика

Счётчик в `YandexMetrika` (id `114148645`). Для SPA: `defer` + `hit` при смене маршрута; `/admin` не учитывается.

Цели (JavaScript-событие):
- `add_to_cart` — любое добавление в корзину
- `order_success` — успешное оформление заказа

### Яндекс.Карты (точки самовывоза в админке)

1. [developer.tech.yandex.ru](https://developer.tech.yandex.ru/services/) → создай ключ **JavaScript API и HTTP Геокодер**.
2. Ограничь по HTTP Referrer: `http://localhost:3000/*` и прод-домен.
3. В `.env`:

```env
NEXT_PUBLIC_YANDEX_MAPS_API_KEY="ваш_ключ"
```

4. Перезапусти `npm run dev`. В админке «Самовывоз» карта станет кликабельной.

### DaData (подсказки адреса доставки)

1. [dadata.ru](https://dadata.ru/) → API → токен для Suggestions.
2. В `.env` (только сервер, без `NEXT_PUBLIC_`):

```env
DADATA_API_KEY="ваш_токен"
```

3. Перезапусти `npm run dev`. В корзине и профиле при доставке появится ввод улицы/дома с подсказками (СПб и ЛО).

### Web Push (уведомления о статусе заказа)

Клиент в профиле включает уведомления. При статусах **готов / в пути / выдан** браузер получает push (сайт может быть закрыт). Нужен HTTPS.

1. Сгенерируй VAPID-ключи:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

2. В `.env`:

```env
VAPID_PUBLIC_KEY="…"
VAPID_PRIVATE_KEY="…"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="…"   # тот же public key
VAPID_SUBJECT="mailto:hello@cafedenisov.ru"
```

3. `npx prisma db push` (таблица `PushSubscription`) и перезапуск `npm run dev`.

4. Гость: `/profile` → «Включить уведомления». На iPhone — Safari + «На экран Домой».

При входе через Яндекс сохраняем: имя, email, дату рождения (если пользователь разрешил).

### iiko Cloud (создание заказа)

При оформлении заказа на сайте заказ пишется в нашу БД и сразу уходит в iiko (`/api/1/deliveries/create`). Каталог меню кэшируется в БД (`IikoMenuCache`) и обновляется из iiko не чаще **раза в сутки** (МСК); сайт и админка читают кэш. Ручное обновление: админка → Меню → «Обновить из iiko».

1. [Developer Portal](https://public-api.iikoweb.ru/portal) → приложение → `appId` + `clientSecret` (секрет показывается один раз).
2. iikoWeb → Integrations → API Keys → `apiKey`.
3. Через API (после токена) возьми `organizationId`, `terminalGroupId`, `paymentTypeId`.
4. В `.env`:

```env
IIKO_API_KEY="…"
IIKO_APP_ID="…"
IIKO_CLIENT_SECRET="…"
IIKO_ORGANIZATION_ID="…"
IIKO_TERMINAL_GROUP_ID="…"
IIKO_PAYMENT_TYPE_ID="…"   # чтобы в iiko заказ был «оплачен»
IIKO_CITY="Санкт-Петербург"
```

`apiKey` одного недостаточно для актуального `/api/v2/access_token` — нужны ещё `appId` и `clientSecret`. Без полного набора синк в iiko не включается.

### Sber эквайринг (онлайн-оплата)

Оплата картой / SberPay идёт через платёжный шлюз Сбера (`register.do`). Заказ сначала создаётся у нас со статусом «ожидает оплаты»; в iiko уходит **только после** подтверждённой оплаты (callback или return URL). Оплата при получении работает как раньше.

1. В личном кабинете Sber ecom возьми **userName** (логин API) и временный пароль. При необходимости укажи **merchantLogin** (дочерний мерчант).
2. Смени временный пароль на постоянный (один раз):

```bash
node scripts/sber-set-permanent-password.mjs "<userName>" "<tmpPassword>" "<newPermanentPassword>"
```

3. В `.env` на проде (и локально для теста):

```env
SITE_URL="https://cafedenisov.ru"
SBER_USER_NAME="…"
SBER_PASSWORD="…"                 # постоянный пароль после шага 2
SBER_MERCHANT_LOGIN="…"           # если банк выдал отдельно; иначе можно пусто
# Локально, если антивирус ломает TLS к Sber (fetch failed / self-signed):
# SBER_TLS_INSECURE=1
# Обычно не нужны — дефолты production API:
# SBER_API_BASE_URL="https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1"
# SBER_ACCOUNTS_BASE_URL="https://ecommerce.sberbank.ru/ecomm/gw/partner/api/accounts/v1"
```

4. В ЛК Sber включи **динамические callback** и пермиссию callback. URL, который уходит в `register.do`:
   `https://cafedenisov.ru/api/payments/sber/callback`
5. На сервере после деплоя:

```bash
npx prisma db push
# перезапуск next (pm2/systemd)
```

6. Проверь тестовым заказом: «Онлайн · карта / SberPay» → страница Сбера → возврат на `/order/pay/result`. В админке заказ должен стать «Оплачен», затем появится запись в iiko.

`SITE_URL` обязан совпадать с публичным HTTPS-доменом (без слэша в конце) — иначе return/callback уйдут не туда.

## База данных (реляционная CMS)

Контент больше не хранится в одном JSON. Таблицы:

| Таблица | Назначение |
|--------|------------|
| `SiteMeta` | SEO |
| `SiteHero` | Главный экран |
| `SiteAbout` | О кафе + 3 цифры |
| `SiteContacts` | Контакты |
| `SiteFooter` / `SiteBrand` | Футер и логотип |
| `SiteSettings` | Заголовок/примечание меню, PDF |
| `Dish` | Галерея блюд (сортировка) |
| `MenuCategory` / `MenuItem` | Меню |
| `PickupPoint` | Точки самовывоза (кафе) |
| `PushSubscription` | Web Push подписки клиентов |
| `AdminSession` | Сессии админа |

`prisma/seed-data/site.json` используется **только** для первичного seed (`npm run db:seed`).

## Скрипты

```bash
npm run db:push          # применить схему
npm run db:seed          # залить контент из site.json
npm run images:compress  # сжать uploads
node scripts/sber-set-permanent-password.mjs   # разово сменить пароль Sber
```
