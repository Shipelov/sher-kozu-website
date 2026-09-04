import type { IncomingHttpHeaders } from "node:http";
import { ENV } from "./_core/env";

export const AI_FALLBACK_HEADER = "x-sherkozu-ai-fallback";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MashaFallbackInput = {
  messages: ChatMessage[];
  sessionId?: string;
  source?: "faq" | "floating";
  userName?: string;
  currentPage?: string;
};

type ZoyaFallbackInput = {
  messages: ChatMessage[];
  sessionId?: number;
  fingerprint?: string;
};

type MashaFallbackResult = {
  reply: string;
  uncertain?: boolean;
};

type ZoyaFallbackResult = {
  reply: string;
  userType?: "guest" | "registered" | "owner";
  limitReached?: boolean;
};

function isFallbackEnabled(): boolean {
  return process.env.VITEST !== "true";
}

export function isAiFallbackHop(headers: IncomingHttpHeaders): boolean {
  return headers[AI_FALLBACK_HEADER] === "1";
}

export function shouldUseAiFallback(headers: IncomingHttpHeaders): boolean {
  return (
    isFallbackEnabled() &&
    !isAiFallbackHop(headers) &&
    ENV.aiFallbackBaseUrl.trim().length > 0
  );
}

async function callFallbackTrpc<T>(
  procedure: "faqChat.chat" | "nutritionist.chat",
  input: unknown,
): Promise<T | null> {
  const baseUrl = ENV.aiFallbackBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/trpc/${procedure}?batch=1`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [AI_FALLBACK_HEADER]: "1",
    },
    body: JSON.stringify({ 0: { json: input } }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    console.error(
      `[AI Fallback] ${procedure} returned status=${response.status}`,
    );
    return null;
  }

  const payload = (await response.json()) as Array<{
    result?: { data?: { json?: T } };
  }>;
  return payload?.[0]?.result?.data?.json ?? null;
}

export async function requestMashaFallback(
  input: MashaFallbackInput,
): Promise<MashaFallbackResult | null> {
  try {
    const result = await callFallbackTrpc<MashaFallbackResult>(
      "faqChat.chat",
      input,
    );
    return result && typeof result.reply === "string" ? result : null;
  } catch (error) {
    console.error("[AI Fallback] Masha request failed", error);
    return null;
  }
}

export async function requestZoyaFallback(
  input: ZoyaFallbackInput,
): Promise<ZoyaFallbackResult | null> {
  try {
    const result = await callFallbackTrpc<ZoyaFallbackResult>(
      "nutritionist.chat",
      input,
    );
    return result && typeof result.reply === "string" ? result : null;
  } catch (error) {
    console.error("[AI Fallback] Zoya request failed", error);
    return null;
  }
}
