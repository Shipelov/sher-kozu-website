/**
 * Ссылки в ответах ассистентов: свой домен — ссылка, внешние — текст с URL.
 * Чистая функция, тестируется на сервере (server/assistantMarkdown.test.ts).
 */

const MARKDOWN_LINK = /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function isOwnLink(url: string, origin: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (url.startsWith("#")) return true;
  if (/^(mailto|tel):/i.test(url)) return true;
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/** Внешние markdown-ссылки превращает в «текст (url)», свои оставляет ссылками. */
export function renderAssistantLinks(markdown: string, origin: string): string {
  return markdown.replace(MARKDOWN_LINK, (full, text: string, url: string) => {
    if (isOwnLink(url, origin)) {
      // Абсолютный URL своего домена → относительный, чтобы SPA открывала без перезагрузки
      if (/^https?:/i.test(url)) {
        try {
          const parsed = new URL(url);
          return `[${text}](${parsed.pathname}${parsed.search}${parsed.hash})`;
        } catch {
          return full;
        }
      }
      return full;
    }
    if (!/^https?:/i.test(url)) return text;
    return text.trim() === url ? url : `${text} (${url})`;
  });
}

export function currentOrigin(): string {
  return typeof window !== "undefined" && window.location ? window.location.origin : "https://koza.vip";
}
