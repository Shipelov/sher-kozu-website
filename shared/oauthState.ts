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

function encodeBase64Url(input: string) {
  if (typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return globalThis
      .btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  return Buffer.from(input, "utf-8").toString("base64url");
}

function decodeBase64Url(input: string) {
  if (typeof globalThis.atob === "function") {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(input, "base64url").toString("utf-8");
}

export function encodeOAuthState(payload: OAuthRedirectState) {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeOAuthState(state: string): OAuthRedirectState | null {
  try {
    const decoded = decodeBase64Url(state);
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
