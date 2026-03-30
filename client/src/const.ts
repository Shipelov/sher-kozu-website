import { buildOAuthState, encodeOAuthState } from "@shared/oauthState";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const origin = window.location.origin;
  const targetPath = returnPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const statePayload = buildOAuthState(origin, targetPath);
  const state = encodeOAuthState(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", statePayload.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Detect if the page is running inside an iframe (e.g. Manus Preview panel).
 * Cross-origin iframes will throw on `window.top` access, so we catch that too.
 */
export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin iframe — definitely inside an iframe
    return true;
  }
}

/**
 * Navigate to the OAuth login page.
 * When running inside an iframe (Manus Preview), opens in a new tab/window
 * to avoid the black screen caused by cross-origin navigation restrictions.
 * On a normal page, uses standard redirect.
 */
export function navigateToLogin(returnPath?: string): void {
  const url = getLoginUrl(returnPath);
  if (isInsideIframe()) {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}
