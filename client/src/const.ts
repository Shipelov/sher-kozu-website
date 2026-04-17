export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * getLoginUrl — returns a local login page URL.
 * After removing Manus OAuth, all authentication goes through
 * the local AuthModal (email/phone + OTP).
 * The returnPath is encoded as a query parameter so the login page
 * can redirect back after successful authentication.
 */
export const getLoginUrl = (returnPath?: string) => {
  const targetPath =
    returnPath ??
    `${window.location.pathname}${window.location.search}${window.location.hash}`;
  // Encode the return path so the login page can redirect back
  return `/login?returnTo=${encodeURIComponent(targetPath)}`;
};

/**
 * Detect if the page is running inside an iframe.
 */
export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Navigate to the login page.
 * Uses standard redirect for normal pages.
 * Opens in a new tab when inside an iframe (e.g. Telegram WebView).
 */
export function navigateToLogin(returnPath?: string): void {
  const url = getLoginUrl(returnPath);
  if (isInsideIframe()) {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}
