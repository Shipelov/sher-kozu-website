/**
 * Phone number formatting and validation utilities.
 *
 * Target format: +7 (XXX) XXX-XX-XX
 * Accepts Russian mobile numbers starting with +7, 8, or 7.
 * Strips all non-digit characters before processing.
 */

/** Strip everything except digits from a string */
export function stripNonDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize a Russian phone number to 10-digit core (without country code).
 * Handles inputs starting with +7, 8, or 7 (11 digits), or plain 10-digit numbers.
 * Returns null if the input doesn't look like a valid Russian mobile number.
 */
export function extractPhoneDigits(raw: string): string | null {
  const digits = stripNonDigits(raw);

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
}

/**
 * Format 10 core digits into the canonical display format: +7 (XXX) XXX-XX-XX
 */
export function formatPhoneDisplay(tenDigits: string): string {
  if (tenDigits.length !== 10) return tenDigits;
  return `+7 (${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6, 8)}-${tenDigits.slice(8, 10)}`;
}

/**
 * Format a raw phone input into the canonical display format.
 * Returns the formatted string or null if the input is invalid.
 */
export function formatPhone(raw: string): string | null {
  const core = extractPhoneDigits(raw);
  if (!core) return null;
  return formatPhoneDisplay(core);
}

/**
 * Validate that a phone string is a valid Russian mobile number.
 * Accepts any format — digits are extracted and checked.
 */
export function isValidRussianPhone(raw: string): boolean {
  return extractPhoneDigits(raw) !== null;
}

/**
 * Apply a live input mask as the user types.
 * Takes the current raw input value and returns a partially formatted string.
 * This allows progressive formatting while the user is still typing.
 *
 * Format progression:
 *   +7 (
 *   +7 (9
 *   +7 (91
 *   +7 (912
 *   +7 (912) 3
 *   +7 (912) 34
 *   +7 (912) 345
 *   +7 (912) 345-6
 *   +7 (912) 345-67
 *   +7 (912) 345-67-8
 *   +7 (912) 345-67-89
 */
export function applyPhoneMask(raw: string): string {
  const digits = stripNonDigits(raw);

  // Normalize: if starts with 8 or 7 and has >10 digits, treat first digit as country code
  let core: string;
  if (digits.length > 0 && (digits[0] === "7" || digits[0] === "8")) {
    core = digits.slice(1);
  } else {
    core = digits;
  }

  // Limit to 10 digits
  core = core.slice(0, 10);

  if (core.length === 0) return "+7 ";

  let result = "+7 (";
  // Area code (3 digits)
  result += core.slice(0, 3);
  if (core.length <= 3) return result;

  result += ") ";
  // First group (3 digits)
  result += core.slice(3, 6);
  if (core.length <= 6) return result;

  result += "-";
  // Second group (2 digits)
  result += core.slice(6, 8);
  if (core.length <= 8) return result;

  result += "-";
  // Third group (2 digits)
  result += core.slice(8, 10);

  return result;
}
