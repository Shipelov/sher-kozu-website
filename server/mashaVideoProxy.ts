import { Readable } from "node:stream";
import type { Express, Request, Response } from "express";

export const MASHA_VIDEO_SOURCE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha-intro-video-compressed_ee7518ad.mp4";

const COPY_RESPONSE_HEADERS = [
  "content-length",
  "content-range",
  "etag",
  "last-modified",
] as const;

export function registerMashaVideoProxy(app: Express) {
  app.get("/api/media/masha-intro.mp4", async (req: Request, res: Response) => {
    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abortController.abort();
    });

    try {
      const range = req.headers.range;
      const ifNoneMatch = req.headers["if-none-match"];
      const upstream = await fetch(MASHA_VIDEO_SOURCE, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        headers: {
          ...(range ? { Range: range } : {}),
          ...(typeof ifNoneMatch === "string"
            ? { "If-None-Match": ifNoneMatch }
            : {}),
        },
        signal: abortController.signal,
      });

      res.status(upstream.status);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      for (const header of COPY_RESPONSE_HEADERS) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }

      if (req.method === "HEAD" || !upstream.body) {
        res.end();
        return;
      }

      if (!upstream.ok && upstream.status !== 206) {
        console.error(`[MashaVideo] upstream returned ${upstream.status}`);
        res.end();
        return;
      }

      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      if (abortController.signal.aborted) return;
      console.error("[MashaVideo] proxy failed:", error);
      if (!res.headersSent) {
        res.status(502).json({ error: "Video temporarily unavailable" });
      } else {
        res.end();
      }
    }
  });
}
