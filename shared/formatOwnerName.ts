/**
 * Format a family/owner name for public display.
 * 
 * Input examples:
 *   "Семья Шипеловых"  → "Семья Ш."
 *   "Andrey Shipelov"  → "Andrey Ш."  (but we prefer Russian below)
 *   "Иван Петров"      → "Иван П."
 *   "Мария"            → "Мария"
 * 
 * Logic: if the name contains "Семья" prefix, keep it and abbreviate the surname.
 * Otherwise treat as "FirstName LastName" and abbreviate the last name.
 */
export function formatOwnerNamePublic(fullName: string): string {
  if (!fullName || fullName.trim() === "") return "Владелец";

  const trimmed = fullName.trim();

  // Handle "Семья Фамилия" pattern
  const familyMatch = trimmed.match(/^Семья\s+(.+)$/i);
  if (familyMatch) {
    const surname = familyMatch[1].trim();
    if (surname.length > 0) {
      return `Семья ${surname[0].toUpperCase()}.`;
    }
    return "Семья";
  }

  // Handle "FirstName LastName" pattern
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName[0].toUpperCase()}.`;
  }

  // Single name — return as is
  return trimmed;
}

/**
 * Format owner name for admin display — return the full name unchanged.
 */
export function formatOwnerNameAdmin(fullName: string): string {
  if (!fullName || fullName.trim() === "") return "Без имени";
  return fullName.trim();
}
