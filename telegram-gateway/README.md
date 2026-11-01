# Denisov Telegram Gateway

Small Next.js app for Vercel: receives Telegram webhooks and relays `sendMessage` so the RU-hosted Denisov site does not call `api.telegram.org` directly.

## Endpoints

- `POST /api/telegram/webhook` — BotFather webhook (`/start <token>`)
- `POST /api/telegram/send` — `{ chatId, text }` + `Authorization: Bearer GATEWAY_SECRET`
- `GET|POST /api/telegram/drain` — pull Denisov outbox → Telegram → ack (cron + manual)

Denisov (Jino) cannot reach Telegram/Vercel TLS, so it only writes `TelegramOutbox`.
This gateway drains every minute (`vercel.json` cron) and also on webhook traffic.

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
