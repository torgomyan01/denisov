/**
 * Drain TelegramOutbox: pull from cafedenisov → send via Vercel gateway → ack.
 * Runs from any host that can reach both (PC / GitHub Actions). VPS cannot.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const loadEnv = () => {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
};

loadEnv();

const rawSite =
  process.env.DENISOV_SITE_URL ||
  process.env.SITE_URL ||
  "https://cafedenisov.ru";
// Local .env often has localhost — drain always targets production site.
const site = (
  /localhost|127\.0\.0\.1/i.test(rawSite) ? "https://cafedenisov.ru" : rawSite
).replace(/\/$/, "");
const gateway = (process.env.TELEGRAM_GATEWAY_URL || "").replace(/\/$/, "");
const secret =
  process.env.TELEGRAM_GATEWAY_SECRET ||
  process.env.TELEGRAM_BIND_SECRET ||
  process.env.GATEWAY_SECRET ||
  "";

if (!gateway || !secret) {
  console.error("Need TELEGRAM_GATEWAY_URL + TELEGRAM_GATEWAY_SECRET");
  process.exit(1);
}

const outboxUrl = `${site}/api/telegram/outbox`;
const auth = { Authorization: `Bearer ${secret}` };

const pullRes = await fetch(`${outboxUrl}?limit=20`, {
  headers: { ...auth, Accept: "application/json" },
  cache: "no-store",
});
const pullBody = await pullRes.text();
if (!pullRes.ok) {
  console.error("pull failed", pullRes.status, pullBody.slice(0, 300));
  process.exit(1);
}
const pull = JSON.parse(pullBody);
const messages = Array.isArray(pull.messages) ? pull.messages : [];
console.log(`pulled ${messages.length}`);

const results = [];
for (const msg of messages) {
  if (!msg?.id || !msg.chatId || !msg.text) {
    results.push({ id: msg?.id || "", ok: false, error: "invalid" });
    continue;
  }
  const sendRes = await fetch(`${gateway}/api/telegram/send`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: msg.chatId, text: msg.text }),
  });
  const sendJson = await sendRes.json().catch(() => ({}));
  if (sendRes.ok && sendJson.ok) {
    results.push({ id: msg.id, ok: true });
    console.log(`sent ${msg.id} → ${msg.chatId}`);
  } else {
    results.push({
      id: msg.id,
      ok: false,
      blocked: Boolean(sendJson.blocked),
      error: sendJson.error || `HTTP ${sendRes.status}`,
    });
    console.log(`fail ${msg.id}:`, sendJson.error || sendRes.status);
  }
}

if (results.length) {
  const ackRes = await fetch(outboxUrl, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
  const ackBody = await ackRes.text();
  console.log("ack", ackRes.status, ackBody);
  if (!ackRes.ok) process.exit(1);
} else {
  console.log("nothing to ack");
}
