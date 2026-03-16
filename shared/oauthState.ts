export type OAuthRedirectState = {
  redirectUri: string;
  origin: string;
  returnPath: string;
};

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeReturnPath(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return "/";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return "/";
    }
  }

  return value.startsWith("/") ? value : `/${value}`;
}

export function encodeOAuthState(payload: OAuthRedirectState) {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeOAuthState(state: string): OAuthRedirectState | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as Partial<OAuthRedirectState>;
    const redirectUri = typeof parsed.redirectUri === "string" ? parsed.redirectUri : null;
    const origin = normalizeOrigin(parsed.origin);
    const returnPath = normalizeReturnPath(parsed.returnPath);

    if (!redirectUri || !origin) return null;

    return {
      redirectUri,
      origin,
      returnPath,
    };
  } catch {
    return null;
  }
}

export function buildOAuthState(origin: string, returnPath: string, callbackPath = "/api/oauth/callback"): OAuthRedirectState {
  const safeOrigin = normalizeOrigin(origin);
  return {
    origin: safeOrigin ?? "http://localhost",
    redirectUri: `${safeOrigin ?? "http://localhost"}${callbackPath}`,
    returnPath: normalizeReturnPath(returnPath),
  };
}

export function getPostAuthRedirectUrl(payload: OAuthRedirectState) {
  return `${payload.origin}${normalizeReturnPath(payload.returnPath)}`;
}
