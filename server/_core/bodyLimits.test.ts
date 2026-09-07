import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  createBodyLimitMiddleware,
  LARGE_BODY_TRPC_PROCEDURES,
  needsLargeBody,
} from "./bodyLimits";

function buildApp() {
  const app = express();
  app.use(...createBodyLimitMiddleware());
  app.post("*", (req, res) => {
    res.json({ bytes: JSON.stringify(req.body).length });
  });
  return app;
}

// ~300kb JSON: больше 200kb default, меньше 10mb upload-лимита
const bigPayload = JSON.stringify({ data: "x".repeat(300 * 1024) });

describe("needsLargeBody", () => {
  it("даёт большой лимит только upload-процедурам tRPC", () => {
    for (const procedure of LARGE_BODY_TRPC_PROCEDURES) {
      expect(needsLargeBody(`/api/trpc/${procedure}`)).toBe(true);
    }
    expect(needsLargeBody("/api/trpc/faqChat.chat")).toBe(false);
    expect(needsLargeBody("/api/trpc/animalPhotos.uploadLimit")).toBe(false);
  });

  it("учитывает tRPC-batch с несколькими процедурами", () => {
    expect(needsLargeBody("/api/trpc/auth.me,cms.uploadImage")).toBe(true);
    expect(needsLargeBody("/api/trpc/auth.me%2Ccms.uploadImage")).toBe(true);
    expect(needsLargeBody("/api/trpc/auth.me,cms.list")).toBe(false);
  });

  it("даёт большой лимит маршрутам загрузки базы знаний", () => {
    expect(needsLargeBody("/api/nutri/upload-file")).toBe(true);
    expect(needsLargeBody("/api/nutri/import-url")).toBe(true);
    expect(needsLargeBody("/api/zoya/share")).toBe(false);
    expect(needsLargeBody("/api/analytics/time")).toBe(false);
  });
});

describe("createBodyLimitMiddleware", () => {
  it("отклоняет JSON больше 200kb на обычном маршруте", async () => {
    const res = await request(buildApp())
      .post("/api/trpc/faqChat.chat")
      .set("content-type", "application/json")
      .send(bigPayload);
    expect(res.status).toBe(413);
  });

  it("принимает JSON больше 200kb на upload-процедуре", async () => {
    const res = await request(buildApp())
      .post("/api/trpc/animalPhotos.upload")
      .set("content-type", "application/json")
      .send(bigPayload);
    expect(res.status).toBe(200);
    expect(res.body.bytes).toBeGreaterThan(300 * 1024);
  });

  it("отклоняет urlencoded больше 200kb на обычном маршруте", async () => {
    const res = await request(buildApp())
      .post("/api/gate-auth")
      .set("content-type", "application/x-www-form-urlencoded")
      .send(`data=${"x".repeat(300 * 1024)}`);
    expect(res.status).toBe(413);
  });

  it("не трогает raw-тело загрузки файла", async () => {
    const app = express();
    app.use(...createBodyLimitMiddleware());
    app.post("/api/nutri/upload-file", async (req, res) => {
      let received = 0;
      for await (const chunk of req) received += (chunk as Buffer).length;
      res.json({ received });
    });
    const res = await request(app)
      .post("/api/nutri/upload-file")
      .set("content-type", "application/pdf")
      .send(Buffer.alloc(300 * 1024, 1));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(300 * 1024);
  });
});
