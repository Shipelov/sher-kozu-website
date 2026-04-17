/**
 * Telegram API base URL helper.
 *
 * When TELEGRAM_API_PROXY_URL is set (e.g. a Cloudflare Worker URL),
 * all Telegram API calls go through the proxy to bypass ISP blocks.
 * Otherwise, falls back to the default https://api.telegram.org.
 */
import { ENV } from "./env";

const DEFAULT_TELEGRAM_API = "https://api.telegram.org";

/**
 * Returns the base URL for Telegram Bot API calls.
 * Used by grammY (apiRoot) and direct fetch calls.
 *
 * Examples:
 *   - Default: "https://api.telegram.org"
 *   - Proxy:   "https://tg-proxy.example.workers.dev"
 */
export function getTelegramApiRoot(): string {
  const proxy = ENV.telegramApiProxyUrl;
  if (proxy) {
    // Remove trailing slash for consistency
    return proxy.replace(/\/+$/, "");
  }
  return DEFAULT_TELEGRAM_API;
}

/**
 * Builds a full Telegram Bot API URL for a given method.
 * e.g. getTelegramApiUrl("sendMessage") → "https://api.telegram.org/bot<TOKEN>/sendMessage"
 */
export function getTelegramApiUrl(method: string): string {
  return `${getTelegramApiRoot()}/bot${ENV.telegramBotToken}/${method}`;
}

/**
 * Builds a Telegram file download URL.
 * e.g. getTelegramFileUrl("photos/file_123.jpg") → "https://api.telegram.org/file/bot<TOKEN>/photos/file_123.jpg"
 */
export function getTelegramFileUrl(filePath: string): string {
  return `${getTelegramApiRoot()}/file/bot${ENV.telegramBotToken}/${filePath}`;
}
