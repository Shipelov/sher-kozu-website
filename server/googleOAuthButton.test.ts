/**
 * Tests for Google OAuth sign-in button in AuthModal.
 * Validates that the button is present in both login and register views,
 * uses getLoginUrl for redirect, has proper divider, and correct test IDs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const authModalSrc = readFileSync(
  resolve(__dirname, "../client/src/components/AuthModal.tsx"),
  "utf-8"
);

const constSrc = readFileSync(
  resolve(__dirname, "../client/src/const.ts"),
  "utf-8"
);

describe("Google OAuth Button — AuthModal", () => {
  // ── Import checks ──
  it("imports getLoginUrl from const", () => {
    expect(authModalSrc).toContain('import { getLoginUrl } from "@/const"');
  });

  // ── Login view ──
  describe("Login view", () => {
    it("has Google OAuth button with correct test ID", () => {
      expect(authModalSrc).toContain('data-testid="google-oauth-btn"');
    });

    it("Google button text says 'Войти через Google'", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn"');
      const block = authModalSrc.substring(btnIdx, btnIdx + 1200);
      expect(block).toContain("Войти через Google");
    });

    it("Google button uses getLoginUrl() for redirect", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn"');
      // Look backwards to find the onClick handler
      const blockBefore = authModalSrc.substring(Math.max(0, btnIdx - 300), btnIdx);
      expect(blockBefore).toContain("getLoginUrl()");
    });

    it("has 'или' divider before Google button in login view", () => {
      const loginFnIdx = authModalSrc.indexOf("const renderLogin");
      const registerFnIdx = authModalSrc.indexOf("const renderRegister");
      const loginBlock = authModalSrc.substring(loginFnIdx, registerFnIdx);
      expect(loginBlock).toContain("или");
      expect(loginBlock).toContain("border-t border-border");
    });

    it("Google button has Google logo SVG", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn"');
      const block = authModalSrc.substring(btnIdx, btnIdx + 1200);
      expect(block).toContain("#4285F4"); // Google blue
      expect(block).toContain("#34A853"); // Google green
      expect(block).toContain("#FBBC05"); // Google yellow
      expect(block).toContain("#EA4335"); // Google red
    });

    it("Google button uses outline variant", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn"');
      const blockBefore = authModalSrc.substring(Math.max(0, btnIdx - 300), btnIdx);
      expect(blockBefore).toContain('variant="outline"');
    });
  });

  // ── Register view ──
  describe("Register view", () => {
    it("has Google OAuth button with correct test ID in register", () => {
      expect(authModalSrc).toContain('data-testid="google-oauth-btn-register"');
    });

    it("Google button text says 'Зарегистрироваться через Google'", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn-register"');
      const block = authModalSrc.substring(btnIdx, btnIdx + 1200);
      expect(block).toContain("Зарегистрироваться через Google");
    });

    it("Google button in register also uses getLoginUrl()", () => {
      const btnIdx = authModalSrc.indexOf('data-testid="google-oauth-btn-register"');
      const blockBefore = authModalSrc.substring(Math.max(0, btnIdx - 300), btnIdx);
      expect(blockBefore).toContain("getLoginUrl()");
    });

    it("has 'или' divider before Google button in register view", () => {
      const registerFnIdx = authModalSrc.indexOf("const renderRegister");
      const captchaFnIdx = authModalSrc.indexOf("const renderCaptcha");
      const registerBlock = authModalSrc.substring(registerFnIdx, captchaFnIdx);
      expect(registerBlock).toContain("или");
      expect(registerBlock).toContain("border-t border-border");
    });
  });

  // ── getLoginUrl contract ──
  describe("getLoginUrl contract", () => {
    it("getLoginUrl builds URL from VITE_OAUTH_PORTAL_URL", () => {
      expect(constSrc).toContain("VITE_OAUTH_PORTAL_URL");
    });

    it("getLoginUrl uses window.location.origin for redirect", () => {
      expect(constSrc).toContain("window.location.origin");
    });

    it("getLoginUrl encodes state with buildOAuthState", () => {
      expect(constSrc).toContain("buildOAuthState");
    });
  });

  // ── Both views have buttons ──
  it("has exactly 2 Google OAuth buttons (login + register)", () => {
    const matches = authModalSrc.match(/data-testid="google-oauth-btn/g);
    expect(matches).toHaveLength(2);
  });

  it("has exactly 2 'или' dividers (login + register)", () => {
    // Count divider sections — each has the "или" text inside a span
    const dividerPattern = /relative flex justify-center text-xs uppercase/g;
    const matches = authModalSrc.match(dividerPattern);
    expect(matches).toHaveLength(2);
  });

  // ── Modal overflow fix ──
  describe("Modal overflow fix", () => {
    it("DialogContent has max-h-[90vh] to prevent viewport overflow", () => {
      expect(authModalSrc).toContain("max-h-[90vh]");
    });

    it("DialogContent has overflow-y-auto for scrollable content", () => {
      expect(authModalSrc).toContain("overflow-y-auto");
    });
  });
});
