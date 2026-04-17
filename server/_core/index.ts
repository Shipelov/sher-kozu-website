import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { withRetry, isTransientDbError } from "../retryUtils";
import { analyticsMonitor } from "../analyticsMonitor";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function runCmsHistoryCleanup() {
  try {
    const { getDb } = await import("../db");
    const { cmsBlockHistory } = await import("../../drizzle/schema");
    const { lt } = await import("drizzle-orm");

    const result = await withRetry(
      async () => {
        const db = await getDb();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return db.delete(cmsBlockHistory).where(lt(cmsBlockHistory.changedAt, cutoff));
      },
      {
        label: "CMS History Cleanup",
        maxAttempts: 3,
        baseDelayMs: 2000,
        isRetryable: isTransientDbError,
      }
    );

    const deleted = (result as any)[0]?.affectedRows ?? 0;
    if (deleted > 0) {
      console.log(`[CMS History Cleanup] Deleted ${deleted} record(s) older than 30 days`);
    } else {
      console.log(`[CMS History Cleanup] No old records to clean up`);
    }
  } catch (err) {
    console.error("[CMS History Cleanup] Error during cleanup (all retries exhausted):", err);
  }
}

async function runTrashCleanup() {
  try {
    const { findExpiredTrashedUsers, permanentDeleteUser } = await import("../db");

    const expired = await withRetry(
      () => findExpiredTrashedUsers(30),
      {
        label: "Trash Cleanup/Find",
        maxAttempts: 3,
        baseDelayMs: 2000,
        isRetryable: isTransientDbError,
      }
    );

    if (expired.length === 0) return;
    console.log(`[Trash Cleanup] Found ${expired.length} expired user(s) to permanently delete`);

    for (const user of expired) {
      try {
        await withRetry(
          () => permanentDeleteUser(user.id),
          {
            label: `Trash Cleanup/Delete(${user.id})`,
            maxAttempts: 3,
            baseDelayMs: 1000,
            isRetryable: isTransientDbError,
          }
        );
        console.log(`[Trash Cleanup] Permanently deleted user ${user.id} (${user.name || "no name"})`);
      } catch (err) {
        console.error(`[Trash Cleanup] Failed to delete user ${user.id} (all retries exhausted):`, err);
      }
    }
    console.log(`[Trash Cleanup] Completed. Deleted ${expired.length} user(s).`);
  } catch (err) {
    console.error("[Trash Cleanup] Error during cleanup (all retries exhausted):", err);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with reasonable size limit
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://maps.googleapis.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: https://*.cloudfront.net https://*.amazonaws.com https://*.googleapis.com https://maps.gstatic.com https://maps.google.com",
          "connect-src 'self' ws: wss: https://*.cloudfront.net https://*.amazonaws.com https://api.openai.com https://api.telegram.org https://*.workers.dev https://maps.googleapis.com https://*.storage.yandexcloud.net",
          "frame-ancestors 'self' https://koza.vip https://*.koza.vip",
        ].join("; ")
      );
    }
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    );
    next();
  });

  // Analytics beacon endpoint (for sendBeacon on page unload)
  app.post("/api/analytics/time", async (req, res) => {
    try {
      const { sessionId, pagePath, timeOnPage } = req.body;
      if (sessionId && pagePath && typeof timeOnPage === "number") {
        const { updateVisitTimeOnPage } = await import("../db");
        await updateVisitTimeOnPage(sessionId, pagePath, timeOnPage);
      }
      res.status(204).end();
    } catch {
      res.status(204).end();
    }
  });

  // Calculator PDF generation endpoint
  app.post("/api/calculator/pdf", async (req, res) => {
    try {
      const { generateCalculatorPdfBuffer } = await import("../pdfGenerator");
      const pdfBuffer = await generateCalculatorPdfBuffer(req.body);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`Шерь_Козу_Расчёт_${req.body.breedName || "расчёт"}_${req.body.sharePercent || 100}%.pdf`)}`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF", message: err?.message });
    }
  });

  // Owner delivery PDF generation endpoint
  app.post("/api/delivery/owner/pdf", async (req, res) => {
    try {
      const { generateOwnerDeliveryPdf } = await import("../pdfDeliveryGenerator");
      const pdfBuffer = await generateOwnerDeliveryPdf(req.body);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`мои_доставки_${req.body.year || "доставки"}.pdf`)}`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Owner delivery PDF error:", err);
      res.status(500).json({ error: "Failed to generate PDF", message: err?.message });
    }
  });

  // Admin delivery PDF generation endpoint
  app.post("/api/delivery/admin/pdf", async (req, res) => {
    try {
      const { generateAdminDeliveryPdf } = await import("../pdfDeliveryGenerator");
      const pdfBuffer = await generateAdminDeliveryPdf(req.body);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`доставка_${req.body.animalName || "доставка"}_${req.body.year || ""}.pdf`)}`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Admin delivery PDF error:", err);
      res.status(500).json({ error: "Failed to generate PDF", message: err?.message });
    }
  });

  // Owner delivery Excel generation endpoint
  app.post("/api/delivery/owner/excel", async (req, res) => {
    try {
      const { generateOwnerDeliveryExcel } = await import("../excelDeliveryGenerator");
      const excelBuffer = generateOwnerDeliveryExcel(req.body);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`мои_доставки_${req.body.year || "доставки"}.xlsx`)}`
      );
      res.send(excelBuffer);
    } catch (err: any) {
      console.error("Owner delivery Excel error:", err);
      res.status(500).json({ error: "Failed to generate Excel", message: err?.message });
    }
  });

  // Admin delivery Excel generation endpoint
  app.post("/api/delivery/admin/excel", async (req, res) => {
    try {
      const { generateAdminDeliveryExcel } = await import("../excelDeliveryGenerator");
      const excelBuffer = generateAdminDeliveryExcel(req.body);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`доставка_${req.body.animalName || "доставка"}_${req.body.year || ""}.xlsx`)}`
      );
      res.send(excelBuffer);
    } catch (err: any) {
      console.error("Admin delivery Excel error:", err);
      res.status(500).json({ error: "Failed to generate Excel", message: err?.message });
    }
  });

  // ─── Zoya Export Endpoints (PDF / DOCX) ───
  app.post("/api/zoya/export/pdf", async (req, res) => {
    try {
      const { generateZoyaPdfBuffer } = await import("../zoyaExportGenerator");
      const pdfBuffer = await generateZoyaPdfBuffer(req.body);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`Зоя_рекомендации_${new Date().toISOString().slice(0, 10)}.pdf`)}`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Zoya PDF export error:", err);
      res.status(500).json({ error: "Failed to generate PDF", message: err?.message });
    }
  });

  app.post("/api/zoya/export/docx", async (req, res) => {
    try {
      const { generateZoyaDocxBuffer } = await import("../zoyaExportGenerator");
      const docxBuffer = await generateZoyaDocxBuffer(req.body);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`Зоя_рекомендации_${new Date().toISOString().slice(0, 10)}.docx`)}`
      );
      res.send(docxBuffer);
    } catch (err: any) {
      console.error("Zoya DOCX export error:", err);
      res.status(500).json({ error: "Failed to generate DOCX", message: err?.message });
    }
  });

  // ─── Zoya Share Link Endpoints ───
  app.post("/api/zoya/share", async (req, res) => {
    try {
      const { createSharedContent } = await import("../nutritionistDb");
      const user = await (async () => {
        try {
          return await sdk.authenticateRequest(req);
        } catch {
          return null;
        }
      })();
      const { content, title, userQuestion } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      const { shareToken } = await createSharedContent({
        content,
        title,
        userQuestion,
        userId: user?.id ?? null,
      });
      res.json({ shareToken });
    } catch (err: any) {
      console.error("Zoya share error:", err);
      res.status(500).json({ error: "Failed to create share link", message: err?.message });
    }
  });

  app.get("/api/zoya/share/:token", async (req, res) => {
    try {
      const { getSharedContent } = await import("../nutritionistDb");
      const entry = await getSharedContent(req.params.token);
      if (!entry) {
        return res.status(404).json({ error: "Content not found or expired" });
      }
      res.json(entry);
    } catch (err: any) {
      console.error("Zoya share fetch error:", err);
      res.status(500).json({ error: "Failed to fetch shared content", message: err?.message });
    }
  });

  // Zoya AI Nutritionist SSE streaming endpoint
  const { registerZoyaSSE } = await import("../zoyaSSE");
  registerZoyaSSE(app);

  // Zoya Knowledge Base file upload & URL import endpoints
  const { registerNutriFileUpload } = await import("../nutriFileUpload");
  registerNutriFileUpload(app);

  // Telegram bot webhook
  try {
    const { getTelegramWebhookHandler } = await import("../telegramBot");
    app.post("/api/telegram/webhook", getTelegramWebhookHandler());
    console.log("[Telegram] Webhook handler registered at /api/telegram/webhook");
  } catch (err) {
    console.warn("[Telegram] Failed to register webhook handler:", err);
  }

  // Telegram Mini App auth
  try {
    const { registerTelegramMiniAppRoutes } = await import("../telegramMiniApp");
    registerTelegramMiniAppRoutes(app);
    console.log("[Telegram] Mini App auth registered at /api/tg-auth");
  } catch (err) {
    console.warn("[Telegram] Failed to register Mini App auth:", err);
  }

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Run trash cleanup on startup and then every 24 hours
    runTrashCleanup();
    setInterval(runTrashCleanup, 24 * 60 * 60 * 1000);

    // Run CMS history cleanup on startup and then every 24 hours
    runCmsHistoryCleanup();
    setInterval(runCmsHistoryCleanup, 24 * 60 * 60 * 1000);

    // Run expired share link cleanup on startup and every 12 hours
    (async () => {
      try {
        const { cleanupExpiredShareLinks } = await import("../nutritionistDb");
        await cleanupExpiredShareLinks();
        setInterval(async () => {
          try {
            await cleanupExpiredShareLinks();
          } catch (err) {
            console.error("[Zoya Share Cleanup] Error:", err);
          }
        }, 12 * 60 * 60 * 1000);
      } catch (err) {
        console.error("[Zoya Share Cleanup] Startup error:", err);
      }
    })();

    // Start analytics monitoring (reports every 5 minutes)
    analyticsMonitor.startReporting();

    // Set Telegram webhook URL in production
    if (process.env.NODE_ENV === "production") {
      (async () => {
        try {
          const { getBot } = await import("../telegramBot");
          const bot = getBot();
          // Use the configured domain (DEPLOY_DOMAIN env var), fallback to koza.vip
          const domain = process.env.DEPLOY_DOMAIN || "koza.vip";
          const webhookUrl = `https://${domain}/api/telegram/webhook`;
          await bot.api.setWebhook(webhookUrl, { drop_pending_updates: true });
          console.log(`[Telegram] Webhook set to ${webhookUrl}`);

          // Register bot commands
          await bot.api.setMyCommands([
            { command: "status", description: "Моё животное — статус и метрики" },
            { command: "delivery", description: "Статус доставки" },
            { command: "balance", description: "Баланс SKC токенов" },
            { command: "events", description: "События клуба" },
            { command: "photo", description: "Последнее фото животного" },
            { command: "zoya", description: "AI-нутрициолог Зоя" },
            { command: "help", description: "AI-ассистент Маша" },
            { command: "settings", description: "Настройки уведомлений" },
          ]);
          console.log("[Telegram] Bot commands registered");

          // Set Mini App as the menu button
          const miniAppUrl = `https://${domain}/tg`;
          await bot.api.setChatMenuButton({
            menu_button: {
              type: "web_app",
              text: "Личный кабинет",
              web_app: { url: miniAppUrl },
            },
          });
          console.log(`[Telegram] Mini App menu button set to ${miniAppUrl}`);
        } catch (err) {
          console.warn("[Telegram] Failed to set webhook:", err);
        }
      })();
    }
  });
}

startServer().catch(console.error);
