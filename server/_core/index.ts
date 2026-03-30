import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
    const db = await getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await db.delete(cmsBlockHistory)
      .where(lt(cmsBlockHistory.changedAt, cutoff));

    const deleted = (result as any)[0]?.affectedRows ?? 0;
    if (deleted > 0) {
      console.log(`[CMS History Cleanup] Deleted ${deleted} record(s) older than 30 days`);
    } else {
      console.log(`[CMS History Cleanup] No old records to clean up`);
    }
  } catch (err) {
    console.error("[CMS History Cleanup] Error during cleanup:", err);
  }
}

async function runTrashCleanup() {
  try {
    const { findExpiredTrashedUsers, permanentDeleteUser } = await import("../db");
    const expired = await findExpiredTrashedUsers(30);
    if (expired.length === 0) return;
    console.log(`[Trash Cleanup] Found ${expired.length} expired user(s) to permanently delete`);
    for (const user of expired) {
      try {
        await permanentDeleteUser(user.id);
        console.log(`[Trash Cleanup] Permanently deleted user ${user.id} (${user.name || "no name"})`);
      } catch (err) {
        console.error(`[Trash Cleanup] Failed to delete user ${user.id}:`, err);
      }
    }
    console.log(`[Trash Cleanup] Completed. Deleted ${expired.length} user(s).`);
  } catch (err) {
    console.error("[Trash Cleanup] Error during cleanup:", err);
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
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.cloudfront.net https://*.amazonaws.com; connect-src 'self' https://*.manus.im https://*.cloudfront.net https://*.amazonaws.com; frame-ancestors 'self' https://*.manus.im https://*.manus.space https://*.manus.computer"
    );
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    );
    next();
  });

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
  });
}

startServer().catch(console.error);
