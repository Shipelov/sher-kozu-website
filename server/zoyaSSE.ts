/**
 * Zoya AI Nutritionist — SSE Streaming Endpoint
 *
 * Provides real-time streaming chat responses via Server-Sent Events.
 * Registered as POST /api/zoya/chat/stream in Express.
 */

import type { Express, Request, Response } from "express";
import type { Message } from "./_core/llm";
import { sdk } from "./_core/sdk";
import type { User } from "../drizzle/schema";
import {
  createNutriSession,
  addNutriMessage,
  getGuestMessageCount,
  getNutriProfile,
  determineNutriUserType,
  getOwnerNutriContext,
} from "./nutritionistDb";
import {
  buildZoyaPrompt,
  type ZoyaUserContext,
} from "./prompts/zoyaSystemPrompt";
import { getZoyaRagEntries } from "./zoyaRag";
import { buildGroundedSportsMenuReply } from "./zoyaSportsMenuAdvisor";
import { invokeZoyaLLM } from "./zoyaChatRuntime";

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
    const { messages, sessionId, fingerprint } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      sessionId?: number;
      fingerprint?: string;
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

    // Build user context
    const userContext: ZoyaUserContext = {
      userType,
      userName: user?.name,
      messageCountInSession: messages.filter((m) => m.role === "user").length - 1,
      totalGuestMessages:
        userType === "guest" && fingerprint
          ? await getGuestMessageCount(fingerprint)
          : undefined,
    };

    // Load profile for registered/owner users
    if (user?.id && userType !== "guest") {
      userContext.profile = await getNutriProfile(user.id);
    }

    // Load owner context for Type 2 users
    if (user?.id && userType === "owner") {
      userContext.ownerContext = await getOwnerNutriContext(user.id);
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const groundedSportsReply = buildGroundedSportsMenuReply(messages, userContext);

    if (groundedSportsReply && lastUserMsg) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.write(`data: ${JSON.stringify({ type: "meta", userType })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "chunk", content: groundedSportsReply })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();

      saveZoyaChatAsync(
        sessionId ?? null,
        user?.id ?? null,
        lastUserMsg.content,
        groundedSportsReply,
        userType,
        fingerprint,
      ).catch((err) => console.error("[Zoya SSE] Save error:", err));
      return;
    }

    // RAG: search knowledge base
    const ragEntries = await getZoyaRagEntries(lastUserMsg?.content);

    // Build system prompt
    const systemPrompt = buildZoyaPrompt({
      user: userContext,
      ragEntries,
      currentQuery: lastUserMsg?.content,
    });

    // Build LLM messages
    const llmMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Send user type info first
    res.write(`data: ${JSON.stringify({ type: "meta", userType })}\n\n`);

    try {
      // Use non-streaming LLM call and simulate streaming by chunking the response
      // (invokeLLM doesn't support native streaming, so we chunk the result)
      const result = await invokeZoyaLLM(llmMessages);

      const content = result.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        res.write(
          `data: ${JSON.stringify({
            type: "chunk",
            content: "Простите, у меня сейчас небольшие технические трудности. Попробуйте спросить ещё раз 🌿",
          })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // Stream the response in small chunks for a typing effect
      const chunkSize = 8; // characters per chunk
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        // Small delay for typing effect (only in chunks, not blocking)
        if (i + chunkSize < content.length) {
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();

      // Save to DB asynchronously
      if (lastUserMsg) {
        saveZoyaChatAsync(
          sessionId ?? null,
          user?.id ?? null,
          lastUserMsg.content,
          content,
          userType,
          fingerprint
        ).catch((err) => console.error("[Zoya SSE] Save error:", err));
      }
    } catch (error) {
      console.error("[Zoya SSE] LLM error:", error);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          content: "Ой, что-то пошло не так. Попробуйте позже 🌿",
        })}\n\n`
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });
}

async function saveZoyaChatAsync(
  sessionId: number | null,
  userId: number | null,
  userMessage: string,
  assistantReply: string,
  userType: "guest" | "registered" | "owner",
  fingerprint?: string | null
) {
  let sid: number;
  if (sessionId) {
    sid = sessionId;
  } else {
    const session = await createNutriSession({
      userId,
      userType,
      guestFingerprint: fingerprint ?? null,
    });
    sid = session.id;
  }

  await addNutriMessage({
    sessionId: sid,
    role: "user",
    content: userMessage,
  });

  await addNutriMessage({
    sessionId: sid,
    role: "assistant",
    content: assistantReply,
  });
}
