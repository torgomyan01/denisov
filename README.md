# Кафе ДЕНИСОВ (Next.js)

`ssh -L 3306:127.0.0.1:3306 root@81.177.136.171`

tail -f /var/log/denisov-deploy-status.log


Сайт кафе + админ-панель на Next.js App Router, Prisma и MySQL.

## Требования

- Node.js 20+
- MySQL/MariaDB с базой `denisov_db`

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
- Админ: http://localhost:3000/admin
- Пароль по умолчанию: `denisov2026` (`.env` → `ADMIN_PASSWORD`)

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
| `AdminSession` | Сессии админа |

`prisma/seed-data/site.json` используется **только** для первичного seed (`npm run db:seed`).

## Скрипты

```bash
npm run db:push          # применить схему
npm run db:seed          # залить контент из site.json
npm run images:compress  # сжать uploads
```
