/**
 * Comment Moderation — server-side content filtering.
 *
 * Three-layer approach:
 * 1. Profanity / banned-word filter (Russian + transliterated)
 *    - Hard-banned: always blocked (unambiguous profanity)
 *    - Context-sensitive: words like "сука", "тварь" that can be
 *      legitimate animal terms OR insults — blocked only when
 *      used as directed insults
 * 2. Spam pattern detection (URLs, repeated chars, ALL-CAPS)
 * 3. Length / rate-limit sanity checks
 *
 * Returns { approved, reason? } so the caller can decide
 * whether to publish immediately or hold for admin review.
 */

// ── Layer 1: Banned words ──────────────────────────────────────────

// Hard-banned patterns — always blocked regardless of context.
// Note: \b does NOT work with Cyrillic in JS regex, so we match substrings.
const HARD_BANNED: RegExp[] = [
  // Core Russian mat roots — unambiguous profanity
  /х[уyу][йиеёяю]/i,
  /п[иi]зд/i,
  /бл[яa][дт]/i,
  /е[бb][аaлтиу]/i,
  /г[оа]вн/i,
  /дерьм/i,
  /шлюх/i,
  /п[еe]д[еиоа]р/i,
  /муд[аоиы]к/i,
  /муд[аоиы]л/i,
  // Transliterated / Latin-mixed attempts (use \b for Latin — it works)
  /\bf+u+c+k/i,
  /\bs+h+i+t\b/i,
  /\ba+s+s+h+o+l+e/i,
  /\bb+i+t+c+h/i,
];

// Context-sensitive words: legitimate in farming context but offensive as insults.
// These are checked with a two-step approach:
// 1. Does the text contain the word?
// 2. Is it used as a directed insult? → block. Otherwise → allow.
const CONTEXT_WORDS: { detect: RegExp; insultPatterns: RegExp[] }[] = [
  {
    // "сука" / "суки" / "сукой" etc.
    detect: /сук[аиеой]/i,
    insultPatterns: [
      /(?:ты|вы|вот)\s+сук[аиеой]/i,
      /сук[аиеой]\s+(?:ты|вы|такой|такая|такие)/i,
      /сук[аиеой]\s+вы/i,
    ],
  },
  {
    // "тварь" / "твари"
    detect: /твар[ьи]/i,
    insultPatterns: [
      /(?:ты|вы|вот)\s+твар[ьи]/i,
      /твар[ьи]\s+(?:ты|вы|такой|такая|такие)/i,
      /вот\s+твар[ьи]/i,
    ],
  },
];

function containsBannedWords(text: string): boolean {
  // Check hard-banned first
  if (HARD_BANNED.some((rx) => rx.test(text))) return true;

  // Check context-sensitive words
  for (const cw of CONTEXT_WORDS) {
    if (cw.detect.test(text)) {
      // Word is present — check if it's used as an insult
      if (cw.insultPatterns.some((rx) => rx.test(text))) {
        return true;
      }
      // Otherwise it's a legitimate use (animal term) — allow
    }
  }

  return false;
}

// ── Layer 2: Spam patterns ─────────────────────────────────────────
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const REPEATED_CHAR_PATTERN = /(.)\1{7,}/; // same char 8+ times
const EXCESSIVE_CAPS_RATIO = 0.8; // >80% uppercase in text ≥30 chars

function isSpammy(text: string): { spam: boolean; reason?: string } {
  // URLs in comments
  const urls = text.match(URL_PATTERN);
  if (urls && urls.length >= 3) {
    return { spam: true, reason: "Слишком много ссылок." };
  }

  // Repeated characters
  if (REPEATED_CHAR_PATTERN.test(text)) {
    return { spam: true, reason: "Повторяющиеся символы." };
  }

  // Excessive caps
  if (text.length >= 30) {
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
