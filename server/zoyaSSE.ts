/**
 * Zoya AI Nutritionist — SSE Streaming Endpoint
 *
 * Provides real-time streaming chat responses via Server-Sent Events.
 * Registered as POST /api/zoya/chat/stream in Express.
 */

import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import type { User } from "../drizzle/schema";
import {
  getGuestMessageCount,
  determineNutriUserType,
  saveNutriConversation,
} from "./nutritionistDb";
import { ZOYA_TEMPORARY_UNAVAILABLE_REPLY } from "./zoyaChatRuntime";
import { assembleZoyaContext, buildZoyaSessionState } from "./zoyaContextAssembler";
import { buildZoyaProfileGateMeta, buildZoyaProfileGateReply } from "./zoyaProfileGate";
import { buildZoyaValidationFallback, runZoyaOrchestrator } from "./zoyaOrchestrator";

const GUEST_MESSAGE_LIMIT = 3;

// Rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function tryAuthenticateUser(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user && user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export function registerZoyaSSE(app: Express) {
  app.post("/api/zoya/chat/stream", async (req: Request, res: Response) => {
    const { messages, sessionId, fingerprint, profileId, profileConfirmed } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      sessionId?: number;
      fingerprint?: string;
      profileId?: number;
      profileConfirmed?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages required" });
      return;
    }

    // Authenticate (optional — guests allowed)
    const user = await tryAuthenticateUser(req);

    // Rate limit
    const rateLimitKey = user?.openId || fingerprint || "anonymous";
    if (!checkRateLimit(rateLimitKey)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    // Determine user type
    const userType = await determineNutriUserType(user?.id);

    // Guest limit check
    if (userType === "guest" && fingerprint) {
      const guestCount = await getGuestMessageCount(fingerprint);
      if (guestCount >= GUEST_MESSAGE_LIMIT) {
        // Send as SSE so the client can handle it uniformly
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(
          `data: ${JSON.stringify({
            type: "limit_reached",
            content:
              "Вы использовали все 3 бесплатных сообщения. Зарегистрируйтесь, чтобы продолжить общение с Зоей — это бесплатно 🌿",
            userType,
          })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const assembledContext = await assembleZoyaContext({
      query: lastUserMsg?.content ?? "",
      userId: user?.id,
      userType,
      profileId,
      profileConfirmed,
      sessionId,
    });
    const profileContext = buildZoyaProfileGateMeta(assembledContext);

    const profileGateReply = buildZoyaProfileGateReply(assembledContext);
    if (profileGateReply && lastUserMsg) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.write(`data: ${JSON.stringify({ type: "meta", userType, profileContext })}\n\n`);
      const savedSessionId = await saveZoyaChatAsync(
        sessionId ?? null,
        user?.id ?? null,
        lastUserMsg.content,
        profileGateReply,
        userType,
        fingerprint,
        assembledContext.profile?.id ?? null,
        Boolean(profileConfirmed),
        buildZoyaSessionState(assembledContext),
      ).catch((err) => {
        console.error("[Zoya SSE] Save error:", err);
        return null;
      });
      if (savedSessionId) {
        res.write(`data: ${JSON.stringify({ type: "session", sessionId: savedSessionId })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "chunk", content: profileGateReply })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Send user type info first
    res.write(`data: ${JSON.stringify({ type: "meta", userType, profileContext })}\n\n`);

    const requestController = new AbortController();
    let completed = false;
    const canWrite = () => !res.writableEnded && !res.destroyed;
    const onClose = () => {
      if (!completed) requestController.abort();
    };
    res.on("close", onClose);
    const heartbeat = setInterval(() => {
      if (canWrite() && !completed) res.write(": keepalive\n\n");
    }, 5_000);

    try {
      // Use non-streaming LLM call and simulate streaming by chunking the response.
      // The shared runtime enforces a bounded deadline and aborts stalled upstream work.
      const result = await runZoyaOrchestrator(assembledContext, messages, {
        signal: requestController.signal,
      });

      if (!canWrite() || requestController.signal.aborted) return;

      const content = result.markdown;
      const savedSessionId = lastUserMsg
        ? await saveZoyaChatAsync(
          sessionId ?? null,
          user?.id ?? null,
          lastUserMsg.content,
          content,
          userType,
          fingerprint,
          assembledContext.profile?.id ?? null,
          Boolean(profileConfirmed),
          buildZoyaSessionState(assembledContext),
        ).catch((err) => {
          console.error("[Zoya SSE] Save error:", err);
          return null;
        })
        : null;
      if (savedSessionId && canWrite()) {
        res.write(`data: ${JSON.stringify({ type: "session", sessionId: savedSessionId })}\n\n`);
      }

      // Stream the response in small chunks for a typing effect
      const chunkSize = 8; // characters per chunk
      for (let i = 0; i < content.length; i += chunkSize) {
        if (!canWrite() || requestController.signal.aborted) return;
        const chunk = content.slice(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        if (i + chunkSize < content.length) {
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      }

      completed = true;
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      const isValidationError = error instanceof Error
        && ["ZoyaValidationError", "ZoyaStructuredOutputError"].includes(error.name);
      console.error("[Zoya SSE] Orchestrator error:", error);
      if (!canWrite() || requestController.signal.aborted) return;
      const fallbackContent = isValidationError
        ? buildZoyaValidationFallback(assembledContext)
        : ZOYA_TEMPORARY_UNAVAILABLE_REPLY;
      const savedSessionId = lastUserMsg
        ? await saveZoyaChatAsync(
          sessionId ?? null,
          user?.id ?? null,
          lastUserMsg.content,
          fallbackContent,
          userType,
          fingerprint,
          assembledContext.profile?.id ?? null,
          Boolean(profileConfirmed),
          buildZoyaSessionState(assembledContext),
        ).catch((saveError) => {
          console.error("[Zoya SSE] Save error:", saveError);
          return null;
        })
        : null;
      if (savedSessionId) {
        res.write(`data: ${JSON.stringify({ type: "session", sessionId: savedSessionId })}\n\n`);
      }
      res.write(
        `data: ${JSON.stringify({
          type: "chunk",
          content: fallbackContent,
        })}\n\n`,
      );
      completed = true;
      res.write("data: [DONE]\n\n");
      res.end();
    } finally {
      clearInterval(heartbeat);
      res.off("close", onClose);
    }
  });
}

async function saveZoyaChatAsync(
  sessionId: number | null,
  userId: number | null,
  userMessage: string,
  assistantReply: string,
  userType: "guest" | "registered" | "owner",
  fingerprint?: string | null,
  profileId?: number | null,
  profileConfirmed?: boolean,
  contextState?: {
    intent?: string;
    pendingField?: string;
    collected?: Record<string, string | number | boolean | string[]>;
  } | null,
) {
  return saveNutriConversation({
    sessionId,
    userId,
    userType,
    guestFingerprint: fingerprint,
    profileId,
    profileConfirmed,
    contextState,
    userMessage,
    assistantReply,
  });
}
