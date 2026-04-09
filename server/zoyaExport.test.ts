/**
 * Tests for Zoya AI Nutritionist export (PDF/DOCX) and share functionality.
 *
 * Covers:
 * - PDF generation from markdown content
 * - DOCX generation from markdown content
 * - Share link creation and retrieval (DB helpers)
 * - Export endpoint registration in index.ts
 * - Content detection logic (isSubstantiveContent)
 * - Markdown parsing for export
 */

import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════════
// PDF Generation Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya PDF Export Generator", () => {
  it("generates a valid PDF buffer from markdown content", async () => {
    const { generateZoyaPdfBuffer } = await import("./zoyaExportGenerator");

    const buffer = await generateZoyaPdfBuffer({
      content: `# Рацион на неделю

## Понедельник

### Завтрак
- Овсянка на козьем молоке — 200 мл
- Творог фермерский — 100 г
- Мёд — 1 ч.л.

### Обед
- Суп-пюре из тыквы с козьим молоком
- Салат с мягким сыром

### Ужин
- Кефир козий — 200 мл
- Овощное рагу

**Калорийность:** ~1800 ккал

---

Рекомендации основаны на нормах ВОЗ.`,
      title: "Рацион на неделю",
      userName: "Анна",
      userQuestion: "Составь мне план питания на неделю с козьим молоком",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Check PDF magic bytes (%PDF)
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("generates PDF without optional fields", async () => {
    const { generateZoyaPdfBuffer } = await import("./zoyaExportGenerator");

    const buffer = await generateZoyaPdfBuffer({
      content:
        "Козье молоко содержит витамины A, B2, B12, кальций и фосфор. Рекомендуемая суточная норма для взрослого — 200-400 мл. Продукты из козьего молока включают творог, кефир, йогурт и мягкие сыры. Каждый из них имеет уникальный набор полезных свойств для здоровья.",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("handles content with tables correctly", async () => {
    const { generateZoyaPdfBuffer } = await import("./zoyaExportGenerator");

    const buffer = await generateZoyaPdfBuffer({
      content: `# Сравнение продуктов

| Продукт | Белок | Жир | Калории |
|---------|-------|-----|---------|
| Козье молоко | 3.2 г | 4.1 г | 68 ккал |
| Творог | 18 г | 5 г | 120 ккал |
| Кефир | 3 г | 3.2 г | 56 ккал |

Все данные на 100 г продукта.`,
      title: "Сравнение продуктов",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DOCX Generation Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya DOCX Export Generator", () => {
  it("generates a valid DOCX buffer from markdown content", async () => {
    const { generateZoyaDocxBuffer } = await import("./zoyaExportGenerator");

    const buffer = await generateZoyaDocxBuffer({
      content: `# Рацион на неделю

## Понедельник

### Завтрак
- Овсянка на козьем молоке — 200 мл
- Творог фермерский — 100 г

### Обед
- Суп-пюре из тыквы
- Салат с мягким сыром

**Калорийность:** ~1800 ккал`,
      title: "Рацион на неделю",
      userName: "Анна",
      userQuestion: "Составь план питания",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // DOCX files are ZIP archives — check PK magic bytes
    const header = buffer.subarray(0, 2).toString("ascii");
    expect(header).toBe("PK");
  });

  it("generates DOCX without optional fields", async () => {
    const { generateZoyaDocxBuffer } = await import("./zoyaExportGenerator");

    const buffer = await generateZoyaDocxBuffer({
      content:
        "Козье молоко — отличный источник кальция и витаминов. Рекомендуемая суточная норма для взрослого — 200-400 мл козьего молока. Продукты включают творог, кефир, йогурт и мягкие сыры.",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Endpoint Registration Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Export Endpoints", () => {
  it("has PDF export endpoint registered in server config", async () => {
    const indexContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "./_core/index.ts"),
      "utf-8"
    );

    expect(indexContent).toContain('app.post("/api/zoya/export/pdf"');
    expect(indexContent).toContain("generateZoyaPdfBuffer");
  });

  it("has DOCX export endpoint registered in server config", async () => {
    const indexContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "./_core/index.ts"),
      "utf-8"
    );

    expect(indexContent).toContain('app.post("/api/zoya/export/docx"');
    expect(indexContent).toContain("generateZoyaDocxBuffer");
  });

  it("has share link creation endpoint registered", async () => {
    const indexContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "./_core/index.ts"),
      "utf-8"
    );

    expect(indexContent).toContain('app.post("/api/zoya/share"');
    expect(indexContent).toContain("createSharedContent");
  });

  it("has share link retrieval endpoint registered", async () => {
    const indexContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "./_core/index.ts"),
      "utf-8"
    );

    expect(indexContent).toContain('app.get("/api/zoya/share/:token"');
    expect(indexContent).toContain("getSharedContent");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Frontend Component Structure Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Export Frontend Components", () => {
  it("ZoyaExportActions component exists and exports default", async () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/ZoyaExportActions.tsx"
    );
    expect(fs.existsSync(componentPath)).toBe(true);

    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("export default function ZoyaExportActions");
    // Uses template literal: `/api/zoya/export/${format}`
    expect(content).toContain("/api/zoya/export/");
    expect(content).toContain("/api/zoya/share");
  });

  it("ZoyaChat imports and uses ZoyaExportActions", async () => {
    const chatPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/ZoyaChat.tsx"
    );
    const content = fs.readFileSync(chatPath, "utf-8");

    expect(content).toContain('import ZoyaExportActions from "./ZoyaExportActions"');
    expect(content).toContain("<ZoyaExportActions");
  });

  it("ZoyaSharedView page exists with correct route", async () => {
    const pagePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ZoyaSharedView.tsx"
    );
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("export default function ZoyaSharedView");
    expect(content).toContain("/api/zoya/share/");
  });

  it("App.tsx has route for /zoya/share/:token", async () => {
    const appPath = path.resolve(
      import.meta.dirname,
      "../client/src/App.tsx"
    );
    const content = fs.readFileSync(appPath, "utf-8");

    expect(content).toContain('/zoya/share/:token');
    expect(content).toContain("ZoyaSharedView");
  });

  it("ZoyaExportActions has share via Telegram and WhatsApp", async () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/ZoyaExportActions.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");

    expect(content).toContain("t.me/share/url");
    expect(content).toContain("wa.me");
    expect(content).toContain("Telegram");
    expect(content).toContain("WhatsApp");
  });

  it("ZoyaExportActions filters non-substantive content", async () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/ZoyaExportActions.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");

    // Should have minimum content length check
    expect(content).toContain("MIN_CONTENT_LENGTH");
    // Should have keyword detection
    expect(content).toContain("EXPORT_KEYWORDS");
    expect(content).toContain("isSubstantiveContent");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Database Schema Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Shared Content Schema", () => {
  it("schema includes zoyaSharedContent table", async () => {
    const schemaPath = path.resolve(
      import.meta.dirname,
      "../drizzle/schema.ts"
    );
    const content = fs.readFileSync(schemaPath, "utf-8");

    expect(content).toContain("zoyaSharedContent");
    expect(content).toContain("shareToken");
    expect(content).toContain("viewCount");
    expect(content).toContain("expiresAt");
  });

  it("nutritionistDb has share helpers", async () => {
    const dbPath = path.resolve(
      import.meta.dirname,
      "./nutritionistDb.ts"
    );
    const content = fs.readFileSync(dbPath, "utf-8");

    expect(content).toContain("createSharedContent");
    expect(content).toContain("getSharedContent");
    expect(content).toContain("shareToken");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Share Link Expiry Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Share Link 3-Day Expiry", () => {
  it("createSharedContent sets expiresAt 3 days from now", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must have the 3-day constant
    expect(content).toContain("SHARE_LINK_EXPIRY_DAYS");
    expect(content).toContain("= 3");

    // Must calculate expiresAt from Date.now()
    expect(content).toContain("SHARE_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000");
    expect(content).toContain("expiresAt");
  });

  it("createSharedContent returns expiresAt in response", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must return expiresAt alongside shareToken
    expect(content).toContain("return { shareToken, expiresAt:");
  });

  it("getSharedContent returns expired flag for expired links", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must return { ...entry, expired: true } for expired content
    expect(content).toContain("expired: true");
    // Must return { ...entry, expired: false } for active content
    expect(content).toContain("expired: false");
  });

  it("cleanupExpiredShareLinks function exists", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    expect(content).toContain("export async function cleanupExpiredShareLinks");
    expect(content).toContain("delete(zoyaSharedContent)");
    expect(content).toContain("expiresAt");
  });

  it("cleanup is registered on server startup", async () => {
    const indexContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "./_core/index.ts"),
      "utf-8"
    );

    expect(indexContent).toContain("cleanupExpiredShareLinks");
    // Runs on startup and periodically
    expect(indexContent).toContain("setInterval");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Popular Link Notification Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Popular Link Notifications", () => {
  it("has a view threshold constant for popular links", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    expect(content).toContain("POPULAR_LINK_VIEW_THRESHOLD");
    expect(content).toContain("= 10");
  });

  it("triggers notification at threshold in getSharedContent", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must check newViewCount === threshold
    expect(content).toContain("newViewCount === POPULAR_LINK_VIEW_THRESHOLD");
    // Must call triggerPopularLinkNotification
    expect(content).toContain("triggerPopularLinkNotification");
  });

  it("triggerPopularLinkNotification sends in-app notification", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must use createUserNotification for in-app notification
    expect(content).toContain("createUserNotification");
    expect(content).toContain("zoya_popular_share");
    // Must include link to the shared content
    expect(content).toContain("/zoya/share/");
  });

  it("triggerPopularLinkNotification also notifies farm owner", async () => {
    const dbPath = path.resolve(import.meta.dirname, "./nutritionistDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");

    // Must also call notifyOwner for system-level notification
    expect(content).toContain("notifyOwner");
    expect(content).toContain("Популярная ссылка Зои");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Frontend Expiry UI Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya Share Frontend Expiry Handling", () => {
  it("ZoyaSharedView shows countdown for active links", async () => {
    const pagePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ZoyaSharedView.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must show remaining time
    expect(content).toContain("formatTimeRemaining");
    expect(content).toContain("timeRemaining");
    expect(content).toContain("Действует ещё");
  });

  it("ZoyaSharedView handles expired links with warning banner", async () => {
    const pagePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ZoyaSharedView.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must check for expired flag
    expect(content).toContain("isExpired");
    expect(content).toContain("expired");
    // Must show expiry warning
    expect(content).toContain("Срок действия ссылки истёк");
    // Must offer to get new recommendations
    expect(content).toContain("Получить новые рекомендации");
  });

  it("ZoyaSharedView shows expiry date in actions bar", async () => {
    const pagePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ZoyaSharedView.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must show expiry date notice
    expect(content).toContain("Ссылка действительна до");
    expect(content).toContain("Скачайте файл, чтобы сохранить рекомендации навсегда");
  });

  it("ZoyaExportActions shows 3-day notice in share toasts", async () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/ZoyaExportActions.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");

    // Must mention 3-day validity in share toasts
    expect(content).toContain("3 дня");
  });
});
