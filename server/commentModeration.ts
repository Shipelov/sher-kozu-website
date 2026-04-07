/**
 * Comment Moderation — server-side content filtering.
 *
 * Three-layer approach:
 * 1. Profanity / banned-word filter (Russian + transliterated)
 *    - Pre-processing: normalize text (remove spaces between letters, replace leet-speak)
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

// ── Pre-processing: normalize evasion tricks ──────────────────────

/**
 * Normalize text for profanity detection:
 * - Remove spaces/dots/dashes between Cyrillic letters (anti-evasion)
 * - Replace common leet-speak substitutions (numbers → letters)
 */
function normalizeForCheck(text: string): string {
  let t = text.toLowerCase();

  // Remove separators between Cyrillic letters: "х у й" → "хуй", "б.л.я.д.ь" → "блядь"
  t = t.replace(/([а-яёa-z])[\s.\-_*]+(?=[а-яёa-z])/gi, "$1");

  // Common leet-speak / number substitutions
  t = t
    .replace(/0/g, "о")
    .replace(/1/g, "и")
    .replace(/3/g, "з")
    .replace(/4/g, "ч")
    .replace(/6/g, "б")
    .replace(/9/g, "д");

  return t;
}

// ── Layer 1: Banned words ──────────────────────────────────────────

// Hard-banned patterns — always blocked regardless of context.
// Tested against normalized (lowercased, de-spaced) text.
const HARD_BANNED: RegExp[] = [
  // ── Core Russian mat roots ──
  // хуй and all derivatives
  /х[уyу][йиеёяюл3з]/i,
  /хуес/i,       // хуесос
  /нах[уy]/i,    // нахуй, нахуя
  /пох[уy]/i,    // похуй

  // пизд and all derivatives
  /п[иi1]зд/i,

  // бляд/блять and all derivatives
  /бл[яa][дт]/i,

  // ебать and all derivatives (including ё variants)
  /[еёe][бb][аaлтиуо]/i,
  /[еёe]бн/i,    // ёбнутый, ебнуть
  /за[еёe]б/i,   // заебал, заебись
  /у[еёe]б/i,    // уёбок, уебок, уёбище
  /долбо[еёe]б/i, // долбоёб, долбоеб
  /[еёe]бан/i,   // ебаный, ёбаный, ебанат, ебанутый

  // говно
  /г[оа]вн/i,

  // дерьмо
  /дерьм/i,

  // шлюха
  /шлюх/i,

  // пидор / педераст and variants
  /п[иеe][дd][оаeи]р/i,
  /п[иеe][дd][аеи]р/i,
  /педераст/i,

  // мудак / мудило
  /муд[аоиы][клз]/i,

  // ── Transliterated / Latin profanity ──
  /\bf+u+c+k/i,
  /\bs+h+i+t\b/i,
  /\ba+s+s+h+o+l+e/i,
  /\bb+i+t+c+h/i,
  /\bd+a+m+n\b/i,
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
  // Normalize for evasion detection
  const normalized = normalizeForCheck(text);

  // Check hard-banned against both original and normalized text
  if (HARD_BANNED.some((rx) => rx.test(normalized) || rx.test(text.toLowerCase()))) {
    return true;
  }

  // Check context-sensitive words (use original text for context analysis)
  const lowerText = text.toLowerCase();
  for (const cw of CONTEXT_WORDS) {
    if (cw.detect.test(lowerText)) {
      // Word is present — check if it's used as an insult
      if (cw.insultPatterns.some((rx) => rx.test(lowerText))) {
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
