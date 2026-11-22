/**
 * One-time: replace Sber temporary gateway password with a permanent one.
 *
 * Usage:
 *   node scripts/sber-set-permanent-password.mjs <login> <tmpPassword> <newPassword>
 *
 * Then put the new password into .env as SBER_PASSWORD and restart the app.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const loadDotEnv = () => {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

loadDotEnv();

const [loginArg, tmpArg, newArg] = process.argv.slice(2);
const login = (loginArg || process.env.SBER_USER_NAME || "").trim();
const tmpPassword = (tmpArg || "").trim();
const password = (newArg || "").trim();
const accountsBase = (
  process.env.SBER_ACCOUNTS_BASE_URL ||
  "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/accounts/v1"
).replace(/\/$/, "");

if (!login || !tmpPassword || !password) {
  console.error(
    "Usage: node scripts/sber-set-permanent-password.mjs <login> <tmpPassword> <newPassword>",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("New password must be at least 8 characters.");
  process.exit(1);
}

const response = await fetch(`${accountsBase}/set-permanent-password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "application/json",
  },
  body: JSON.stringify({ login, tmpPassword, password }),
});

const text = await response.text();
let data = {};
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text.slice(0, 500) };
}

const errorCode = data.errorCode != null ? String(data.errorCode) : "";
if (!response.ok || (errorCode && errorCode !== "0")) {
  console.error("FAILED", {
    http: response.status,
    errorCode: errorCode || null,
    errorMessage: data.errorMessage || data.message || data.raw || data,
  });
  process.exit(1);
}

console.log("OK — permanent password set.");
console.log('Put it in .env: SBER_PASSWORD="…" and restart the server.');
