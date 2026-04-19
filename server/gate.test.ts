import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerGate } from "./gateMiddleware";

describe("Gate middleware", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      GATE_ENABLED: process.env.GATE_ENABLED,
      GATE_LOGIN: process.env.GATE_LOGIN,
      GATE_PASSWORD: process.env.GATE_PASSWORD,
      JWT_SECRET: process.env.JWT_SECRET,
    };
  });

  afterEach(() => {
    // Restore env
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  function createApp(envOverrides: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(envOverrides)) {
      process.env[k] = v;
    }
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    registerGate(app);
    // A test route behind the gate
    app.get("/", (_req, res) => res.send("Home page"));
    app.get("/dashboard", (_req, res) => res.send("Dashboard"));
    app.get("/api/trpc/test", (_req, res) => res.json({ ok: true }));
    app.get("/tg/status", (_req, res) => res.send("TG Status"));
    return app;
  }

  it("should show gate page when enabled and no cookie", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Первый в России клуб");
    expect(res.text).toContain("персонального фермерства");
    expect(res.text).not.toContain("Home page");
  });

  it("should bypass gate for /api/ routes", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app).get("/api/trpc/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("should bypass gate for /tg/ routes", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app).get("/tg/status");
    expect(res.status).toBe(200);
    expect(res.text).toBe("TG Status");
  });

  it("should set cookie and redirect on correct credentials", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app)
      .post("/api/gate-auth")
      .send("login=testlogin&password=testpass")
      .set("Content-Type", "application/x-www-form-urlencoded");

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("site_access=");
  });

  it("should show error on wrong credentials", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app)
      .post("/api/gate-auth")
      .send("login=wrong&password=wrong")
      .set("Content-Type", "application/x-www-form-urlencoded");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Неверный логин или пароль");
  });

  it("should allow access with valid cookie", async () => {
    const app = createApp({
      GATE_ENABLED: "true",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    // First, get the cookie
    const authRes = await request(app)
      .post("/api/gate-auth")
      .send("login=testlogin&password=testpass")
      .set("Content-Type", "application/x-www-form-urlencoded");

    const cookies = authRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Now access with cookie
    const pageRes = await request(app)
      .get("/")
      .set("Cookie", cookies);

    expect(pageRes.status).toBe(200);
    expect(pageRes.text).toBe("Home page");
  });

  it("should not gate when GATE_ENABLED is not true", async () => {
    const app = createApp({
      GATE_ENABLED: "false",
      GATE_LOGIN: "testlogin",
      GATE_PASSWORD: "testpass",
      JWT_SECRET: "test-secret",
    });

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toBe("Home page");
  });

  it("should work with actual env credentials", async () => {
    // This test validates that the actual GATE_LOGIN and GATE_PASSWORD from env work
    const login = process.env.GATE_LOGIN;
    const password = process.env.GATE_PASSWORD;

    if (!login || !password) {
      console.log("Skipping env credentials test — GATE_LOGIN/GATE_PASSWORD not set");
      return;
    }

    const app = createApp({
      GATE_ENABLED: "true",
      JWT_SECRET: process.env.JWT_SECRET || "test-secret",
    });

    const res = await request(app)
      .post("/api/gate-auth")
      .send(`login=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}`)
      .set("Content-Type", "application/x-www-form-urlencoded");

    expect(res.status).toBe(303);
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});
