/**
 * Маскирование персональных данных для логов: в stdout pm2 не должны попадать
 * email, коды и токены (см. CLAUDE.md, «Правила кода»).
 */

/** `ivan.petrov@example.com` → `i***@example.com`; невалидный ввод → `***`. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}
