const botToken = (): string => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
};

export const telegramApi = async (
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string }> => {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    description?: string;
  };
  return {
    ok: Boolean(data.ok),
    description: data.description,
  };
};

export const sendTelegramMessage = async (
  chatId: string | number,
  text: string,
): Promise<{ ok: boolean; blocked?: boolean; description?: string }> => {
  const result = await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  const blocked =
    !result.ok &&
    typeof result.description === "string" &&
    /blocked|deactivated|chat not found|forbidden/i.test(result.description);
  return { ...result, blocked };
};
