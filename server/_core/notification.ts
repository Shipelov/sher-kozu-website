/**
 * Owner notification helper — sends alerts via Telegram Bot.
 *
 * Falls back to the Manus Forge notification service if TELEGRAM_ADMIN_CHAT_ID
 * is not configured (backward compatibility during migration).
 */
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Send notification via Telegram Bot API.
 */
async function sendTelegramNotification(
  title: string,
  content: string
): Promise<boolean> {
  const botToken = ENV.telegramBotToken;
  const chatId = ENV.telegramAdminChatId;

  if (!botToken || !chatId) {
    console.warn("[Notification] Telegram bot token or admin chat ID not configured");
    return false;
  }

  // Truncate for Telegram's 4096 char limit
  const maxLen = 4000;
  let text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(content)}`;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen) + "\n\n<i>…(сообщение обрезано)</i>";
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Telegram send failed (${response.status}): ${detail}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Telegram send error:", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send notification via legacy Manus Forge service.
 */
async function sendForgeNotification(
  title: string,
  content: string
): Promise<boolean> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    return false;
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const endpoint = new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    baseUrl
  ).toString();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Forge send failed (${response.status}): ${detail}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Forge send error:", error);
    return false;
  }
}

/**
 * Dispatches a project-owner notification.
 * Priority: Telegram Bot > Manus Forge service.
 * Returns `true` if the message was delivered, `false` otherwise.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  // Try Telegram first
  if (ENV.telegramBotToken && ENV.telegramAdminChatId) {
    return sendTelegramNotification(title, content);
  }

  // Fallback to Manus Forge
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return sendForgeNotification(title, content);
  }

  console.warn(
    "[Notification] No notification channel configured. Set TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID, or BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY."
  );
  return false;
}
