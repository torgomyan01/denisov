import { readFileSync } from "fs";
import { resolve } from "path";

const loadEnv = () => {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
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

const gatewayUrl = (process.env.TELEGRAM_GATEWAY_URL || "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_GATEWAY_SECRET || "";
const ids = process.argv
  .slice(2)
  .flatMap((part) => part.split(/[,;\s]+/))
  .map((s) => s.trim())
  .filter(Boolean);

console.log("gateway:", gatewayUrl || "(missing)");
console.log("secret set:", Boolean(secret));
console.log("chat ids (CLI):", ids);

if (!gatewayUrl || !secret || !ids.length) {
  console.error(
    "Usage: node scripts/test-admin-telegram.mjs <chatId> [chatId...]",
  );
  console.error("Needs TELEGRAM_GATEWAY_URL / TELEGRAM_GATEWAY_SECRET in .env");
  process.exit(1);
}

const text = [
  "🧪 Локальный тест Denisov",
  "Если вы видите это — gateway + chat id работают.",
  `Время: ${new Date().toLocaleString("ru-RU")}`,
  "Открыть админку: https://cafedenisov.ru/admin",
].join("\n");

for (const chatId of ids) {
  const res = await fetch(`${gatewayUrl}/api/telegram/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ chatId, text }),
  });
  const body = await res.text();
  console.log(`chat ${chatId}: HTTP ${res.status} ${body}`);
}
