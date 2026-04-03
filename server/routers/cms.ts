import { z } from "zod";
import { eq, and, asc, desc, lt } from "drizzle-orm";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cmsBlocks, cmsBlockHistory } from "../../drizzle/schema";
import { storagePut } from "../storage";

/**
 * CMS Router — admin-managed content blocks for public pages.
 * Public pages fetch blocks via `getPageBlocks` (public procedure).
 * Admin manages blocks via CRUD procedures.
 *
 * Architecture notes:
 * - seedDefaults uses per-block upsert (not all-or-nothing) to handle partial failures
 * - getPageBlocks auto-recovers missing default blocks on read
 * - Image blocks store imageUrl (content may be null or empty string)
 * - uploadImage only updates imageUrl, never touches contentType
 * - Every mutation records a history entry in cmsBlockHistory for audit & rollback
 */

/* ─── Helper: record a history entry ─── */
async function recordHistory(
  db: Awaited<ReturnType<typeof getDb>>,
  opts: {
    blockId: number;
    page: string;
    blockKey: string;
    action: string;
    prevContent: string | null;
    prevImageUrl: string | null;
    prevVisible: boolean | null;
    newContent: string | null;
    newImageUrl: string | null;
    newVisible: boolean | null;
    changedByOpenId: string;
    changedByName: string | null;
  }
) {
  try {
    await db.insert(cmsBlockHistory).values({
      blockId: opts.blockId,
      page: opts.page,
      blockKey: opts.blockKey,
      action: opts.action,
      prevContent: opts.prevContent,
      prevImageUrl: opts.prevImageUrl,
      prevVisible: opts.prevVisible,
      newContent: opts.newContent,
      newImageUrl: opts.newImageUrl,
      newVisible: opts.newVisible,
      changedByOpenId: opts.changedByOpenId,
      changedByName: opts.changedByName,
    });
  } catch (err) {
    console.error("[CMS History] Failed to record history:", err);
  }
}

/* ─── Helper: fetch current block state ─── */
async function fetchBlock(db: Awaited<ReturnType<typeof getDb>>, blockId: number) {
  const rows = await db
    .select()
    .from(cmsBlocks)
    .where(eq(cmsBlocks.id, blockId))
    .limit(1);
  return rows[0] ?? null;
}

export const cmsRouter = router({
  /**
   * Get all blocks for a page (public — used by frontend pages).
   * Returns only visible blocks by default.
   * Auto-seeds missing default blocks on first access.
   */
  getPageBlocks: publicProcedure
    .input(z.object({
      page: z.string().min(1).max(64),
      includeHidden: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      let rows = await db
        .select()
        .from(cmsBlocks)
        .where(eq(cmsBlocks.page, input.page))
        .orderBy(asc(cmsBlocks.sortOrder));

      // Auto-recovery: if some default blocks are missing, create them
      const defaults = getDefaultBlocks(input.page);
      if (defaults.length > 0) {
        const existingKeys = new Set(rows.map((r: { blockKey: string }) => r.blockKey));
        const missing = defaults.filter(d => !existingKeys.has(d.blockKey));

        if (missing.length > 0) {
          for (const block of missing) {
            try {
              await db.insert(cmsBlocks).values({
                page: block.page,
                blockKey: block.blockKey,
                label: block.label,
                contentType: block.contentType,
                content: block.content ?? "",
                imageUrl: block.imageUrl ?? null,
                section: block.section ?? null,
                sortOrder: block.sortOrder,
                visible: block.visible,
              });
            } catch (err) {
              console.warn(`[CMS] Auto-recovery: failed to create block "${block.blockKey}" for page "${block.page}":`, err);
            }
          }
          rows = await db
            .select()
            .from(cmsBlocks)
            .where(eq(cmsBlocks.page, input.page))
            .orderBy(asc(cmsBlocks.sortOrder));
        }
      }

      if (input.includeHidden) return rows;
      return rows.filter((r: typeof rows[number]) => r.visible);
    }),

  /**
   * Get all blocks across all pages (admin — for the CMS editor).
   */
  listAll: adminProcedure
    .query(async () => {
      const db = await getDb();
      return db
        .select()
        .from(cmsBlocks)
        .orderBy(asc(cmsBlocks.page), asc(cmsBlocks.sortOrder));
    }),

  /**
   * Create or update a content block (upsert by page + blockKey).
   */
  upsertBlock: adminProcedure
    .input(z.object({
      page: z.string().min(1).max(64),
      blockKey: z.string().min(1).max(128),
      label: z.string().min(1).max(255),
      contentType: z.enum(["text", "richtext", "image", "json"]).default("text"),
      content: z.string().max(50000).nullable().optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
      section: z.string().max(128).nullable().optional(),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      visible: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const existing = await db
        .select()
        .from(cmsBlocks)
        .where(
          and(
            eq(cmsBlocks.page, input.page),
            eq(cmsBlocks.blockKey, input.blockKey),
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const prev = existing[0];
        await db
          .update(cmsBlocks)
          .set({
            label: input.label,
            contentType: input.contentType,
            content: input.content ?? null,
            imageUrl: input.imageUrl ?? null,
            section: input.section ?? null,
            sortOrder: input.sortOrder,
            visible: input.visible,
          })
          .where(eq(cmsBlocks.id, prev.id));

        await recordHistory(db, {
          blockId: prev.id,
          page: prev.page,
          blockKey: prev.blockKey,
          action: "upsert_update",
          prevContent: prev.content,
          prevImageUrl: prev.imageUrl,
          prevVisible: prev.visible,
          newContent: input.content ?? null,
          newImageUrl: input.imageUrl ?? null,
          newVisible: input.visible,
          changedByOpenId: ctx.user!.openId,
          changedByName: ctx.user!.name ?? null,
        });

        return { id: prev.id, action: "updated" as const };
      }

      const result = await db.insert(cmsBlocks).values({
        page: input.page,
        blockKey: input.blockKey,
        label: input.label,
        contentType: input.contentType,
        content: input.content ?? null,
        imageUrl: input.imageUrl ?? null,
        section: input.section ?? null,
        sortOrder: input.sortOrder,
        visible: input.visible,
      });
      return { id: Number(result[0].insertId), action: "created" as const };
    }),

  /**
   * Update only the content of an existing block (quick inline edit).
   * Records history before applying changes.
   */
  updateContent: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      content: z.string().max(50000).nullable().optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const updates: Record<string, unknown> = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      // Fetch current state before update
      const prev = await fetchBlock(db, input.id);
      if (prev) {
        await recordHistory(db, {
          blockId: prev.id,
          page: prev.page,
          blockKey: prev.blockKey,
          action: "update_content",
          prevContent: prev.content,
          prevImageUrl: prev.imageUrl,
          prevVisible: prev.visible,
          newContent: input.content !== undefined ? (input.content ?? null) : prev.content,
          newImageUrl: input.imageUrl !== undefined ? (input.imageUrl ?? null) : prev.imageUrl,
          newVisible: prev.visible,
          changedByOpenId: ctx.user!.openId,
          changedByName: ctx.user!.name ?? null,
        });
      }

      await db.update(cmsBlocks).set(updates).where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Toggle block visibility.
   * Records history before applying changes.
   */
  toggleVisibility: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      visible: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const prev = await fetchBlock(db, input.id);
      if (prev) {
        await recordHistory(db, {
          blockId: prev.id,
          page: prev.page,
          blockKey: prev.blockKey,
          action: "toggle_visibility",
          prevContent: prev.content,
          prevImageUrl: prev.imageUrl,
          prevVisible: prev.visible,
          newContent: prev.content,
          newImageUrl: prev.imageUrl,
          newVisible: input.visible,
          changedByOpenId: ctx.user!.openId,
          changedByName: ctx.user!.name ?? null,
        });
      }

      await db
        .update(cmsBlocks)
        .set({ visible: input.visible })
        .where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a content block.
   * Records history before deletion.
   */
  deleteBlock: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const prev = await fetchBlock(db, input.id);
      if (prev) {
        await recordHistory(db, {
          blockId: prev.id,
          page: prev.page,
          blockKey: prev.blockKey,
          action: "delete",
          prevContent: prev.content,
          prevImageUrl: prev.imageUrl,
          prevVisible: prev.visible,
          newContent: null,
          newImageUrl: null,
          newVisible: null,
          changedByOpenId: ctx.user!.openId,
          changedByName: ctx.user!.name ?? null,
        });
      }

      await db.delete(cmsBlocks).where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Upload an image for a CMS block and update the block's imageUrl.
   * Records history before applying changes.
   */
  uploadImage: adminProcedure
    .input(z.object({
      blockId: z.number().int().positive(),
      fileName: z.string().min(1).max(180),
      mimeType: z.string().min(1).max(120),
      base64Data: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const buffer = Buffer.from(input.base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `cms/${input.blockId}-${suffix}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Fetch current state before update
      const prev = await fetchBlock(db, input.blockId);
      if (prev) {
        await recordHistory(db, {
          blockId: prev.id,
          page: prev.page,
          blockKey: prev.blockKey,
          action: "upload_image",
          prevContent: prev.content,
          prevImageUrl: prev.imageUrl,
          prevVisible: prev.visible,
          newContent: prev.content,
          newImageUrl: url,
          newVisible: prev.visible,
          changedByOpenId: ctx.user!.openId,
          changedByName: ctx.user!.name ?? null,
        });
      }

      await db
        .update(cmsBlocks)
        .set({ imageUrl: url })
        .where(eq(cmsBlocks.id, input.blockId));

      return { url };
    }),

  /**
   * Get change history for a specific block.
   * Returns entries ordered by most recent first.
   */
  getBlockHistory: adminProcedure
    .input(z.object({
      blockId: z.number().int().positive(),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      return db
        .select()
        .from(cmsBlockHistory)
        .where(eq(cmsBlockHistory.blockId, input.blockId))
        .orderBy(desc(cmsBlockHistory.changedAt))
        .limit(input.limit);
    }),

  /**
   * Rollback a block to a specific history entry.
   * Restores the previous content, imageUrl, and visibility from the history record.
   * Also records the rollback itself as a new history entry.
   */
  rollbackBlock: adminProcedure
    .input(z.object({
      historyId: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Fetch the history entry to rollback to
      const historyRows = await db
        .select()
        .from(cmsBlockHistory)
        .where(eq(cmsBlockHistory.id, input.historyId))
        .limit(1);

      if (historyRows.length === 0) {
        throw new Error("История не найдена");
      }

      const historyEntry = historyRows[0];

      // Fetch current block state
      const currentBlock = await fetchBlock(db, historyEntry.blockId);
      if (!currentBlock) {
        throw new Error("Блок не найден");
      }

      // Record the rollback as a history entry (before applying)
      await recordHistory(db, {
        blockId: currentBlock.id,
        page: currentBlock.page,
        blockKey: currentBlock.blockKey,
        action: "rollback",
        prevContent: currentBlock.content,
        prevImageUrl: currentBlock.imageUrl,
        prevVisible: currentBlock.visible,
        newContent: historyEntry.prevContent,
        newImageUrl: historyEntry.prevImageUrl,
        newVisible: historyEntry.prevVisible,
        changedByOpenId: ctx.user!.openId,
        changedByName: ctx.user!.name ?? null,
      });

      // Apply the rollback — restore the previous state from the history entry
      await db
        .update(cmsBlocks)
        .set({
          content: historyEntry.prevContent,
          imageUrl: historyEntry.prevImageUrl,
          visible: historyEntry.prevVisible ?? true,
        })
        .where(eq(cmsBlocks.id, historyEntry.blockId));

      return {
        success: true,
        restoredFrom: {
          action: historyEntry.action,
          changedAt: historyEntry.changedAt,
        },
      };
    }),

  /**
   * Clear old history entries (admin cleanup).
   * Deletes entries older than the specified number of days.
   */
  clearOldHistory: adminProcedure
    .input(z.object({
      olderThanDays: z.number().int().min(1).max(365).default(30),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.olderThanDays);

      await db.delete(cmsBlockHistory)
        .where(lt(cmsBlockHistory.changedAt, cutoff));

      return { success: true };
    }),

  /**
   * Export history as CSV for external audit.
   * Optionally filter by blockId. Returns CSV string.
   */
  exportHistoryCsv: adminProcedure
    .input(z.object({
      blockId: z.number().int().positive().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input?.blockId) {
        conditions.push(eq(cmsBlockHistory.blockId, input.blockId));
      }

      const rows = conditions.length > 0
        ? await db.select().from(cmsBlockHistory)
            .where(and(...conditions))
            .orderBy(desc(cmsBlockHistory.changedAt))
        : await db.select().from(cmsBlockHistory)
            .orderBy(desc(cmsBlockHistory.changedAt));

      // Build CSV
      const headers = [
        "ID",
        "Block ID",
        "Page",
        "Block Key",
        "Action",
        "Previous Content",
        "New Content",
        "Previous Image URL",
        "New Image URL",
        "Previous Visible",
        "New Visible",
        "Changed By (OpenID)",
        "Changed By (Name)",
        "Changed At",
      ];

      const escapeCsv = (val: string | number | boolean | null | undefined): string => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const csvRows = [headers.join(",")];
      for (const row of rows) {
        csvRows.push([
          escapeCsv(row.id),
          escapeCsv(row.blockId),
          escapeCsv(row.page),
          escapeCsv(row.blockKey),
          escapeCsv(row.action),
          escapeCsv(row.prevContent),
          escapeCsv(row.newContent),
          escapeCsv(row.prevImageUrl),
          escapeCsv(row.newImageUrl),
          escapeCsv(row.prevVisible),
          escapeCsv(row.newVisible),
          escapeCsv(row.changedByOpenId),
          escapeCsv(row.changedByName),
          escapeCsv(row.changedAt ? new Date(row.changedAt).toISOString() : null),
        ].join(","));
      }

      return {
        csv: csvRows.join("\n"),
        rowCount: rows.length,
      };
    }),

  /**
   * Reorder blocks within a page by updating their sortOrder.
   * Accepts an array of { id, sortOrder } pairs.
   */
  reorderBlocks: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0),
      })).min(1).max(200),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      for (const item of input.items) {
        await db
          .update(cmsBlocks)
          .set({ sortOrder: item.sortOrder })
          .where(eq(cmsBlocks.id, item.id));
      }
      return { success: true, updated: input.items.length };
    }),

  /**
   * Seed default blocks for a page.
   * Uses per-block upsert: creates only missing blocks, skips existing ones.
   */
  seedDefaults: adminProcedure
    .input(z.object({ page: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      const defaults = getDefaultBlocks(input.page);
      if (defaults.length === 0) {
        return { seeded: false, message: "No default blocks defined for this page" };
      }

      const existing = await db
        .select({ blockKey: cmsBlocks.blockKey })
        .from(cmsBlocks)
        .where(eq(cmsBlocks.page, input.page));

      const existingKeys = new Set(existing.map((e: { blockKey: string }) => e.blockKey));

      let created = 0;
      const errors: string[] = [];

      for (const block of defaults) {
        if (existingKeys.has(block.blockKey)) {
          continue;
        }

        try {
          await db.insert(cmsBlocks).values({
            page: block.page,
            blockKey: block.blockKey,
            label: block.label,
            contentType: block.contentType,
            content: block.content ?? "",
            imageUrl: block.imageUrl ?? null,
            section: block.section ?? null,
            sortOrder: block.sortOrder,
            visible: block.visible,
          });
          created++;
        } catch (err) {
          const msg = `Failed to create block "${block.blockKey}": ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[CMS Seed] ${msg}`);
          errors.push(msg);
        }
      }

      if (created === 0 && errors.length === 0) {
        return { seeded: false, message: "All blocks already exist for this page" };
      }

      return {
        seeded: created > 0,
        count: created,
        skipped: defaults.length - created - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),

  /**
   * Get recent changes across all pages (admin — for activity feed).
   * Returns the latest N history entries with block labels.
   */
  recentChanges: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(30),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const limit = input?.limit ?? 30;

      const history = await db
        .select()
        .from(cmsBlockHistory)
        .orderBy(desc(cmsBlockHistory.changedAt))
        .limit(limit);

      // Enrich with block labels from cmsBlocks
      const blockIds = Array.from(new Set(history.map((h: { blockId: number }) => h.blockId)));
      let blockLabelMap: Record<number, string> = {};
      if (blockIds.length > 0) {
        const blocks = await db
          .select({ id: cmsBlocks.id, label: cmsBlocks.label, section: cmsBlocks.section })
          .from(cmsBlocks);
        for (const b of blocks) {
          blockLabelMap[b.id] = b.label ?? b.id.toString();
        }
      }

      return history.map((h: any) => ({
        ...h,
        blockLabel: blockLabelMap[h.blockId] ?? h.blockKey,
      }));
    }),
});

/**
 * Default content blocks for each page.
 */
const partnersDefaults: DefaultBlock[] = [
  { page: "partners", blockKey: "hero_badge", label: "Hero — Бейдж", contentType: "text", content: "B2B и партнёрства", section: "Hero", sortOrder: 1, visible: true },
  { page: "partners", blockKey: "hero_heading", label: "Hero — Заголовок", contentType: "richtext", content: "Партнёрская программа Шерь Козу", section: "Hero", sortOrder: 2, visible: true },
  { page: "partners", blockKey: "hero_subtitle", label: "Hero — Описание", contentType: "richtext", content: "Рестораны, магазины, отели и корпоративные клиенты — мы создаём уникальные продуктовые решения на основе элитных пород с прозрачной историей происхождения. Оставьте заявку — менеджер свяжется с вами в течение одного рабочего дня.", section: "Hero", sortOrder: 3, visible: true },
  { page: "partners", blockKey: "sidebar_badge", label: "Sidebar — Бейдж", contentType: "text", content: "Партнёрский вход", section: "Форма", sortOrder: 10, visible: true },
  { page: "partners", blockKey: "sidebar_heading", label: "Sidebar — Заголовок", contentType: "text", content: "Коммерческий запрос", section: "Форма", sortOrder: 11, visible: true },
  { page: "partners", blockKey: "sidebar_description", label: "Sidebar — Описание", contentType: "richtext", content: "Если вам нужен опт, ресторанный формат или коллаборация, оставьте короткую заявку. Мы ответим в течение одного рабочего дня.", section: "Форма", sortOrder: 12, visible: true },
  { page: "partners", blockKey: "form_heading", label: "Форма — Заголовок", contentType: "text", content: "Партнёрская заявка", section: "Форма", sortOrder: 13, visible: true },
  { page: "partners", blockKey: "form_description", label: "Форма — Описание", contentType: "text", content: "Заполните форму, и мы свяжемся с вами для обсуждения деталей сотрудничества.", section: "Форма", sortOrder: 14, visible: true },
];

const pricingDefaults: DefaultBlock[] = [
  // Section 1 — Hero
  { page: "pricing", blockKey: "hero_title", label: "Hero — Заголовок", contentType: "richtext", content: "Два простых шага\nк вашему животному", section: "Hero", sortOrder: 1, visible: true },
  { page: "pricing", blockKey: "hero_subtitle", label: "Hero — Описание", contentType: "richtext", content: "Разовый платёж за право владения + ежемесячный взнос за содержание и привилегии. Никаких скрытых комиссий.", section: "Hero", sortOrder: 2, visible: true },
  { page: "pricing", blockKey: "hero_cta_primary", label: "Hero — CTA основная", contentType: "text", content: "Рассчитать мою выгоду", section: "Hero", sortOrder: 3, visible: true },
  { page: "pricing", blockKey: "hero_cta_secondary", label: "Hero — CTA вторичная", contentType: "text", content: "Сравнить тарифы", section: "Hero", sortOrder: 4, visible: true },
  { page: "pricing", blockKey: "hero_overview", label: "Hero — Быстрый обзор", contentType: "json", content: JSON.stringify([
    { label: "Доля владения", value: "50% или 100%" },
    { label: "Разовый платёж", value: "от 47 500 ₽" },
    { label: "Ежемесячный взнос", value: "от 7 500 ₽/мес" },
    { label: "Продукция", value: "Именная, от вашего животного" },
  ]), section: "Hero", sortOrder: 5, visible: true },

  // Section 2 — How Pricing Works
  { page: "pricing", blockKey: "model_heading", label: "Модель — Заголовок", contentType: "text", content: "Как устроена стоимость", section: "Модель ценообразования", sortOrder: 10, visible: true },
  { page: "pricing", blockKey: "model_subtitle", label: "Модель — Подзаголовок", contentType: "text", content: "Двухкомпонентная модель — прозрачная и понятная", section: "Модель ценообразования", sortOrder: 11, visible: true },
  { page: "pricing", blockKey: "model_onetime_title", label: "Разовый — Заголовок", contentType: "text", content: "Разовый платёж", section: "Модель ценообразования", sortOrder: 12, visible: true },
  { page: "pricing", blockKey: "model_onetime_text", label: "Разовый — Описание", contentType: "richtext", content: "Вы выбираете животное и долю: 50% или 100%. Разовый платёж закрепляет за вами право владения, именной сертификат и доступ ко всей экосистеме.", section: "Модель ценообразования", sortOrder: 13, visible: true },
  { page: "pricing", blockKey: "model_onetime_example", label: "Разовый — Пример", contentType: "text", content: "Коза альпийской породы: 47 500 ₽ (50%) или 95 000 ₽ (100%)", section: "Модель ценообразования", sortOrder: 14, visible: true },
  { page: "pricing", blockKey: "model_onetime_bonus", label: "Разовый — Бонус", contentType: "text", content: "Продление через год — со скидкой 20%", section: "Модель ценообразования", sortOrder: 15, visible: true },
  { page: "pricing", blockKey: "model_monthly_title", label: "Ежемесячный — Заголовок", contentType: "text", content: "Ежемесячный взнос", section: "Модель ценообразования", sortOrder: 16, visible: true },
  { page: "pricing", blockKey: "model_monthly_text", label: "Ежемесячный — Описание", contentType: "richtext", content: "Покрывает корм, ветеринарию, переработку молока по вашему плану и доставку. Чем выше тариф — тем больше привилегий.", section: "Модель ценообразования", sortOrder: 17, visible: true },
  { page: "pricing", blockKey: "model_monthly_example", label: "Ежемесячный — Пример", contentType: "text", content: "от 7 500 ₽/мес (50% доли) или от 14 900 ₽/мес (100%)", section: "Модель ценообразования", sortOrder: 18, visible: true },
  { page: "pricing", blockKey: "model_monthly_bonus", label: "Ежемесячный — Бонус", contentType: "text", content: "Годовая подписка — скидка 15%", section: "Модель ценообразования", sortOrder: 19, visible: true },

  // Section 3 — Steps
  { page: "pricing", blockKey: "steps", label: "Шаги — Список", contentType: "json", content: JSON.stringify([
    { num: "1", label: "Выберите животное", sub: "в каталоге" },
    { num: "2", label: "Выберите долю", sub: "50% или 100%" },
    { num: "3", label: "Оплатите право", sub: "Разовый платёж" },
    { num: "4", label: "Настройте план", sub: "продуктовый" },
    { num: "5", label: "Получайте продукцию", sub: "Ежемесячный взнос" },
    { num: "6", label: "Продлите", sub: "со скидкой 20%" },
  ]), section: "Шаги", sortOrder: 20, visible: true },

  // Section 4 — Three Rights
  { page: "pricing", blockKey: "rights_heading", label: "Права — Заголовок", contentType: "text", content: "Три права владельца", section: "Права владельца", sortOrder: 30, visible: true },
  { page: "pricing", blockKey: "rights_subtitle", label: "Права — Подзаголовок", contentType: "text", content: "Вы не просто покупаете продукты — вы управляете своим фермерским хозяйством", section: "Права владельца", sortOrder: 31, visible: true },
  { page: "pricing", blockKey: "rights_items", label: "Права — Список", contentType: "json", content: JSON.stringify([
    { title: "Выбор продуктового плана", text: "Молоко, творог, кефир, сыры — вы сами распределяете баланс молока между продуктами. Меняйте план от раза в квартал до раза в неделю." },
    { title: "Управление балансом молока", text: "Персональный баланс обновляется после каждого надоя. Перенесите до 30% остатка или направьте молоко в созревание сыров." },
    { title: "Себе или в подарок", text: "Каждую партию можно доставить себе или отправить подарком с именной открыткой и историей вашего животного. Подписка до 12 мес." },
  ]), section: "Права владельца", sortOrder: 32, visible: true },

  // Section 5 — Tier Overview
  { page: "pricing", blockKey: "tiers_heading", label: "Тарифы — Заголовок", contentType: "text", content: "Обзор тарифов", section: "Обзор тарифов", sortOrder: 40, visible: true },
  { page: "pricing", blockKey: "tiers_subtitle", label: "Тарифы — Подзаголовок", contentType: "text", content: "Выберите уровень участия, который подходит именно вам", section: "Обзор тарифов", sortOrder: 41, visible: true },

  // Section 6 — Calculator CTA
  { page: "pricing", blockKey: "calc_heading", label: "Калькулятор — Заголовок", contentType: "text", content: "Рассчитайте свою выгоду", section: "Калькулятор CTA", sortOrder: 50, visible: true },
  { page: "pricing", blockKey: "calc_subtitle", label: "Калькулятор — Описание", contentType: "richtext", content: "Наш калькулятор покажет реальную стоимость продукции от вашего животного и сравнит её с ценами на премиальных московских рынках.", section: "Калькулятор CTA", sortOrder: 51, visible: true },
  { page: "pricing", blockKey: "calc_cta", label: "Калькулятор — Кнопка", contentType: "text", content: "Открыть калькулятор", section: "Калькулятор CTA", sortOrder: 52, visible: true },
  { page: "pricing", blockKey: "calc_example", label: "Калькулятор — Пример расчёта", contentType: "json", content: JSON.stringify([
    { label: "Стоимость участия", value: "258 000 ₽/год" },
    { label: "Рыночная стоимость", value: "349 000 ₽" },
    { label: "Привилегии", value: "222 000 ₽" },
  ]), section: "Калькулятор CTA", sortOrder: 53, visible: true },
  { page: "pricing", blockKey: "calc_result", label: "Калькулятор — Результат", contentType: "text", content: "Выгода: 313 000 ₽ (55%)", section: "Калькулятор CTA", sortOrder: 54, visible: true },

  // Section 7 — FAQ
  { page: "pricing", blockKey: "faq_heading", label: "FAQ — Заголовок", contentType: "text", content: "Частые вопросы о ценах", section: "FAQ", sortOrder: 60, visible: true },
  { page: "pricing", blockKey: "faq_items", label: "FAQ — Вопросы и ответы", contentType: "json", content: JSON.stringify([
    { q: "Что входит в разовый платёж?", a: "Право владения долей (50% или 100%) на 1 год, именной сертификат, доступ к экосистеме — личный кабинет, трекер, клуб и все привилегии тарифа." },
    { q: "Что покрывает ежемесячный взнос?", a: "Содержание животного (корм, ветеринария, уход), переработку молока по вашему продуктовому плану, логистику доставки и доступ к привилегиям вашего тарифного уровня." },
    { q: "Можно ли менять продуктовый план?", a: "Да. Частота зависит от тарифа: Базовый — раз в квартал, Стандартный — раз в месяц, Профессиональный — раз в неделю. Изменения вступают в силу со следующего производственного цикла." },
    { q: "Что такое баланс молока?", a: "Это реальное количество молока от вашего животного, пропорциональное доле владения. Баланс обновляется после каждого надоя и отображается в реальном времени. Весь баланс за месяц должен быть направлен на переработку — перенос на следующий месяц не предусмотрен." },
    { q: "Можно ли отправить продукцию в подарок?", a: "Да, на всех платных тарифах. Каждую партию можно отправить другому человеку с именной открыткой и историей животного. На Стандартном и Профессиональном тарифах доступна подарочная подписка." },
    { q: "Что будет через год?", a: "Вы можете продлить владение со скидкой 20% от первоначальной стоимости. Если не продлеваете, доля возвращается в каталог. Ваш дневник и достижения сохраняются." },
    { q: "Можно ли увеличить долю с 50% до 100%?", a: "Да, при наличии свободной доли. Вы доплачиваете разницу в разовом платеже и переходите на Стандартный тариф с расширенными привилегиями." },
  ]), section: "FAQ", sortOrder: 61, visible: true },
];

const clubDefaults: DefaultBlock[] = [
  // Section 1 — Hero
  { page: "club", blockKey: "hero_badge", label: "Hero — Бейдж", contentType: "text", content: "Закрытый клуб владельцев", section: "Hero", sortOrder: 1, visible: true },
  { page: "club", blockKey: "hero_title", label: "Hero — Заголовок", contentType: "richtext", content: "Клуб Шерь Козу — сообщество семей, которые знают своих животных по имени.", section: "Hero", sortOrder: 2, visible: true },
  { page: "club", blockKey: "hero_image", label: "Hero — Фото", contentType: "image", content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp", section: "Hero", sortOrder: 3, visible: true },
  { page: "club", blockKey: "hero_description_guest", label: "Hero — Описание (гость)", contentType: "richtext", content: "Дневник фермы, семейные визиты, мастер-классы и живые истории участников — место, где ферма становится частью вашей жизни.", section: "Hero", sortOrder: 4, visible: true },
  { page: "club", blockKey: "hero_location_guest", label: "Hero — Локация (гость)", contentType: "text", content: "Семейная ферма + digital community", section: "Hero", sortOrder: 5, visible: true },

  // Section 2 — Calendar sidebar
  { page: "club", blockKey: "calendar_label", label: "Календарь — Метка", contentType: "text", content: "Календарь клуба", section: "Календарь", sortOrder: 10, visible: true },
  { page: "club", blockKey: "calendar_heading", label: "Календарь — Заголовок", contentType: "text", content: "Ближайшие события клуба", section: "Календарь", sortOrder: 11, visible: true },
  { page: "club", blockKey: "calendar_empty", label: "Календарь — Пусто", contentType: "text", content: "Ближайшие события появятся здесь после публикации новой клубной программы.", section: "Календарь", sortOrder: 12, visible: true },
  { page: "club", blockKey: "calendar_cta", label: "Календарь — Кнопка", contentType: "text", content: "Записаться", section: "Календарь", sortOrder: 13, visible: true },

  // Section 3 — Ritual
  { page: "club", blockKey: "ritual_label", label: "Ритуал — Метка", contentType: "text", content: "Персональный ритуал", section: "Ритуал", sortOrder: 20, visible: true },

  // Section 4 — Members
  { page: "club", blockKey: "members_label", label: "Участники — Метка", contentType: "text", content: "Участники", section: "Участники", sortOrder: 30, visible: true },
  { page: "club", blockKey: "members_heading", label: "Участники — Заголовок", contentType: "text", content: "Кто уже внутри клуба", section: "Участники", sortOrder: 31, visible: true },
  { page: "club", blockKey: "members_empty", label: "Участники — Пусто", contentType: "text", content: "Состав клуба появится здесь после добавления первых участников.", section: "Участники", sortOrder: 32, visible: true },

  // Section 5 — Routes
  { page: "club", blockKey: "routes_label", label: "Маршруты — Метка", contentType: "text", content: "Маршруты сообщества", section: "Маршруты", sortOrder: 40, visible: true },
  { page: "club", blockKey: "routes_heading", label: "Маршруты — Заголовок", contentType: "text", content: "Животное, продукт и семья — всё связано.", section: "Маршруты", sortOrder: 41, visible: true },
  { page: "club", blockKey: "routes_description_guest", label: "Маршруты — Описание (гость)", contentType: "richtext", content: "События, сообщество и ощущение принадлежности к жизни фермы.", section: "Маршруты", sortOrder: 42, visible: true },
  { page: "club", blockKey: "routes_howto_label", label: "Маршруты — Как присоединиться (метка)", contentType: "text", content: "Как присоединиться", section: "Маршруты", sortOrder: 43, visible: true },
  { page: "club", blockKey: "routes_howto_title", label: "Маршруты — Как присоединиться (заголовок)", contentType: "text", content: "Клуб → Профиль животного → Выбор доли → Вход", section: "Маршруты", sortOrder: 44, visible: true },
  { page: "club", blockKey: "routes_howto_description", label: "Маршруты — Как присоединиться (описание)", contentType: "richtext", content: "Клуб можно изучать и без аккаунта. Следующий шаг — откройте профиль животного, выберите формат участия и войдите в аккаунт, чтобы клуб стал персональным.", section: "Маршруты", sortOrder: 45, visible: true },
  { page: "club", blockKey: "routes_links", label: "Маршруты — Ссылки", contentType: "json", content: JSON.stringify([
    { key: "profile", title: "К профилю {animal}", subtitle: "Дневник, история и галерея вашего животного" },
    { key: "tracker", title: "К трекеру продуктов", subtitle: "Состав молока, доставки и путь продукта" },
    { key: "dashboard", title: "В кабинет", subtitle: "Ваше участие, следующие шаги и быстрые действия" },
  ]), section: "Маршруты", sortOrder: 46, visible: true },

  // Section 6 — Notifications
  { page: "club", blockKey: "notif_label", label: "Уведомления — Метка", contentType: "text", content: "Уведомления клуба", section: "Уведомления", sortOrder: 50, visible: true },
  { page: "club", blockKey: "notif_heading", label: "Уведомления — Заголовок", contentType: "text", content: "Уведомления клуба", section: "Уведомления", sortOrder: 51, visible: true },
  { page: "club", blockKey: "notif_hint", label: "Уведомления — Подсказка", contentType: "text", content: "Уведомления помогают не пропустить важное.", section: "Уведомления", sortOrder: 52, visible: true },
  { page: "club", blockKey: "notif_family_image", label: "Уведомления — Фото", contentType: "image", content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp", section: "Уведомления", sortOrder: 53, visible: true },

  // Section 7 — Loading/Error/Empty states
  { page: "club", blockKey: "loading_text", label: "Загрузка — Текст", contentType: "text", content: "Загружаем живую клубную ленту фермы…", section: "Состояния", sortOrder: 60, visible: true },
  { page: "club", blockKey: "error_title", label: "Ошибка — Заголовок", contentType: "text", content: "Не удалось загрузить клубную ленту", section: "Состояния", sortOrder: 61, visible: true },
  { page: "club", blockKey: "error_description", label: "Ошибка — Описание", contentType: "text", content: "Произошла ошибка при загрузке постов, событий и участников. Попробуйте обновить страницу.", section: "Состояния", sortOrder: 62, visible: true },
  { page: "club", blockKey: "empty_title", label: "Пусто — Заголовок", contentType: "text", content: "Клубная лента пока пуста", section: "Состояния", sortOrder: 63, visible: true },
  { page: "club", blockKey: "empty_description", label: "Пусто — Описание", contentType: "text", content: "После первого события или дневниковой записи здесь появится живая история вашей фермы.", section: "Состояния", sortOrder: 64, visible: true },
];

const trackerDefaults: DefaultBlock[] = [
  // Section 1 — Demo banner
  { page: "tracker", blockKey: "demo_banner_title", label: "Демо-баннер — Заголовок", contentType: "text", content: "Это демо-версия трекера", section: "Демо-баннер", sortOrder: 1, visible: true },
  { page: "tracker", blockKey: "demo_banner_description", label: "Демо-баннер — Описание", contentType: "richtext", content: "Вы видите пример того, как выглядит трекер продукции для владельца животного. Все данные ниже — демонстрационные.", section: "Демо-баннер", sortOrder: 2, visible: true },
  { page: "tracker", blockKey: "demo_banner_cta", label: "Демо-баннер — Кнопка каталог", contentType: "text", content: "Выбрать животное", section: "Демо-баннер", sortOrder: 3, visible: true },
  { page: "tracker", blockKey: "demo_banner_login", label: "Демо-баннер — Кнопка вход", contentType: "text", content: "Войти в аккаунт", section: "Демо-баннер", sortOrder: 4, visible: true },

  // Section 2 — Hero
  { page: "tracker", blockKey: "hero_label", label: "Hero — Метка", contentType: "text", content: "Трекер продукта", section: "Hero", sortOrder: 10, visible: true },
  { page: "tracker", blockKey: "hero_description", label: "Hero — Описание", contentType: "richtext", content: "Происхождение молока, состав партии, статус доставки и связь с вашим животным — всё в одном месте.", section: "Hero", sortOrder: 11, visible: true },

  // Section 3 — Composition
  { page: "tracker", blockKey: "composition_label", label: "Состав — Метка", contentType: "text", content: "Состав партии", section: "Состав", sortOrder: 20, visible: true },
  { page: "tracker", blockKey: "composition_heading", label: "Состав — Заголовок", contentType: "text", content: "Состав молока от Мира", section: "Состав", sortOrder: 21, visible: true },
  { page: "tracker", blockKey: "composition_description", label: "Состав — Описание", contentType: "richtext", content: "Качество партии видно прямо здесь — никаких абстрактных обещаний. Данные привязаны к вашему животному и вашей доле участия.", section: "Состав", sortOrder: 22, visible: true },
  { page: "tracker", blockKey: "composition_note", label: "Состав — Примечание", contentType: "richtext", content: "Как владелец, вы увидите здесь реальные данные анализа молока именно от вашего животного — с датами и сертификатами.", section: "Состав", sortOrder: 23, visible: true },

  // Section 4 — Chart (yield dynamics)
  { page: "tracker", blockKey: "chart_label", label: "Надои — Метка", contentType: "text", content: "Динамика надоев", section: "Надои", sortOrder: 30, visible: true },
  { page: "tracker", blockKey: "chart_heading", label: "Надои — Заголовок", contentType: "text", content: "Сезонный ритм животного", section: "Надои", sortOrder: 31, visible: true },
  { page: "tracker", blockKey: "chart_description", label: "Надои — Описание", contentType: "richtext", content: "График показывает сезонность и связь между жизнью животного и объёмом продукта.", section: "Надои", sortOrder: 32, visible: true },

  // Section 5 — Origin (product journey)
  { page: "tracker", blockKey: "origin_label", label: "Путь — Метка", contentType: "text", content: "Путь продукта", section: "Путь продукта", sortOrder: 40, visible: true },
  { page: "tracker", blockKey: "origin_heading", label: "Путь — Заголовок", contentType: "text", content: "От жизни животного до семейной коробки", section: "Путь продукта", sortOrder: 41, visible: true },

  // Section 6 — Delivery
  { page: "tracker", blockKey: "delivery_label", label: "Доставки — Метка", contentType: "text", content: "История доставок", section: "Доставки", sortOrder: 50, visible: true },
  { page: "tracker", blockKey: "delivery_heading", label: "Доставки — Заголовок", contentType: "text", content: "Каждая доставка — часть истории, а не просто заказ.", section: "Доставки", sortOrder: 51, visible: true },
  { page: "tracker", blockKey: "delivery_image", label: "Доставки — Фото", contentType: "image", content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp", section: "Доставки", sortOrder: 52, visible: true },

  // Section 7 — Named product
  { page: "tracker", blockKey: "named_product_label", label: "Именной продукт — Метка", contentType: "text", content: "Именной продукт", section: "Именной продукт", sortOrder: 60, visible: true },
  { page: "tracker", blockKey: "named_product_heading", label: "Именной продукт — Заголовок", contentType: "text", content: "Именной продукт завершает цикл от фермы до стола.", section: "Именной продукт", sortOrder: 61, visible: true },
  { page: "tracker", blockKey: "named_product_description", label: "Именной продукт — Описание", contentType: "richtext", content: "Не безликий сыр, а именной продукт — результат вашей связи с животным и заботы фермы.", section: "Именной продукт", sortOrder: 62, visible: true },
  { page: "tracker", blockKey: "named_product_image", label: "Именной продукт — Фото", contentType: "image", content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp", section: "Именной продукт", sortOrder: 63, visible: true },

  // Section 8 — CTA
  { page: "tracker", blockKey: "cta_label", label: "CTA — Метка", contentType: "text", content: "Как это работает", section: "CTA", sortOrder: 70, visible: true },
  { page: "tracker", blockKey: "cta_heading", label: "CTA — Заголовок", contentType: "text", content: "Станьте владельцем — получите свой трекер.", section: "CTA", sortOrder: 71, visible: true },
  { page: "tracker", blockKey: "cta_description", label: "CTA — Описание", contentType: "richtext", content: "Когда вы выберете животное и оформите участие, этот трекер заполнится реальными данными: состав молока, динамика надоев, история доставок и именные продукты — всё от вашего конкретного животного.", section: "CTA", sortOrder: 72, visible: true },
  { page: "tracker", blockKey: "cta_path_label", label: "CTA — Путь (метка)", contentType: "text", content: "Ваш путь", section: "CTA", sortOrder: 73, visible: true },
  { page: "tracker", blockKey: "cta_path_title", label: "CTA — Путь (заголовок)", contentType: "text", content: "Каталог → Выбор животного → Оформление → Личный трекер", section: "CTA", sortOrder: 74, visible: true },
  { page: "tracker", blockKey: "cta_path_description", label: "CTA — Путь (описание)", contentType: "richtext", content: "Выберите козу или овцу в каталоге, оформите участие и получите доступ к персональному трекеру с реальными данными.", section: "CTA", sortOrder: 75, visible: true },

  // Section 9 — Status
  { page: "tracker", blockKey: "status_label", label: "Статус — Метка", contentType: "text", content: "Текущий статус маршрута", section: "Статус", sortOrder: 80, visible: true },
  { page: "tracker", blockKey: "status_heading", label: "Статус — Заголовок", contentType: "text", content: "Текущая доставка — часть вашей истории с животным.", section: "Статус", sortOrder: 81, visible: true },
  { page: "tracker", blockKey: "status_description", label: "Статус — Описание", contentType: "richtext", content: "Вы всегда знаете, какая именно доставка сейчас в пути, что в ней и откуда она.", section: "Статус", sortOrder: 82, visible: true },
];

const calculatorDefaults: DefaultBlock[] = [
  // Section 1 — Page header
  { page: "calculator", blockKey: "page_title", label: "Заголовок страницы", contentType: "text", content: "Калькулятор выгоды", section: "Заголовок", sortOrder: 1, visible: true },
  { page: "calculator", blockKey: "page_subtitle", label: "Подзаголовок страницы", contentType: "text", content: "Настройте параметры и увидите реальную экономию по сравнению с покупкой на рынке", section: "Заголовок", sortOrder: 2, visible: true },

  // Section 2 — Form labels
  { page: "calculator", blockKey: "config_heading", label: "Конфигурация — Заголовок", contentType: "text", content: "Настройте параметры", section: "Форма", sortOrder: 10, visible: true },
  { page: "calculator", blockKey: "breed_label", label: "Порода — Метка", contentType: "text", content: "Порода животного", section: "Форма", sortOrder: 11, visible: true },
  { page: "calculator", blockKey: "share_label", label: "Доля — Метка", contentType: "text", content: "Доля владения", section: "Форма", sortOrder: 12, visible: true },
  { page: "calculator", blockKey: "alloc_label", label: "Распределение — Метка", contentType: "text", content: "Распределение баланса молока", section: "Форма", sortOrder: 13, visible: true },
  { page: "calculator", blockKey: "alloc_hint", label: "Распределение — Подсказка", contentType: "text", content: "Перемещайте слайдеры, чтобы распределить молоко между продуктами", section: "Форма", sortOrder: 14, visible: true },
  { page: "calculator", blockKey: "payment_label", label: "Оплата — Метка", contentType: "text", content: "Период оплаты", section: "Форма", sortOrder: 15, visible: true },
  { page: "calculator", blockKey: "products_label", label: "Продукты — Метка", contentType: "text", content: "Что вы получите за год", section: "Форма", sortOrder: 16, visible: true },

  // Section 3 — Result labels
  { page: "calculator", blockKey: "savings_title", label: "Выгода — Заголовок", contentType: "text", content: "Ваша выгода за год", section: "Результат", sortOrder: 20, visible: true },
  { page: "calculator", blockKey: "costs_title", label: "Расходы — Заголовок", contentType: "text", content: "Сводка расходов (год)", section: "Результат", sortOrder: 21, visible: true },
  { page: "calculator", blockKey: "value_title", label: "Ценность — Заголовок", contentType: "text", content: "Ценность (год)", section: "Результат", sortOrder: 22, visible: true },
  { page: "calculator", blockKey: "comparison_title", label: "Сравнение — Заголовок", contentType: "text", content: "Сравнение", section: "Результат", sortOrder: 23, visible: true },

  // Section 5 — CTA buttons
  { page: "calculator", blockKey: "cta_catalog", label: "CTA — Каталог", contentType: "text", content: "Выбрать животное в каталоге", section: "CTA", sortOrder: 40, visible: true },
  { page: "calculator", blockKey: "cta_pdf", label: "CTA — PDF", contentType: "text", content: "Скачать расчёт PDF", section: "CTA", sortOrder: 41, visible: true },
  { page: "calculator", blockKey: "cta_share", label: "CTA — Поделиться", contentType: "text", content: "Поделиться расчётом", section: "CTA", sortOrder: 42, visible: true },
];

function getDefaultBlocks(page: string): DefaultBlock[] {
  if (page === "home") return homeDefaults;
  if (page === "catalog") return catalogDefaults;
  if (page === "about") return aboutDefaults;
  if (page === "partners") return partnersDefaults;
  if (page === "dashboard") return dashboardDefaults;
  if (page === "pricing") return pricingDefaults;
  if (page === "club") return clubDefaults;
  if (page === "tracker") return trackerDefaults;
  if (page === "calculator") return calculatorDefaults;
  return [];
}

type DefaultBlock = {
  page: string;
  blockKey: string;
  label: string;
  contentType: "text" | "richtext" | "image" | "json";
  content: string | null;
  imageUrl?: string | null;
  section: string | null;
  sortOrder: number;
  visible: boolean;
};

const dashboardDefaults: DefaultBlock[] = [
  // Section 0 — Owner Hero (used by Dashboard.tsx)
  { page: "dashboard", blockKey: "hero_badge", label: "Кабинет — Бейдж", contentType: "text", content: "Кабинет владельца", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_title_owner", label: "Кабинет — Заголовок (владелец)", contentType: "text", content: "Ваш личный кабинет — всё о вашем животном, продуктах и жизни фермы в одном месте.", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_title_guest", label: "Кабинет — Заголовок (гость)", contentType: "text", content: "Ваш личный кабинет — сердце персонального фермерства. Здесь начинается ваш путь.", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_subtitle_guest", label: "Кабинет — Описание (гость)", contentType: "richtext", content: "Сначала выберите животное в галерее. После этого кабинет свяжет дневник, трекер продукта и клуб воедино.", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_location_owner", label: "Кабинет — Локация (владелец)", contentType: "text", content: "Продукт и клуб в одном ритме", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_location_guest", label: "Кабинет — Локация (гость)", contentType: "text", content: "Маршрут начнётся после выбора животного", section: "Кабинет владельца", sortOrder: 0, visible: true },
  { page: "dashboard", blockKey: "hero_box_label", label: "Кабинет — Именная коробка", contentType: "text", content: "Ваша именная коробка", section: "Кабинет владельца", sortOrder: 0, visible: true },

  // Section 0.5 — Steps (owner dashboard)
  { page: "dashboard", blockKey: "steps_label", label: "Шаги — Подзаголовок", contentType: "text", content: "Следующие шаги", section: "Следующие шаги", sortOrder: 4, visible: true },
  { page: "dashboard", blockKey: "steps_title_owner", label: "Шаги — Заголовок (владелец)", contentType: "text", content: "Ваше животное уже в кабинете. Вот ваши следующие шаги.", section: "Следующие шаги", sortOrder: 5, visible: true },
  { page: "dashboard", blockKey: "steps_title_guest", label: "Шаги — Заголовок (гость)", contentType: "text", content: "Кабинет ждёт первый шаг: выберите животное и начните свой путь в клубе.", section: "Следующие шаги", sortOrder: 6, visible: true },
  { page: "dashboard", blockKey: "steps_subtitle", label: "Шаги — Описание", contentType: "richtext", content: "Здесь собраны ваши текущие задачи: проверить дневник, отследить продукт или заглянуть в клуб.", section: "Следующие шаги", sortOrder: 7, visible: true },

  // Section 0.6 — Participation
  { page: "dashboard", blockKey: "participation_label", label: "Участие — Подзаголовок", contentType: "text", content: "Профиль участия", section: "Профиль участия", sortOrder: 8, visible: true },
  { page: "dashboard", blockKey: "participation_title_owner", label: "Участие — Заголовок (владелец)", contentType: "text", content: "Ваше участие", section: "Профиль участия", sortOrder: 9, visible: true },
  { page: "dashboard", blockKey: "participation_title_guest", label: "Участие — Заголовок (гость)", contentType: "text", content: "Пока участие не выбрано", section: "Профиль участия", sortOrder: 9, visible: true },

  // Section 0.7 — Quick Links (label)
  { page: "dashboard", blockKey: "quicklinks_label", label: "Переходы — Подзаголовок (label)", contentType: "text", content: "Быстрые переходы", section: "Быстрые переходы", sortOrder: 29, visible: true },

  // Section 0.8 — Product Route (label + title)
  { page: "dashboard", blockKey: "product_route_label", label: "Маршрут продукта — Подзаголовок", contentType: "text", content: "Маршрут продукта", section: "Маршрут продукта", sortOrder: 39, visible: true },
  { page: "dashboard", blockKey: "product_route_title", label: "Маршрут продукта — Заголовок", contentType: "text", content: "Продукт связан с вашим животным и участием", section: "Маршрут продукта", sortOrder: 39, visible: true },

  // Section 0.9 — Curator description
  { page: "dashboard", blockKey: "curator_description", label: "Куратор — Описание (расширенное)", contentType: "richtext", content: "Мы работаем над персональным куратором, который будет подсказывать следующие шаги на основе вашего участия, истории животного и клубных событий. Пока — быстрые переходы к профилю, трекеру и клубу.", section: "Куратор", sortOrder: 49, visible: true },

  // Section 0.95 — Rhythm (label + description)
  { page: "dashboard", blockKey: "rhythm_label", label: "Ритм — Подзаголовок", contentType: "text", content: "Ритм участия", section: "Ритм участия", sortOrder: 59, visible: true },
  { page: "dashboard", blockKey: "rhythm_description", label: "Ритм — Описание (расширенное)", contentType: "richtext", content: "Личный кабинет начинается с вашего животного и ведёт дальше: профиль, трекер продуктов, клуб и обратно — всё связано в единый путь персонального фермерства.", section: "Ритм участия", sortOrder: 59, visible: true },

  // Section 0.96 — Guest Preview Sections & Registration Benefits
  { page: "dashboard", blockKey: "guest_preview_sections", label: "Гость — Превью секции", contentType: "json", content: JSON.stringify([
    { title: "Профиль участия", description: "После входа здесь появятся ваша доля, статус участия и персональная карточка выбранного животного." },
    { title: "Трекер продукта", description: "Кабинет покажет связанную партию, доставку и происхождение молока именно от выбранного животного." },
    { title: "Клуб и визиты", description: "После авторизации откроются события, семейные визиты и точки возвращения в фермерский ритм." },
  ]), section: "Гостевой превью", sortOrder: 75, visible: true },
  { page: "dashboard", blockKey: "guest_registration_benefits", label: "Гость — Преимущества регистрации", contentType: "json", content: JSON.stringify([
    "Сохраните выбранное животное и вернётесь к нему без повторного поиска.",
    "Откроете личный кабинет с долей участия, трекером продукта и следующими шагами.",
    "Получите доступ к клубным визитам, дневнику ухода и персональным обновлениям.",
  ]), section: "Гостевой превью", sortOrder: 76, visible: true },

  // Section 1 — Guest Hero
  { page: "dashboard", blockKey: "guest_hero_badge", label: "Гость — Бейдж", contentType: "text", content: "Персональное фермерство", section: "Гостевой Hero", sortOrder: 1, visible: true },
  { page: "dashboard", blockKey: "guest_hero_title", label: "Гость — Заголовок", contentType: "text", content: "Ваш личный кабинет владельца", section: "Гостевой Hero", sortOrder: 2, visible: true },
  { page: "dashboard", blockKey: "guest_hero_subtitle", label: "Гость — Описание", contentType: "richtext", content: "Здесь начинается ваш путь: выберите животное, оформите участие и получайте именные продукты с полной прозрачностью — от надоя до двери.", section: "Гостевой Hero", sortOrder: 3, visible: true },

  // Section 2 — Guest Steps
  { page: "dashboard", blockKey: "guest_steps_badge", label: "Шаги — Бейдж", contentType: "text", content: "Ваш маршрут", section: "Шаги гостя", sortOrder: 10, visible: true },
  { page: "dashboard", blockKey: "guest_steps_title", label: "Шаги — Заголовок", contentType: "text", content: "Три шага к персональному фермерству", section: "Шаги гостя", sortOrder: 11, visible: true },
  { page: "dashboard", blockKey: "guest_steps", label: "Шаги — Список", contentType: "json", content: JSON.stringify([
    { index: "01", title: "Выберите животное", text: "Откройте галерею и познакомьтесь с козами и овцами элитных пород. У каждого — имя, характер и история." },
    { index: "02", title: "Оформите участие", text: "Выберите долю и станьте совладельцем. Личный кабинет покажет ваш статус и дальнейшие действия." },
    { index: "03", title: "Получайте продукты", text: "Именная коробка с молоком и сырами от вашего животного — с трекером каждого этапа." },
  ]), section: "Шаги гостя", sortOrder: 12, visible: true },

  // Section 3 — Ownership Status
  { page: "dashboard", blockKey: "ownership_badge", label: "Участие — Бейдж", contentType: "text", content: "Ваше участие", section: "Статус участия", sortOrder: 20, visible: true },
  { page: "dashboard", blockKey: "ownership_title", label: "Участие — Заголовок", contentType: "text", content: "Статус вашего персонального фермерства", section: "Статус участия", sortOrder: 21, visible: true },
  { page: "dashboard", blockKey: "ownership_empty_share", label: "Участие — Пустая доля", contentType: "text", content: "После выбора доли кабинет покажет ваш статус участия и дальнейшие действия.", section: "Статус участия", sortOrder: 22, visible: true },
  { page: "dashboard", blockKey: "ownership_empty_animal", label: "Участие — Пустое животное", contentType: "text", content: "Сначала откройте галерею и выберите животное, чтобы здесь появилась персональная карточка владельца.", section: "Статус участия", sortOrder: 23, visible: true },

  // Section 4 — Quick Links
  { page: "dashboard", blockKey: "quicklinks_badge", label: "Переходы — Бейдж", contentType: "text", content: "Быстрые переходы", section: "Быстрые переходы", sortOrder: 30, visible: true },
  { page: "dashboard", blockKey: "quicklinks_title", label: "Переходы — Заголовок", contentType: "text", content: "Важные действия всегда на расстоянии одного клика", section: "Быстрые переходы", sortOrder: 31, visible: true },
  { page: "dashboard", blockKey: "quicklinks_guest_title", label: "Переходы — Гостевой заголовок", contentType: "text", content: "Быстрые переходы активируются после авторизации", section: "Быстрые переходы", sortOrder: 32, visible: true },
  { page: "dashboard", blockKey: "quicklinks_guest_text", label: "Переходы — Гостевой текст", contentType: "richtext", content: "После входа здесь появятся прямые ссылки в дневник, трекер продуктов и клубную ленту вашего животного.", section: "Быстрые переходы", sortOrder: 33, visible: true },

  // Section 5 — Product Route
  { page: "dashboard", blockKey: "product_badge", label: "Продукт — Бейдж", contentType: "text", content: "Маршрут продукта", section: "Маршрут продукта", sortOrder: 40, visible: true },
  { page: "dashboard", blockKey: "product_title", label: "Продукт — Заголовок", contentType: "text", content: "Продукт связан с вашим животным и участием", section: "Маршрут продукта", sortOrder: 41, visible: true },
  { page: "dashboard", blockKey: "product_empty", label: "Продукт — Пустое состояние", contentType: "richtext", content: "Когда участие будет оформлено, этот блок покажет реальную партию, прозрачный маршрут и связь с вашим животным.", section: "Маршрут продукта", sortOrder: 42, visible: true },
  { page: "dashboard", blockKey: "product_empty_name", label: "Продукт — Пустое название", contentType: "text", content: "Именная коробка появится после выбора животного", section: "Маршрут продукта", sortOrder: 43, visible: true },

  // Section 6 — Curator Teaser
  { page: "dashboard", blockKey: "curator_badge", label: "Куратор — Бейдж", contentType: "text", content: "Скоро в клубе", section: "Куратор", sortOrder: 50, visible: true },
  { page: "dashboard", blockKey: "curator_title", label: "Куратор — Заголовок", contentType: "text", content: "Персональный куратор — скоро в вашем кабинете.", section: "Куратор", sortOrder: 51, visible: true },
  { page: "dashboard", blockKey: "curator_text", label: "Куратор — Описание", contentType: "richtext", content: "Мы работаем над персональным куратором, который будет подсказывать следующие шаги на основе вашего участия, истории животного и клубных событий. Пока — быстрые переходы к профилю, трекеру и клубу.", section: "Куратор", sortOrder: 52, visible: true },
  { page: "dashboard", blockKey: "curator_placeholder", label: "Куратор — Плейсхолдер", contentType: "text", content: "Персональный куратор появится здесь в ближайшем обновлении.", section: "Куратор", sortOrder: 53, visible: true },

  // Section 7 — Rhythm / Footer
  { page: "dashboard", blockKey: "rhythm_badge", label: "Ритм — Бейдж", contentType: "text", content: "Ритм участия", section: "Ритм участия", sortOrder: 60, visible: true },
  { page: "dashboard", blockKey: "rhythm_title", label: "Ритм — Заголовок", contentType: "text", content: "Ваш кабинет связывает животное, продукт и жизнь фермы.", section: "Ритм участия", sortOrder: 61, visible: true },
  { page: "dashboard", blockKey: "rhythm_text", label: "Ритм — Описание", contentType: "richtext", content: "Личный кабинет начинается с вашего животного и ведёт дальше: профиль, трекер продуктов, клуб и обратно — всё связано в единый путь персонального фермерства.", section: "Ритм участия", sortOrder: 62, visible: true },

  // Section 8 — Guest Sticky CTA
  { page: "dashboard", blockKey: "guest_cta_badge", label: "CTA — Бейдж", contentType: "text", content: "Продолжить маршрут", section: "Гостевой CTA", sortOrder: 70, visible: true },
  { page: "dashboard", blockKey: "guest_cta_text", label: "CTA — Текст", contentType: "text", content: "Войдите, чтобы сохранить выбранный маршрут владельца и открыть кабинет участия.", section: "Гостевой CTA", sortOrder: 71, visible: true },
  { page: "dashboard", blockKey: "guest_cta_button", label: "CTA — Кнопка", contentType: "text", content: "Зарегистрироваться", section: "Гостевой CTA", sortOrder: 72, visible: true },
];

const homeDefaults: DefaultBlock[] = [
  // Section 1 — Hero
  { page: "home", blockKey: "hero_badge", label: "Hero — Бейдж", contentType: "text", content: "Первый в России клуб персонального фермерства", section: "Hero", sortOrder: 1, visible: true },
  { page: "home", blockKey: "hero_title", label: "Hero — Заголовок", contentType: "text", content: "Ваша ферма. Ваше молоко. Ваша история.", section: "Hero", sortOrder: 2, visible: true },
  { page: "home", blockKey: "hero_subtitle", label: "Hero — Описание", contentType: "richtext", content: "Выберите конкретную козу или овцу элитной породы, наблюдайте за её жизнью, воспитывайте её на ферме и получайте именные молочные продукты — с прозрачным процессом создания.", section: "Hero", sortOrder: 3, visible: true },
  { page: "home", blockKey: "hero_image", label: "Hero — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp", section: "Hero", sortOrder: 4, visible: true },
  { page: "home", blockKey: "hero_image_caption", label: "Hero — Подпись к фото", contentType: "text", content: "Конкретная ферма — конкретное животное с именем, породой и историей.", section: "Hero", sortOrder: 5, visible: true },

  // Section 1.5 — Geography
  { page: "home", blockKey: "geo_badge", label: "География — Бейдж", contentType: "text", content: "География", section: "География", sortOrder: 6, visible: true },
  { page: "home", blockKey: "geo_heading", label: "География — Заголовок", contentType: "text", content: "На расстоянии загородной прогулки от вашего дома по Новорижскому шоссе", section: "География", sortOrder: 7, visible: true },
  { page: "home", blockKey: "geo_subtitle", label: "География — Описание", contentType: "richtext", content: "Ферма Назарово расположена в самом сердце Новорижского направления", section: "География", sortOrder: 8, visible: true },

  // Section 2 — How It Works
  { page: "home", blockKey: "howit_title", label: "Как это работает — Подзаголовок", contentType: "text", content: "Как это работает", section: "Как это работает", sortOrder: 10, visible: true },
  { page: "home", blockKey: "howit_heading", label: "Как это работает — Заголовок", contentType: "text", content: "Три шага — от выбора животного до именной коробки с продуктами", section: "Как это работает", sortOrder: 11, visible: true },
  { page: "home", blockKey: "howit_subtitle", label: "Как это работает — Описание", contentType: "richtext", content: "Персональное фермерство — это просто. Выберите животное, наблюдайте за его жизнью и получайте продукты с прозрачной историей.", section: "Как это работает", sortOrder: 12, visible: true },
  { page: "home", blockKey: "steps", label: "Как это работает — 3 шага", contentType: "json", content: JSON.stringify([
    { index: "01", title: "Выберите своё животное", text: "В каталоге — козы и овцы элитных пород: англо-нубийские, альпийские, остфризские. У каждого — имя, характер, элитная родословная и прозрачная история." },
    { index: "02", title: "Наблюдайте за жизнью на ферме", text: "Личный кабинет с профилем животного, дневником, фотоотчётами и событиями клуба. Фермерство становится частью вашего ритма, а не разовой покупкой." },
    { index: "03", title: "Получайте именные продукты", text: "Молоко, сыры и сезонные наборы именно от вашего животного — в именной коробке с трекером от надоя до двери. Наслаждайтесь сами и радуйте своих близких." },
  ]), section: "Как это работает", sortOrder: 13, visible: true },

  // Section 3 — For Whom
  { page: "home", blockKey: "audience_label", label: "Для кого — Подзаголовок (label)", contentType: "text", content: "Для кого это", section: "Для кого", sortOrder: 19, visible: true },
  { page: "home", blockKey: "audience_heading", label: "Для кого — Заголовок (heading)", contentType: "text", content: "Для тех, кому важна не только еда, но и история за ней", section: "Для кого", sortOrder: 19, visible: true },
  { page: "home", blockKey: "audience_subtitle", label: "Для кого — Описание (subtitle)", contentType: "richtext", content: "Персональное фермерство — это осознанный выбор. Не массовый продукт, а личная связь с источником для тех, кто ценит прозрачность и качество.", section: "Для кого", sortOrder: 19, visible: true },
  { page: "home", blockKey: "forwhom_title", label: "Для кого — Подзаголовок", contentType: "text", content: "Для кого это", section: "Для кого", sortOrder: 20, visible: true },
  { page: "home", blockKey: "forwhom_heading", label: "Для кого — Заголовок", contentType: "text", content: "Для тех, кому важна не только еда, но и история за ней", section: "Для кого", sortOrder: 21, visible: true },
  { page: "home", blockKey: "forwhom_subtitle", label: "Для кого — Описание", contentType: "richtext", content: "Персональное фермерство — это осознанный выбор. Не массовый продукт, а личная связь с источником для тех, кто ценит прозрачность и качество.", section: "Для кого", sortOrder: 22, visible: true },
  { page: "home", blockKey: "audiences", label: "Для кого — Аудитории", contentType: "json", content: JSON.stringify([
    { title: "Семьи с детьми", text: "Ребёнок знает свою козу по имени, пьёт её молоко и приезжает на ферму как к другу. Детская академия, мастер-классы по сыроварению и семейные визиты — это не покупка, а воспитание." },
    { title: "Ценители качества", text: "Полная прозрачность: порода, состав молока, условия содержания, маршрут доставки. Элитная генетика европейского уровня — Остфриз, Лакон, Англо-нубийская." },
    { title: "Дарители уникальных подарков", text: "Именной сыр с вашим именем на этикетке, подарочный абонемент на продукцию «от моей козы» — подарок, который живёт и рассказывает историю." },
    { title: "Участники закрытого клуба", text: "Ужины на ферме, сезонные визиты, дни рождения животных, мастер-классы. Сообщество людей, объединённых общими ценностями." },
  ]), section: "Для кого", sortOrder: 23, visible: true },

  // Section 4 — Gallery Preview
  { page: "home", blockKey: "gallery_label", label: "Галерея — Подзаголовок (label)", contentType: "text", content: "Галерея животных", section: "Галерея", sortOrder: 29, visible: true },
  { page: "home", blockKey: "gallery_goats_image", label: "Галерея — Фото коз", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp", section: "Галерея", sortOrder: 37, visible: true },
  { page: "home", blockKey: "gallery_sheep_image", label: "Галерея — Фото овец", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp", section: "Галерея", sortOrder: 38, visible: true },
  { page: "home", blockKey: "gallery_title", label: "Галерея — Подзаголовок", contentType: "text", content: "Галерея животных", section: "Галерея", sortOrder: 30, visible: true },
  { page: "home", blockKey: "gallery_heading", label: "Галерея — Заголовок", contentType: "text", content: "Познакомьтесь с животными фермы", section: "Галерея", sortOrder: 31, visible: true },
  { page: "home", blockKey: "gallery_subtitle", label: "Галерея — Описание", contentType: "richtext", content: "Элитные породы с европейской генетикой. У каждого — имя, характер, родословная и доступные доли.", section: "Галерея", sortOrder: 32, visible: true },
  { page: "home", blockKey: "goats_card_title", label: "Галерея — Козы заголовок", contentType: "text", content: "Англо-нубийские и альпийские козы", section: "Галерея", sortOrder: 33, visible: true },
  { page: "home", blockKey: "goats_card_text", label: "Галерея — Козы описание", contentType: "richtext", content: "Молоко жирностью до 5% с исключительным сливочным вкусом. «Королевские» породы французского сыроделия — основа для артизанальных сыров.", section: "Галерея", sortOrder: 34, visible: true },
  { page: "home", blockKey: "sheep_card_title", label: "Галерея — Овцы заголовок", contentType: "text", content: "Овцы Остфриз и Лакон", section: "Галерея", sortOrder: 35, visible: true },
  { page: "home", blockKey: "sheep_card_text", label: "Галерея — Овцы описание", contentType: "richtext", content: "Самые высокоудойные породы в мире. Молоко с высоким содержанием жира и белка — идеально для сыроварения. Генетика уровня Рокфора.", section: "Галерея", sortOrder: 36, visible: true },

  // Section 5 — Why Us
  { page: "home", blockKey: "whyus_label", label: "Почему мы — Подзаголовок (label)", contentType: "text", content: "Почему Шерь Козу", section: "Почему мы", sortOrder: 39, visible: true },
  { page: "home", blockKey: "whyus_title", label: "Почему мы — Подзаголовок", contentType: "text", content: "Почему Шерь Козу", section: "Почему мы", sortOrder: 40, visible: true },
  { page: "home", blockKey: "whyus_heading", label: "Почему мы — Заголовок", contentType: "text", content: "Не просто продукты — личная история с фермой", section: "Почему мы", sortOrder: 41, visible: true },
  { page: "home", blockKey: "whyus_image", label: "Почему мы — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp", section: "Почему мы", sortOrder: 42, visible: true },
  { page: "home", blockKey: "values", label: "Почему мы — Ценности", contentType: "json", content: JSON.stringify([
    { title: "Эмоциональная связь", text: "Профиль животного с именем, характером, дневником и фотоотчётами. Это не покупка — это причастность к живой истории.", stat: "100%", statLabel: "прозрачность" },
    { title: "Радикальная прозрачность", text: "Вы видите всё: породу, родословную, состав молока, условия ухода и маршрут доставки. Никаких чёрных ящиков.", stat: "→", statLabel: "от надоя до двери" },
    { title: "Элитные породы", text: "Англо-нубийские козы, альпийские козы, овцы Остфриз и Лакон — генетика европейского уровня, обосновывающая премиальное качество.", stat: "4", statLabel: "породы" },
    { title: "Доставка до двери", text: "Именная коробка с продуктами от вашего животного — регулярно, бережно, с трекером каждого этапа.", stat: "2×", statLabel: "в месяц" },
  ]), section: "Почему мы", sortOrder: 43, visible: true },
  { page: "home", blockKey: "testimonials", label: "Почему мы — Отзывы", contentType: "json", content: JSON.stringify([
    { text: "Дочка каждое утро спрашивает, как дела у Марты. Молоко пьёт только «от нашей козы». Это больше, чем продукт — это ритуал.", author: "Анна К.", role: "мама двоих детей" },
    { text: "Подарил жене долю в козе на годовщину. Теперь у нас семейная традиция — ездить на ферму каждый сезон.", author: "Дмитрий Р.", role: "участник клуба" },
    { text: "Впервые вижу такую прозрачность: знаю, от какого животного молоко, когда надоено и когда доставят. Это другой уровень.", author: "Елена М.", role: "ценитель натуральных продуктов" },
  ]), section: "Почему мы", sortOrder: 44, visible: true },

  // Section 6 — Products
  { page: "home", blockKey: "products_label", label: "Продукты — Подзаголовок (label)", contentType: "text", content: "Что вы получаете", section: "Продукты", sortOrder: 49, visible: true },
  { page: "home", blockKey: "products_title", label: "Продукты — Подзаголовок", contentType: "text", content: "Что вы получаете", section: "Продукты", sortOrder: 50, visible: true },
  { page: "home", blockKey: "products_heading", label: "Продукты — Заголовок", contentType: "text", content: "Что внутри именной коробки", section: "Продукты", sortOrder: 51, visible: true },
  { page: "home", blockKey: "products_subtitle", label: "Продукты — Описание", contentType: "richtext", content: "Каждый продукт — результат вашей связи с конкретным животным. С трекером происхождения от надоя до двери.", section: "Продукты", sortOrder: 52, visible: true },
  { page: "home", blockKey: "products_image", label: "Продукты — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp", section: "Продукты", sortOrder: 53, visible: true },
  { page: "home", blockKey: "products_list", label: "Продукты — Список", contentType: "json", content: JSON.stringify([
    { label: "Свежее молоко", desc: "Козье или овечье молоко от вашего животного. Доставка в течение 24 часов после надоя." },
    { label: "Именные сыры", desc: "Мягкие и выдержанные сыры ручной работы — с именем владельца на этикетке. Статусный подарок и семейная традиция." },
    { label: "Сезонные наборы", desc: "Подарочные боксы с лучшими продуктами фермы — для себя, семьи или в подарок близким." },
  ]), section: "Продукты", sortOrder: 54, visible: true },

  // Section 7 — CTA
  { page: "home", blockKey: "cta_label", label: "CTA — Подзаголовок (label)", contentType: "text", content: "Начните сейчас", section: "Призыв к действию", sortOrder: 59, visible: true },
  { page: "home", blockKey: "cta_title", label: "CTA — Подзаголовок", contentType: "text", content: "Начните сейчас", section: "Призыв к действию", sortOrder: 60, visible: true },
  { page: "home", blockKey: "cta_heading", label: "CTA — Заголовок", contentType: "text", content: "Станьте частью первого в России клуба персонального фермерства", section: "Призыв к действию", sortOrder: 61, visible: true },
  { page: "home", blockKey: "cta_subtitle", label: "CTA — Описание", contentType: "richtext", content: "Выберите животное, познакомьтесь с его историей и начните получать именные продукты. Количество мест в клубе ограничено — мы работаем с каждым владельцем лично.", section: "Призыв к действию", sortOrder: 62, visible: true },
];

const aboutDefaults: DefaultBlock[] = [
  // Section 1 — Hero
  { page: "about", blockKey: "hero_badge", label: "Hero — Бейдж", contentType: "text", content: "О ферме", section: "Hero", sortOrder: 1, visible: true },
  { page: "about", blockKey: "hero_heading", label: "Hero — Заголовок", contentType: "richtext", content: "Семейная ферма, где каждое животное — член семьи", section: "Hero", sortOrder: 2, visible: true },
  { page: "about", blockKey: "hero_subtitle", label: "Hero — Описание", contentType: "richtext", content: "Мы — семья, которая превратила любовь к животным и натуральным продуктам в дело жизни. Наша ферма — это не производство. Это место, где козы и овцы элитных пород живут в заботе, а каждый продукт несёт имя конкретного животного.", section: "Hero", sortOrder: 3, visible: true },
  { page: "about", blockKey: "hero_image", label: "Hero — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_family_story-YMV9ujT7krNrfNEGsYidAo.webp", section: "Hero", sortOrder: 4, visible: true },
  { page: "about", blockKey: "hero_location", label: "Hero — Локация", contentType: "text", content: "Подмосковье", section: "Hero", sortOrder: 5, visible: true },
  { page: "about", blockKey: "hero_since", label: "Hero — С какого года", contentType: "text", content: "Семейная ферма с 2019 года", section: "Hero", sortOrder: 6, visible: true },

  // Section 2 — History
  { page: "about", blockKey: "history_badge", label: "История — Бейдж", contentType: "text", content: "Наша история", section: "История", sortOrder: 10, visible: true },
  { page: "about", blockKey: "history_heading", label: "История — Заголовок", contentType: "text", content: "От мечты — к первому в России клубу персонального фермерства", section: "История", sortOrder: 11, visible: true },
  { page: "about", blockKey: "history_subtitle", label: "История — Описание", contentType: "richtext", content: "Каждый год мы росли — не ради масштаба, а ради глубины. Больше заботы, больше прозрачности, больше связи между семьями и фермой.", section: "История", sortOrder: 12, visible: true },
  { page: "about", blockKey: "history_timeline", label: "История — Таймлайн", contentType: "json", content: JSON.stringify([
    { year: "2019", title: "Идея", text: "Мечта о собственной ферме, где каждое животное — член семьи, а каждый продукт — результат заботы и любви." },
    { year: "2020", title: "Первые животные", text: "Появились первые англо-нубийские козы. Начали изучать генетику, уход и традиции европейского фермерства." },
    { year: "2022", title: "Расширение стада", text: "Добавили альпийских коз и остфризских овец. Запустили собственное сыроделие и начали работать с первыми семьями." },
    { year: "2024", title: "Клуб «Шерь Козу»", text: "Создали закрытый клуб персонального фермерства — первый в России. Семьи выбирают своё животное и получают именные продукты." },
    { year: "2025", title: "Цифровая ферма", text: "Запустили платформу с личными кабинетами, трекером продуктов и дневниками животных. Прозрачность стала полной." },
  ]), section: "История", sortOrder: 13, visible: true },

  // Section 3 — Philosophy
  { page: "about", blockKey: "philosophy_badge", label: "Философия — Бейдж", contentType: "text", content: "Наша философия", section: "Философия", sortOrder: 20, visible: true },
  { page: "about", blockKey: "philosophy_heading", label: "Философия — Заголовок", contentType: "text", content: "Три принципа, на которых стоит ферма", section: "Философия", sortOrder: 21, visible: true },
  { page: "about", blockKey: "philosophy_subtitle", label: "Философия — Описание", contentType: "richtext", content: "Мы верим, что качество начинается с отношения — к животным, к продукту и к людям, которые нам доверяют.", section: "Философия", sortOrder: 22, visible: true },
  { page: "about", blockKey: "philosophy_image", label: "Философия — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_philosophy-UsPE82Ym7NqaHcQhCHFj4f.webp", section: "Философия", sortOrder: 23, visible: true },
  { page: "about", blockKey: "philosophy_principles", label: "Философия — Принципы", contentType: "json", content: JSON.stringify([
    { icon: "Eye", title: "Радикальная прозрачность", text: "Вы знаете всё: имя животного, породу, родословную, состав молока, условия содержания и маршрут доставки. Никаких чёрных ящиков — только открытость на каждом этапе." },
    { icon: "Heart", title: "Эмоциональная связь", text: "Это не просто покупка продуктов. Вы выбираете конкретное животное, следите за его жизнью, приезжаете в гости. Каждая коробка — продолжение вашей личной истории с фермой." },
    { icon: "ShieldCheck", title: "Элитная генетика", text: "Мы работаем только с лучшими породами: англо-нубийские и альпийские козы, остфризские овцы и овцы породы Лакон. Европейская генетика — основа премиального качества молока и продуктов." },
  ]), section: "Философия", sortOrder: 24, visible: true },

  // Section 4 — Breeds
  { page: "about", blockKey: "breeds_badge", label: "Породы — Бейдж", contentType: "text", content: "Элитные породы", section: "Породы", sortOrder: 30, visible: true },
  { page: "about", blockKey: "breeds_heading", label: "Породы — Заголовок", contentType: "text", content: "Генетика европейского уровня — основа премиального качества", section: "Породы", sortOrder: 31, visible: true },
  { page: "about", blockKey: "breeds_subtitle", label: "Породы — Описание", contentType: "richtext", content: "Мы тщательно отбираем породы, которые дают лучшее молоко для сыров, йогуртов и свежих молочных продуктов.", section: "Породы", sortOrder: 32, visible: true },
  { page: "about", blockKey: "breeds_image", label: "Породы — Фото", contentType: "image", content: "", imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_breeds-CDKnxN8KzLjmZdjyKV8vE4.webp", section: "Породы", sortOrder: 33, visible: true },
  { page: "about", blockKey: "breeds_list", label: "Породы — Список", contentType: "json", content: JSON.stringify([
    { name: "Англо-нубийская коза", origin: "Великобритания", trait: "Молоко с высоким содержанием жира (5–8%) и сливочным вкусом. Идеально для сыров и йогуртов.", character: "Общительные, ласковые, с выразительными длинными ушами и римским профилем." },
    { name: "Альпийская коза", origin: "Французские Альпы", trait: "Высокая молочная продуктивность, молоко с мягким, чистым вкусом. Отлично подходит для свежего молока и мягких сыров.", character: "Выносливые, любопытные, с яркой контрастной окраской." },
    { name: "Остфризская овца", origin: "Восточная Фризия, Германия", trait: "Самая молочная порода овец в мире. Молоко с 6–7% жирности — основа для элитных овечьих сыров.", character: "Спокойные, дружелюбные, легко привыкают к людям." },
    { name: "Овца породы Лакон", origin: "Греция", trait: "Молоко с богатым вкусом и высоким содержанием белка. Традиционная основа для фета и других средиземноморских сыров.", character: "Грациозные, неприхотливые, хорошо адаптируются к разным условиям." },
  ]), section: "Породы", sortOrder: 34, visible: true },

  // Section 5 — Gallery
  { page: "about", blockKey: "gallery_badge", label: "Галерея — Бейдж", contentType: "text", content: "Жизнь на ферме", section: "Галерея", sortOrder: 40, visible: true },
  { page: "about", blockKey: "gallery_heading", label: "Галерея — Заголовок", contentType: "text", content: "Каждый день — забота, каждый продукт — история", section: "Галерея", sortOrder: 41, visible: true },
  { page: "about", blockKey: "gallery_subtitle", label: "Галерея — Описание", contentType: "richtext", content: "Ферма живёт своим ритмом: утренние надои, прогулки на пастбище, визиты семей и вечерний уход. Вот как это выглядит.", section: "Галерея", sortOrder: 42, visible: true },

  // Section 6 — Values
  { page: "about", blockKey: "values_badge", label: "Ценности — Бейдж", contentType: "text", content: "Наши ценности", section: "Ценности", sortOrder: 50, visible: true },
  { page: "about", blockKey: "values_heading", label: "Ценности — Заголовок", contentType: "text", content: "Не масштаб, а глубина", section: "Ценности", sortOrder: 51, visible: true },
  { page: "about", blockKey: "values_subtitle", label: "Ценности — Описание", contentType: "richtext", content: "Мы сознательно ограничиваем количество мест в клубе. Не потому что хотим создать дефицит — а потому что каждому животному нужна настоящая забота, а каждой семье — персональное внимание. Мы растём медленно, чтобы расти правильно.", section: "Ценности", sortOrder: 52, visible: true },
  { page: "about", blockKey: "values_stats", label: "Ценности — Статистика", contentType: "json", content: JSON.stringify([
    { value: "50", label: "семей в клубе" },
    { value: "4", label: "элитные породы" },
    { value: "100%", label: "прозрачность" },
  ]), section: "Ценности", sortOrder: 53, visible: true },

  // Section 7 — CTA
  { page: "about", blockKey: "cta_heading", label: "CTA — Заголовок", contentType: "text", content: "Приезжайте к нам на ферму", section: "Призыв к действию", sortOrder: 60, visible: true },
  { page: "about", blockKey: "cta_subtitle", label: "CTA — Описание", contentType: "richtext", content: "Познакомьтесь с животными лично, попробуйте свежие продукты и почувствуйте, каково это — знать, откуда ваша еда.", section: "Призыв к действию", sortOrder: 61, visible: true },
];

const catalogDefaults: DefaultBlock[] = [
  { page: "catalog", blockKey: "badge", label: "Бейдж", contentType: "text", content: "Каталог животных", section: "Шапка", sortOrder: 1, visible: true },
  { page: "catalog", blockKey: "heading", label: "Заголовок", contentType: "text", content: "Найдите своё животное элитной породы", section: "Шапка", sortOrder: 2, visible: true },
  { page: "catalog", blockKey: "subtitle", label: "Описание", contentType: "richtext", content: "Козы и овцы с именем, характером и историей. Выберите по породе или статусу участия — и начните свою историю персонального фермерства.", section: "Шапка", sortOrder: 3, visible: true },
  { page: "catalog", blockKey: "status_relationship", label: "Статус — В отношениях", contentType: "richtext", content: "Животное уже нашло свою семью. Все доли оформлены, владелец получает именные продукты.", section: "Статусы", sortOrder: 10, visible: true },
  { page: "catalog", blockKey: "status_available", label: "Статус — На выданье", contentType: "richtext", content: "Животное ждёт свою семью. Все доли свободны — можно стать единственным владельцем.", section: "Статусы", sortOrder: 11, visible: true },
  { page: "catalog", blockKey: "status_shared", label: "Статус — Доступно для участия", contentType: "richtext", content: "Одна семья уже участвует, но есть свободные доли. Можно присоединиться и разделить заботу о животном.", section: "Статусы", sortOrder: 12, visible: true },
];
