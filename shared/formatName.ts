/**
 * Format a user's display name for polite greeting.
 *
 * Rules:
 * 1. If the name contains multiple words, display as-is (assumed "Имя Фамилия" or "Имя").
 * 2. Capitalize the first letter of each word.
 * 3. Never display just a last name alone — if only one word and it looks like
 *    a surname (common Russian surname endings), prepend nothing but still capitalize.
 * 4. Trim extra whitespace.
 *
 * Examples:
 *   "Arina Shipelova" → "Arina Shipelova"
 *   "shipelova arina" → "Shipelova Arina"
 *   "ARINA" → "Arina"
 *   "" → "Пользователь"
 *   null → "Пользователь"
 */

const DEFAULT_NAME = "Пользователь";

/**
 * Capitalize first letter of each word, lowercase the rest.
 */
function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format a raw name string into a polite display name.
 * Returns "Имя Фамилия" format with proper capitalization.
 */
export function formatDisplayName(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return DEFAULT_NAME;

  const trimmed = rawName.trim();

  // If name is already multi-word, just capitalize properly
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return DEFAULT_NAME;

  return capitalizeWords(trimmed);
}

/**
 * Extract just the first name for informal greetings.
 * "Arina Shipelova" → "Arina"
 * "Шипелова Арина" → "Шипелова" (first word)
 */
export function getFirstName(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return DEFAULT_NAME;
  const words = rawName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return DEFAULT_NAME;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
}

/**
 * Get initials from a name (for avatar circles).
 * "Arina Shipelova" → "АШ" or "AS"
 * "Арина" → "А"
 */
export function getInitials(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return "?";
  return rawName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("")
    .slice(0, 2);
}
