import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workerRoot = path.resolve(process.cwd(), "cloudflare/tg-proxy");

async function readWorker(relativePath: string) {
  return readFile(path.join(workerRoot, relativePath), "utf8");
}

describe("Cloudflare tg-proxy export", () => {
  it("preserves the normalized active source checksum", async () => {
    const metadata = JSON.parse(await readWorker("export-metadata.json"));
    const source = (await readWorker("src/worker.js")).replace(/\r\n/g, "\n");
    const digest = createHash("sha256").update(source).digest("hex");

    expect(metadata.activeVersionId).toBe("f364d3ca");
    expect(metadata.productionChangedDuringExport).toBe(false);
    expect(digest).toBe(metadata.normalizedLfSha256);
  });

  it("documents the real AI binding, locked model, and supported routes", async () => {
    const config = JSON.parse(await readWorker("wrangler.jsonc"));
    const source = await readWorker("src/worker.js");

    expect(config.name).toBe("tg-proxy");
    expect(config.main).toBe("src/worker.js");
    expect(config.ai).toEqual({ binding: "AI" });
    expect(source).toContain(
      'const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"',
    );
    expect(source).toContain('url.pathname !== "/openai/v1/chat/completions"');
    expect(source).toContain('url.pathname.startsWith("/webhook/")');
    expect(source).toContain('url.pathname.startsWith("/sdk/")');
    expect(source).toContain('url.pathname === "/health"');
  });

  it("declares secret names without committing common literal credentials", async () => {
    const config = JSON.parse(await readWorker("wrangler.jsonc"));
    const source = await readWorker("src/worker.js");
    const requiredSecrets = [
      "ALERT_BOT_TOKEN",
      "ALERT_CHAT_ID",
      "OPENAI_PROXY_SECRET",
      "PROXY_SECRET",
    ];

    expect(config.secrets.required).toEqual(requiredSecrets);
    for (const secretName of requiredSecrets) {
      expect(source).toMatch(new RegExp(`env\\?*\\.${secretName}`));
    }

    expect(source).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(source).not.toMatch(/\d{8,}:[A-Za-z0-9_-]{20,}/);
    expect(source).not.toMatch(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    );
  });
});
