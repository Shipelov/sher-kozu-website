/**
 * Comment Moderation — server-side content filtering.
 *
 * Three-layer approach:
 * 1. Profanity / banned-word filter (Russian + transliterated)
 *    - Pre-processing: normalize text (remove spaces between letters, replace leet-speak)
 *    - Hard-banned: always blocked (unambiguous profanity)
 *    - Context-sensitive: words like "сука", "тварь", "член", "хер" that can be
 *      legitimate terms OR insults — blocked only when used offensively
 * 2. Spam pattern detection (URLs, repeated chars, ALL-CAPS)
 * 3. Length / rate-limit sanity checks
 *
 * Returns { approved, reason? } so the caller can decide
 * whether to publish immediately or hold for admin review.
 */

// ── Pre-processing: normalize evasion tricks ──────────────────────

function normalizeForCheck(text: string): string {
  let t = text.toLowerCase();

  // Remove separators between Cyrillic letters: "х у й" → "хуй"
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
const HARD_BANNED: RegExp[] = [
  // ── Core Russian mat roots ──

  // хуй and all derivatives
  /х[уyу][йиеёяюл3з]/i,
  /хуес/i,
  /нах[уy]/i,
  /пох[уy]/i,

  // пизд and all derivatives
  /п[иi1]зд/i,

  // бляд/блять and all derivatives
  /бл[яa][дт]/i,

  // ебать and all derivatives (including ё variants)
  /[еёe][бb][аaлтиуо]/i,
  /[еёe]бн/i,
  /за[еёe]б/i,
  /у[еёe]б/i,
  /долбо[еёe]б/i,
  /[еёe]бан/i,

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

  // нахер (альтернативная форма нахуй, всегда вульгарно)
  /нахер/i,

  // ── Vulgar body parts / sexual acts ──

  // жопа and derivatives
  /жоп[аыуеой]/i,
  /жопн/i,

  // срать, засранец, насрать
  /[нз]?[ао]?сра[тнл]/i,
  /засран/i,
  /насрат/i,

  // дрочить, дрочила
  /дроч/i,

  // залупа
  /залуп/i,

  // минет
  /минет/i,

  // анал (as sexual term — standalone word)
  /(?:^|\s)анал(?:ьн|\s|$|[.,!?])/i,

  // вагина, пенис (explicit anatomy in vulgar context)
  /вагин/i,
  /пенис/i,

  // сосать/отсосать in sexual context
  /отсос/i,
  /отсас/i,
  /сос[иёе](?:\s|$|[.,!?])/i,    // соси, сосёт, сосе...
  /сосат/i,                        // сосать
  /сосите/i,                       // сосите
  /сос[её]т/i,                      // сосёт, сосет

  // ── Insults / derogatory terms ──

  // чмо, чмошник
  /чмо(?:шн|$|\s|[.,!?])/i,
  /(?:^|\s)чмо(?:$|\s|[.,!?])/i,

  // лох, лохи, лошара
  /лох(?:$|\s|[аиуеой.,!?])/i,
  /лошар/i,

  // даун (as insult)
  /(?:^|\s)даун(?:$|\s|[ыаов.,!?])/i,

  // дебил
  /дебил/i,

  // идиот
  /идиот/i,

  // кретин
  /кретин/i,

  // урод
  /урод(?:$|\s|[ыаовкли.,!?])/i,

  // ── Transliterated / Latin profanity ──
  /\bf+u+c+k/i,
  /\bs+h+i+t\b/i,
  /\ba+s+s+h+o+l+e/i,
  /\bb+i+t+c+h/i,
  /\bd+a+m+n\b/i,
];

// Context-sensitive words: legitimate in some contexts but offensive in others.
const CONTEXT_WORDS: {
  detect: RegExp;
  allowPatterns: RegExp[];
  blockPatterns?: RegExp[];
}[] = [
  {
    // "сука" / "суки" — animal term vs insult
    detect: /сук[аиеой]/i,
    allowPatterns: [
      /(?:порода|собак|щен|кормящ|беременн|родил|милы|красив|добр|ласков)\s.*сук/i,
      /сук[аиеой]\s+(?:порода|собак|щен|кормящ|родил|милы|красив|добр|ласков)/i,
    ],
    blockPatterns: [
      /(?:ты|вы|вот|эти|эта|этот)\s+сук[аиеой]/i,
      /сук[аиеой]\s+(?:ты|вы|такой|такая|такие)/i,
    ],
  },
  {
    // "тварь" / "твари" — animal term vs insult
    detect: /твар[ьи]/i,
    allowPatterns: [
      /(?:божь|живо|милы|красив|добр|ласков|маленьк)\s.*твар/i,
      /твар[ьи]\s+(?:божь|живо|милы|красив|маленьк)/i,
    ],
    blockPatterns: [
      /(?:ты|вы|вот|эти|эта|этот)\s+твар[ьи]/i,
      /твар[ьи]\s+(?:ты|вы|такой|такая|такие)/i,
    ],
  },
  {
    // "член" — club member vs vulgar
    detect: /член/i,
    allowPatterns: [
      /член[ыаов]\s+(?:клуб|семь|команд|организац|общест|правлен|совет)/i,
      /(?:клуб|семь|команд|организац|общест|правлен|совет)\s.*член/i,
      /(?:полноправн|почётн|активн|новы)\s+член/i,
    ],
    blockPatterns: [
      /(?:соси|сосите|сосать|берите|возьми|в рот)\s.*член/i,
      /член\s+(?:в рот|соси|сосите|берите)/i,
      /(?:^|\s)член(?:$|\s|[.,!?])(?!.*(?:клуб|семь|команд|организац|общест|правлен|совет))/i,
    ],
  },
  {
    // "хер" — plant (хрен) vs vulgar
    detect: /(?:^|\s)хер(?:$|\s|[аоуеёнмьюя.,!?])/i,
    allowPatterns: [
      /хер\s*[-—–]\s*(?:это|растен|корнеплод)/i,
      /(?:растен|корнеплод|огород|грядк|посадить|вырастить).*хер/i,
    ],
    blockPatterns: [
      /(?:иди|пошёл|пошла|пошли|катись|вали)\s+(?:на\s+)?хер/i,
      /(?:^|\s)нахер(?:$|\s|[.,!?])/i,
      /(?:пошёл|пошла|пошли)\s+нахер/i,
      /хер(?:ня|ов|ню|ней)/i,
      /(?:соси|сосите)\s+хер/i,
      /хер\s+(?:моржов|собач|тебе)/i,
    ],
  },
  {
    // "хрен" — plant vs vulgar euphemism
    detect: /хрен/i,
    allowPatterns: [
      /(?:растен|корнеплод|огород|грядк|посадить|вырастить|рецепт|соус|приправ|тёрт|натёр|хреновин).*хрен/i,
      /хрен\s*(?:[-—–]\s*(?:это|растен|корнеплод)|ов(?:ый|ая|ое|ина))/i,
    ],
    blockPatterns: [
      /хрен\s+(?:тебе|вам|ему|ей|им)/i,
      /(?:иди|пошёл|пошла|пошли)\s+(?:на\s+)?хрен/i,
      /(?:^|\s)нахрен(?:$|\s|[.,!?])/i,
    ],
  },
];

function containsBannedWords(text: string): boolean {
  const normalized = normalizeForCheck(text);
  const lowerText = text.toLowerCase();

  // Check hard-banned against both original and normalized text
  if (HARD_BANNED.some((rx) => rx.test(normalized) || rx.test(lowerText))) {
    return true;
  }

  // Check context-sensitive words
  for (const cw of CONTEXT_WORDS) {
    if (cw.detect.test(lowerText) || cw.detect.test(normalized)) {
      // Word is present — check allow patterns first
      if (cw.allowPatterns.some((rx) => rx.test(lowerText))) {
        continue; // Legitimate use
      }
      // Check explicit block patterns
      if (cw.blockPatterns && cw.blockPatterns.some((rx) => rx.test(lowerText))) {
        return true;
      }
      // If no allow pattern matched and no block pattern matched,
      // for "член" and "хер" we default to blocking standalone usage
      // (the blockPatterns include a catch-all for standalone usage)
    }
  }

  return false;
}

// ── Layer 2: Spam patterns ─────────────────────────────────────────
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const REPEATED_CHAR_PATTERN = /(.)\1{7,}/;
const EXCESSIVE_CAPS_RATIO = 0.8;

function isSpammy(text: string): { spam: boolean; reason?: string } {
  const urls = text.match(URL_PATTERN);
  if (urls && urls.length >= 3) {
    return { spam: true, reason: "Слишком много ссылок." };
  }

  if (REPEATED_CHAR_PATTERN.test(text)) {
    return { spam: true, reason: "Повторяющиеся символы." };
  }

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
  cleaned?: boolean;
  cleanedText?: string;
};

export function moderateComment(text: string): ModerationResult {
  const sanity = sanitySanity(text);
  if (!sanity.ok) {
    return { approved: false, reason: sanity.reason };
  }

  if (containsBannedWords(text)) {
    return {
      approved: false,
      reason: "Комментарий содержит недопустимые выражения.",
    };
  }

  const spam = isSpammy(text);
  if (spam.spam) {
    return { approved: false, reason: spam.reason };
  }

  const singleUrl = text.match(URL_PATTERN);
  if (singleUrl && singleUrl.length === 1) {
    const cleanedText = text.replace(URL_PATTERN, "[ссылка удалена]").trim();
    return { approved: true, cleaned: true, cleanedText };
  }

  return { approved: true };
}
