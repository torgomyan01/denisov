# Кафе ДЕНИСОВ (Next.js)

Сайт кафе + админ-панель на Next.js App Router, Prisma и MySQL.

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

При входе через Яндекс сохраняем: имя, email, дату рождения (если пользователь разрешил).

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
| `AdminSession` | Сессии админа |

`prisma/seed-data/site.json` используется **только** для первичного seed (`npm run db:seed`).

## Скрипты

```bash
npm run db:push          # применить схему
npm run db:seed          # залить контент из site.json
npm run images:compress  # сжать uploads
```
