/**
 * Comment Moderation — server-side content filtering.
 *
 * Three-layer approach:
 * 1. Profanity / banned-word filter (Russian + transliterated)
 * 2. Spam pattern detection (URLs, repeated chars, ALL-CAPS)
 * 3. Length / rate-limit sanity checks
 *
 * Returns { approved, reason? } so the caller can decide
 * whether to publish immediately or hold for admin review.
 */

// ── Layer 1: Banned words ──────────────────────────────────────────
// Common Russian profanity roots (obfuscation-resistant via regex).
// We match word-boundary-ish patterns using Cyrillic-aware regexes.
const BANNED_PATTERNS: RegExp[] = [
  // Core Russian mat (root forms, covers conjugations)
  /х[уyу][йиеёяю]/i,
  /п[иi]зд/i,
  /бл[яa][дт]/i,
  /е[бb][аaлтиу]/i,
  /сук[аи]/i,
  /муд[аоиы]/i,
  /г[оа]вн/i,
  /дерьм/i,
  /шлюх/i,
  /п[еe]д[еиоа]р/i,
  /твар[ьи]/i,
  // Transliterated / Latin-mixed attempts
  /\bf+u+c+k/i,
  /\bs+h+i+t/i,
  /\ba+s+s+h+o+l+e/i,
  /\bb+i+t+c+h/i,
];

function containsBannedWords(text: string): boolean {
  return BANNED_PATTERNS.some((rx) => rx.test(text));
}

// ── Layer 2: Spam patterns ─────────────────────────────────────────
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const REPEATED_CHAR_PATTERN = /(.)\1{5,}/; // same char 6+ times
const EXCESSIVE_CAPS_RATIO = 0.7; // >70 % uppercase in text ≥20 chars

function isSpammy(text: string): { spam: boolean; reason?: string } {
  // URLs in comments
  const urls = text.match(URL_PATTERN);
  if (urls && urls.length >= 2) {
    return { spam: true, reason: "Слишком много ссылок." };
  }

  // Repeated characters
  if (REPEATED_CHAR_PATTERN.test(text)) {
    return { spam: true, reason: "Повторяющиеся символы." };
  }

  // Excessive caps
  if (text.length >= 20) {
    const upperCount = (text.match(/[A-ZА-ЯЁ]/g) || []).length;
    const letterCount = (text.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > EXCESSIVE_CAPS_RATIO) {
      return { spam: true, reason: "Слишком много заглавных букв." };
    }
  }

  return { spam: false };
}

// ── Layer 3: Sanity checks ─────────────────────────────────────────
const MIN_LENGTH = 1;
const MAX_LENGTH = 2000;

function sanitySanity(text: string): { ok: boolean; reason?: string } {
  if (text.trim().length < MIN_LENGTH) {
    return { ok: false, reason: "Комментарий слишком короткий." };
  }
  if (text.length > MAX_LENGTH) {
    return { ok: false, reason: "Комментарий слишком длинный (макс. 2000 символов)." };
  }
  return { ok: true };
}

// ── Public API ─────────────────────────────────────────────────────

export type ModerationResult = {
  approved: boolean;
  reason?: string;
  /** If true, the comment was cleaned (e.g. single URL removed) but still approved */
  cleaned?: boolean;
  cleanedText?: string;
};

/**
 * Moderate a comment text before persisting.
 * Returns { approved: true } if the comment is safe to publish,
 * or { approved: false, reason } if it should be blocked.
 */
export function moderateComment(text: string): ModerationResult {
  // Sanity
  const sanity = sanitySanity(text);
  if (!sanity.ok) {
    return { approved: false, reason: sanity.reason };
  }

  // Profanity
  if (containsBannedWords(text)) {
    return {
      approved: false,
      reason: "Комментарий содержит недопустимые выражения.",
    };
  }

  // Spam
  const spam = isSpammy(text);
  if (spam.spam) {
    return { approved: false, reason: spam.reason };
  }

  // If there's exactly one URL, allow but strip it (cleaned)
  const singleUrl = text.match(URL_PATTERN);
  if (singleUrl && singleUrl.length === 1) {
    const cleanedText = text.replace(URL_PATTERN, "[ссылка удалена]").trim();
    return { approved: true, cleaned: true, cleanedText };
  }

  return { approved: true };
}
