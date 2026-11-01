# Denisov Telegram Gateway

Small Next.js app for Vercel: receives Telegram webhooks and relays `sendMessage` so the RU-hosted Denisov site does not call `api.telegram.org` directly.

## Endpoints

- `POST /api/telegram/webhook` — BotFather webhook (`/start <token>`)
- `POST /api/telegram/send` — `{ chatId, text }` + `Authorization: Bearer GATEWAY_SECRET`

## Deploy

1. Vercel → import repo → **Root Directory**: `telegram-gateway`
2. Set env from `.env.example`
3. Deploy, then:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.vercel.app/api/telegram/webhook"
```

Local:

```bash
cd telegram-gateway
npm install
cp .env.example .env.local
npm run dev
```
