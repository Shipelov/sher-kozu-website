/**
 * Coming Soon Gate — password-protects the entire site while in development.
 *
 * - Checks for a `site_access` cookie signed with HMAC-SHA256.
 * - If missing/invalid → serves a self-contained HTML gate page.
 * - POST /api/gate-auth with { login, password } → sets cookie (30 days).
 * - Bypasses: /api/telegram/*, /api/tg-auth/*, /uploads/*, favicon.ico,
 *   and Telegram Mini App routes (/tg/*).
 *
 * Toggle via env: GATE_ENABLED=true / GATE_LOGIN / GATE_PASSWORD
 */

import type { Request, Response, NextFunction, Express } from "express";
import crypto from "crypto";

/* ─── Config ─── */
const GATE_COOKIE = "site_access";
const COOKIE_MAX_AGE_DAYS = 30;

function getGateConfig() {
  return {
    enabled: process.env.GATE_ENABLED === "true",
    login: process.env.GATE_LOGIN || "",
    password: process.env.GATE_PASSWORD || "",
    secret: process.env.JWT_SECRET || "fallback-gate-secret",
  };
}

/* ─── HMAC token helpers ─── */
function makeToken(secret: string): string {
  const payload = `gate-access-granted:${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64")}.${sig}`;
}

function verifyToken(token: string, secret: string): boolean {
  try {
    const [b64Payload, sig] = token.split(".");
    if (!b64Payload || !sig) return false;
    const payload = Buffer.from(b64Payload, "base64").toString();
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

/* ─── Bypass paths (no gate check) ─── */
const BYPASS_PREFIXES = [
  "/api/telegram/",
  "/api/tg-auth/",
  "/api/gate-auth",
  "/uploads/",
  "/assets/",
  "/tg/",
  "/tg",
  "/farm/",
  "/farm",
];

const BYPASS_EXACT = ["/favicon.ico", "/robots.txt", "/manifest.json"];

function shouldBypass(path: string): boolean {
  if (BYPASS_EXACT.includes(path)) return true;
  return BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/* ─── Gate HTML page ─── */
function gateHtml(error?: string): string {
  const errorBlock = error
    ? `<div class="error">${error}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Шерь Козу — Скоро открытие</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --forest: #1a5c2e;
      --forest-light: #2d7a45;
      --amber: #c4922a;
      --cream: #faf6ef;
      --cream-dark: #f0e8d8;
      --oak: #3d2b1f;
      --oak-light: #5a4030;
    }

    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: var(--cream);
      color: var(--oak);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    /* Subtle organic background pattern */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 20% 30%, rgba(26, 92, 46, 0.06), transparent),
        radial-gradient(ellipse 500px 500px at 80% 70%, rgba(196, 146, 42, 0.05), transparent);
      pointer-events: none;
    }

    .gate-container {
      position: relative;
      z-index: 1;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }

    /* Brand */
    .brand {
      margin-bottom: 2rem;
    }

    .brand-icon {
      width: 56px;
      height: 56px;
      background: var(--forest);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      box-shadow: 0 4px 20px rgba(26, 92, 46, 0.25);
    }

    .brand-icon svg {
      width: 28px;
      height: 28px;
      color: white;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .brand-name {
      font-family: 'DM Sans', sans-serif;
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--oak);
    }

    .brand-name span {
      color: var(--forest);
    }

    /* Headline */
    .headline {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.65rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--oak);
      margin-bottom: 0.75rem;
    }

    .subtitle {
      font-size: 0.95rem;
      color: var(--oak-light);
      line-height: 1.5;
      margin-bottom: 2.5rem;
      opacity: 0.8;
    }

    /* Form */
    .gate-form {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .input-group {
      position: relative;
    }

    .input-group input {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1.5px solid var(--cream-dark);
      border-radius: 0.75rem;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.95rem;
      background: white;
      color: var(--oak);
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .input-group input:focus {
      border-color: var(--forest-light);
      box-shadow: 0 0 0 3px rgba(26, 92, 46, 0.1);
    }

    .input-group input::placeholder {
      color: #a09888;
    }

    .submit-btn {
      padding: 0.875rem 1.5rem;
      background: var(--forest);
      color: white;
      border: none;
      border-radius: 0.75rem;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 0.25rem;
    }

    .submit-btn:hover {
      background: var(--forest-light);
    }

    .submit-btn:active {
      transform: scale(0.98);
    }

    /* Error */
    .error {
      background: #fef2f2;
      color: #b91c1c;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
      border: 1px solid #fecaca;
    }

    /* Footer */
    .gate-footer {
      margin-top: 2.5rem;
      font-size: 0.8rem;
      color: var(--oak-light);
      opacity: 0.5;
    }

    @media (max-width: 480px) {
      .headline { font-size: 1.4rem; }
      .brand-name { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="gate-container">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 17 3.5s1.5 2.5 1.5 6c0 3.5-2.5 6-2.5 6"/><path d="M11.7 13.2c-.5-.5-1.2-.8-2-.8-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8"/><path d="M15.5 9.5c1.7 0 3 1.3 3 3s-1.3 3-3 3"/></svg>
      </div>
      <div class="brand-name">Шерь <span>Козу</span></div>
    </div>

    <h1 class="headline">Первый в России клуб<br>персонального фермерства<br>скоро откроется</h1>
    <p class="subtitle">Сайт находится в стадии разработки.<br>Если у вас есть код доступа — введите его ниже.</p>

    ${errorBlock}

    <form class="gate-form" method="POST" action="/api/gate-auth">
      <div class="input-group">
        <input type="text" name="login" placeholder="Логин" required autocomplete="off" />
      </div>
      <div class="input-group">
        <input type="password" name="password" placeholder="Пароль" required autocomplete="off" />
      </div>
      <button type="submit" class="submit-btn">Войти</button>
    </form>

    <div class="gate-footer">Шерь Козу &copy; 2026</div>
  </div>
</body>
</html>`;
}

/* ─── Register gate routes & middleware ─── */
export function registerGate(app: Express): void {
  const config = getGateConfig();

  if (!config.enabled) {
    console.log("[Gate] Disabled (GATE_ENABLED !== 'true')");
    return;
  }

  console.log("[Gate] Enabled — site is password-protected");

  // POST /api/gate-auth — verify credentials and set cookie
  app.post("/api/gate-auth", (req: Request, res: Response) => {
    const { login, password } = req.body;

    if (login === config.login && password === config.password) {
      const token = makeToken(config.secret);
      res.cookie(GATE_COOKIE, token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: req.protocol === "https" || req.headers["x-forwarded-proto"] === "https",
        path: "/",
      });
      // Redirect to homepage after successful auth
      const returnTo = (req.body.returnTo as string) || "/";
      return res.redirect(303, returnTo);
    }

    // Wrong credentials — show gate page with error
    res.status(401).send(gateHtml("Неверный логин или пароль"));
  });

  // Middleware — check cookie on every request
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip bypass paths
    if (shouldBypass(req.path)) return next();

    // Skip API routes (they have their own auth)
    if (req.path.startsWith("/api/")) return next();

    // Check cookie
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${GATE_COOKIE}=([^;]+)`));
    const token = match?.[1];

    if (token && verifyToken(token, config.secret)) {
      return next();
    }

    // No valid token — serve gate page
    res.status(200).send(gateHtml());
  });
}
