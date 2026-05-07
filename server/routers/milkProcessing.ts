/**
 * Milk Processing (Переработка) tRPC Router.
 *
 * Manages processing sessions where cheesemaker takes milk from tanks
 * and produces finished products (cheese, yogurt, etc.).
 *
 * Session code format: CH-дд.мм.гггг (with -02 suffix for multiple per day).
 * Multi-tank input, multi-product output.
 * Tracks conversion coefficients (actual vs base from tierProductCatalog).
 *
 * Endpoints:
 * - processing.listSessions — paginated session list for cheesemaker
 * - processing.getSession — single session with inputs/outputs
 * - processing.createSession — create new draft session
 * - processing.updateSession — update draft session (inputs/outputs/note)
 * - processing.completeSession — finalize: deduct tanks, credit warehouse, calc coefficients
 * - processing.cancelSession — cancel draft/in_progress session
 * - processing.correctSession — rollback completed session for re-edit
 * - processing.catalogItems — list available products from tierProductCatalog
 * - processing.activeWarehouses — list active warehouses for product destination
 * - processing.activeTanks — list tanks with current volume for input selection
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { verifyFarmToken, FARM_COOKIE_NAME, logMilkAudit } from "../farmAuth";
import {
  processingSessions,
  processingInputs,
  processingOutputs,
  warehouses,
  warehouseInventory,
  warehouseMovements,
  milkTanks,
  milkTankMovements,
  tierProductCatalog,
  farmWorkers,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";

// ─── Auth helpers ────────────────────────────────────────────

function extractFarmWorker(req: any): { workerId: number; login: string; role: string } | null {
  const cookieHeader = req.headers?.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  const token = req.cookies?.[FARM_COOKIE_NAME] ?? cookies[FARM_COOKIE_NAME];
  if (!token) return null;
  return verifyFarmToken(token);
}

function requireCheesemaker(req: any) {
  const worker = extractFarmWorker(req);
  if (!worker) throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти" });
  if (worker.role !== "cheesemaker" && worker.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Доступ только для сыроделов" });
  }
  return worker;
}

/** Procedure that requires cheesemaker role via farm cookie */
const cheesemakerProcedure = publicProcedure.use(({ ctx, next }) => {
  const worker = requireCheesemaker(ctx.req);
  return next({ ctx: { ...ctx, farmWorker: worker } });
});

// ─── Session code generation ─────────────────────────────────

/**
 * Generate session code: CH-дд.мм.гггг, CH-дд.мм.гггг-02, etc.
 */
async function generateSessionCode(shiftDate: string): Promise<string> {
  const db = await getDb();
  // shiftDate is YYYY-MM-DD, convert to dd.mm.yyyy
  const [y, m, d] = shiftDate.split("-");
  const dateStr = `${d}.${m}.${y}`;
  const baseCode = `CH-${dateStr}`;

  // Count existing sessions for this date
  const existing = await db
    .select({ sessionCode: processingSessions.sessionCode })
    .from(processingSessions)
    .where(sql`${processingSessions.sessionCode} LIKE ${baseCode + '%'}`);

  if (existing.length === 0) return baseCode;

  // Find the highest suffix
  let maxSuffix = 1;
  for (const row of existing) {
    const parts = row.sessionCode.split("-");
    // CH-dd.mm.yyyy = 2 parts, CH-dd.mm.yyyy-02 = 3 parts
    if (parts.length >= 3) {
      const suffix = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(suffix) && suffix >= maxSuffix) maxSuffix = suffix;
    }
  }

  // If only the base code exists, next is -02
  const nextSuffix = existing.length === 1 && existing[0].sessionCode === baseCode
    ? 2
    : maxSuffix + 1;

  return `${baseCode}-${String(nextSuffix).padStart(2, "0")}`;
}

// ─── Router ─────────────────────────────────────────────────

export const milkProcessingRouter = router({
  /**
   * List processing sessions for cheesemaker (paginated).
   */
  listSessions: cheesemakerProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        status: z.enum(["draft", "in_progress", "completed", "cancelled"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const conditions: any[] = [];
      if (input?.status) conditions.push(eq(processingSessions.status, input.status));
      if (input?.dateFrom) conditions.push(sql`${processingSessions.shiftDate} >= ${input.dateFrom}`);
      if (input?.dateTo) conditions.push(sql`${processingSessions.shiftDate} <= ${input.dateTo}`);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [sessions, [countResult]] = await Promise.all([
        db
          .select({
            id: processingSessions.id,
            sessionCode: processingSessions.sessionCode,
            shiftDate: processingSessions.shiftDate,
            status: processingSessions.status,
            totalInputMl: processingSessions.totalInputMl,
            note: processingSessions.note,
            completedAt: processingSessions.completedAt,
            createdAt: processingSessions.createdAt,
            workerName: farmWorkers.name,
          })
          .from(processingSessions)
          .leftJoin(farmWorkers, eq(processingSessions.startedByWorkerId, farmWorkers.id))
          .where(whereClause)
          .orderBy(desc(processingSessions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(processingSessions)
          .where(whereClause),
      ]);

      return { sessions, total: Number(countResult?.count ?? 0) };
    }),

  /**
   * Get single session with all inputs and outputs.
   */
  getSession: cheesemakerProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();

      const [session] = await db
        .select({
          id: processingSessions.id,
          sessionCode: processingSessions.sessionCode,
          shiftDate: processingSessions.shiftDate,
          status: processingSessions.status,
          totalInputMl: processingSessions.totalInputMl,
          startedByWorkerId: processingSessions.startedByWorkerId,
          note: processingSessions.note,
          completedAt: processingSessions.completedAt,
          createdAt: processingSessions.createdAt,
          updatedAt: processingSessions.updatedAt,
          workerName: farmWorkers.name,
        })
        .from(processingSessions)
        .leftJoin(farmWorkers, eq(processingSessions.startedByWorkerId, farmWorkers.id))
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });

      const inputs = await db
        .select({
          id: processingInputs.id,
          tankId: processingInputs.tankId,
          volumeMl: processingInputs.volumeMl,
          milkType: processingInputs.milkType,
          note: processingInputs.note,
          tankName: milkTanks.name,
        })
        .from(processingInputs)
        .leftJoin(milkTanks, eq(processingInputs.tankId, milkTanks.id))
        .where(eq(processingInputs.sessionId, input.sessionId));

      const outputs = await db
        .select({
          id: processingOutputs.id,
          catalogItemId: processingOutputs.catalogItemId,
          productLabel: processingOutputs.productLabel,
          quantity: processingOutputs.quantity,
          unit: processingOutputs.unit,
          warehouseId: processingOutputs.warehouseId,
          actualConversionRatio: processingOutputs.actualConversionRatio,
          baseConversionRatio: processingOutputs.baseConversionRatio,
          deviationPercent: processingOutputs.deviationPercent,
          note: processingOutputs.note,
          warehouseName: warehouses.name,
        })
        .from(processingOutputs)
        .leftJoin(warehouses, eq(processingOutputs.warehouseId, warehouses.id))
        .where(eq(processingOutputs.sessionId, input.sessionId));

      return { session, inputs, outputs };
    }),

  /**
   * Create a new draft processing session.
   * Auto-generates session code based on date.
   */
  createSession: cheesemakerProcedure
    .input(
      z.object({
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Формат даты: YYYY-MM-DD"),
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      const sessionCode = await generateSessionCode(input.shiftDate);

      const [result] = await db.insert(processingSessions).values({
        sessionCode,
        shiftDate: input.shiftDate,
        status: "draft",
        startedByWorkerId: worker.workerId,
        totalInputMl: 0,
        note: input.note ?? null,
      });

      await logMilkAudit({
        action: "processing_session_created",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: result.insertId,
        detailsJson: JSON.stringify({ sessionCode, shiftDate: input.shiftDate }),
      });

      return { id: result.insertId, sessionCode };
    }),

  /**
   * Update a draft session: set inputs (tanks + volumes) and outputs (products).
   * Only allowed for draft/in_progress sessions.
   */
  updateSession: cheesemakerProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        note: z.string().max(2000).optional().nullable(),
        inputs: z.array(
          z.object({
            tankId: z.number().int().positive(),
            volumeMl: z.number().int().positive(),
            milkType: z.enum(["goat", "sheep", "cow"]),
            note: z.string().max(500).optional().nullable(),
          }),
        ).optional(),
        outputs: z.array(
          z.object({
            catalogItemId: z.number().int().positive(),
            productLabel: z.string().min(1).max(160),
            quantity: z.number().positive(),
            unit: z.string().min(1).max(16),
            warehouseId: z.number().int().positive(),
            note: z.string().max(500).optional().nullable(),
          }),
        ).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      // Verify session exists and is editable
      const [session] = await db
        .select()
        .from(processingSessions)
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (session.status !== "draft" && session.status !== "in_progress") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Редактирование доступно только для черновиков" });
      }

      // Update note
      if (input.note !== undefined) {
        await db.update(processingSessions)
          .set({ note: input.note })
          .where(eq(processingSessions.id, input.sessionId));
      }

      // Replace inputs
      if (input.inputs) {
        // Validate tank volumes
        for (const inp of input.inputs) {
          const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, inp.tankId)).limit(1);
          if (!tank) throw new TRPCError({ code: "BAD_REQUEST", message: `Танк #${inp.tankId} не найден` });
          if (tank.currentVolumeMl < inp.volumeMl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Недостаточно молока в танке "${tank.name}": доступно ${(tank.currentVolumeMl / 1000).toFixed(1)}л, запрошено ${(inp.volumeMl / 1000).toFixed(1)}л`,
            });
          }
        }

        // Delete old inputs and insert new
        await db.delete(processingInputs).where(eq(processingInputs.sessionId, input.sessionId));
        if (input.inputs.length > 0) {
          await db.insert(processingInputs).values(
            input.inputs.map((inp) => ({
              sessionId: input.sessionId,
              tankId: inp.tankId,
              volumeMl: inp.volumeMl,
              milkType: inp.milkType,
              note: inp.note ?? null,
            })),
          );
        }

        // Update total input
        const totalInputMl = input.inputs.reduce((sum: number, inp: any) => sum + inp.volumeMl, 0);
        await db.update(processingSessions)
          .set({ totalInputMl, status: "in_progress" })
          .where(eq(processingSessions.id, input.sessionId));
      }

      // Replace outputs
      if (input.outputs) {
        await db.delete(processingOutputs).where(eq(processingOutputs.sessionId, input.sessionId));
        if (input.outputs.length > 0) {
          await db.insert(processingOutputs).values(
            input.outputs.map((out) => ({
              sessionId: input.sessionId,
              catalogItemId: out.catalogItemId,
              productLabel: out.productLabel,
              quantity: out.quantity,
              unit: out.unit,
              warehouseId: out.warehouseId,
              note: out.note ?? null,
            })),
          );
        }
      }

      await logMilkAudit({
        action: "processing_session_updated",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          inputCount: input.inputs?.length,
          outputCount: input.outputs?.length,
        }),
      });

      return { success: true };
    }),

  /**
   * Complete a processing session:
   * 1. Deduct milk from tanks (create milkTankMovements)
   * 2. Calculate conversion coefficients for each output
   * 3. Credit warehouse inventory
   * 4. Create warehouse movements
   * 5. Mark session as completed
   */
  completeSession: cheesemakerProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      // Load session
      const [session] = await db
        .select()
        .from(processingSessions)
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (session.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Сессия уже завершена" });
      }
      if (session.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Сессия отменена" });
      }

      // Load inputs and outputs
      const inputs = await db
        .select()
        .from(processingInputs)
        .where(eq(processingInputs.sessionId, input.sessionId));

      const outputs = await db
        .select()
        .from(processingOutputs)
        .where(eq(processingOutputs.sessionId, input.sessionId));

      if (inputs.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нет входных данных (молоко из танков)" });
      }
      if (outputs.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нет выходных данных (продукция)" });
      }

      // 1. Deduct milk from tanks
      const totalInputMl = inputs.reduce((sum, inp) => sum + inp.volumeMl, 0);

      for (const inp of inputs) {
        const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, inp.tankId)).limit(1);
        if (!tank) throw new TRPCError({ code: "BAD_REQUEST", message: `Танк #${inp.tankId} не найден` });
        if (tank.currentVolumeMl < inp.volumeMl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Недостаточно молока в танке "${tank.name}": доступно ${(tank.currentVolumeMl / 1000).toFixed(1)}л, запрошено ${(inp.volumeMl / 1000).toFixed(1)}л`,
          });
        }

        const newVolume = tank.currentVolumeMl - inp.volumeMl;
        await db.update(milkTanks)
          .set({
            currentVolumeMl: newVolume,
            status: newVolume === 0 ? "empty" : tank.status,
          })
          .where(eq(milkTanks.id, inp.tankId));

        // Create tank movement record
        await db.insert(milkTankMovements).values({
          tankId: inp.tankId,
          movementType: "processing_out",
          volumeMl: -inp.volumeMl,
          tankVolumeAfterMl: newVolume,
          performedByWorkerId: worker.workerId,
          note: `Переработка: сессия ${session.sessionCode}`,
        });
      }

      // 2. Calculate conversion coefficients and update outputs
      for (const out of outputs) {
        // Fetch base conversion ratio from tierProductCatalog
        const [catalogItem] = await db
          .select()
          .from(tierProductCatalog)
          .where(eq(tierProductCatalog.id, out.catalogItemId))
          .limit(1);

        const baseRatio = catalogItem?.conversionRatio ?? null;

        // Actual ratio: how many liters of milk per 1 unit of product
        // totalInputMl is shared across all outputs proportionally
        // For simplicity, use total input / total output quantity
        // But per-product: actualRatio = (totalInputMl / 1000) / quantity
        // This is the actual liters-per-unit for this product
        const actualRatio = out.quantity > 0 ? totalInputMl / 1000 / out.quantity : null;

        // Deviation: ((actual - base) / base) * 100
        let deviation: number | null = null;
        if (actualRatio !== null && baseRatio !== null && baseRatio > 0) {
          deviation = ((actualRatio - baseRatio) / baseRatio) * 100;
        }

        await db.update(processingOutputs)
          .set({
            actualConversionRatio: actualRatio,
            baseConversionRatio: baseRatio,
            deviationPercent: deviation,
          })
          .where(eq(processingOutputs.id, out.id));

        // 3. Credit warehouse inventory
        const [existingInventory] = await db
          .select()
          .from(warehouseInventory)
          .where(
            and(
              eq(warehouseInventory.warehouseId, out.warehouseId),
              eq(warehouseInventory.catalogItemId, out.catalogItemId),
            ),
          )
          .limit(1);

        if (existingInventory) {
          await db.update(warehouseInventory)
            .set({ quantity: existingInventory.quantity + out.quantity })
            .where(eq(warehouseInventory.id, existingInventory.id));
        } else {
          await db.insert(warehouseInventory).values({
            warehouseId: out.warehouseId,
            catalogItemId: out.catalogItemId,
            productLabel: out.productLabel,
            quantity: out.quantity,
            unit: out.unit,
          });
        }

        // 4. Create warehouse movement
        await db.insert(warehouseMovements).values({
          warehouseId: out.warehouseId,
          movementType: "in",
          catalogItemId: out.catalogItemId,
          productLabel: out.productLabel,
          quantity: out.quantity,
          unit: out.unit,
          processingSessionId: input.sessionId,
          performedByWorkerId: worker.workerId,
          note: `Из переработки: сессия ${session.sessionCode}`,
        });
      }

      // 5. Mark session as completed
      await db.update(processingSessions)
        .set({
          status: "completed",
          totalInputMl,
          completedAt: new Date(),
        })
        .where(eq(processingSessions.id, input.sessionId));

      await logMilkAudit({
        action: "processing_session_completed",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          totalInputMl,
          outputCount: outputs.length,
          sessionCode: session.sessionCode,
        }),
      });

      return { success: true, sessionCode: session.sessionCode };
    }),

  /**
   * Cancel a session (draft, in_progress, or completed).
   * If the session was completed (milk deducted, warehouse credited),
   * reverses all movements before cancelling.
   */
  cancelSession: cheesemakerProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      const [session] = await db
        .select()
        .from(processingSessions)
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (session.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Сессия уже отменена" });
      }

      // If session was completed, reverse tank deductions and warehouse credits
      if (session.status === "completed") {
        const inputs = await db
          .select()
          .from(processingInputs)
          .where(eq(processingInputs.sessionId, input.sessionId));

        const outputs = await db
          .select()
          .from(processingOutputs)
          .where(eq(processingOutputs.sessionId, input.sessionId));

        // 1. Return milk to tanks
        for (const inp of inputs) {
          const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, inp.tankId)).limit(1);
          if (tank) {
            const newVolume = tank.currentVolumeMl + inp.volumeMl;
            await db.update(milkTanks)
              .set({
                currentVolumeMl: newVolume,
                status: newVolume > 0 ? "filling" : "empty",
              })
              .where(eq(milkTanks.id, inp.tankId));

            // Create reversal tank movement
            await db.insert(milkTankMovements).values({
              tankId: inp.tankId,
              movementType: "adjustment",
              volumeMl: inp.volumeMl,
              tankVolumeAfterMl: newVolume,
              performedByWorkerId: worker.workerId,
              note: `Отмена переработки: сессия ${session.sessionCode}`,
            });
          }
        }

        // 2. Reverse warehouse credits
        for (const out of outputs) {
          const [inv] = await db
            .select()
            .from(warehouseInventory)
            .where(
              and(
                eq(warehouseInventory.warehouseId, out.warehouseId),
                eq(warehouseInventory.catalogItemId, out.catalogItemId),
              ),
            )
            .limit(1);

          if (inv) {
            const newQty = Math.max(0, inv.quantity - out.quantity);
            await db.update(warehouseInventory)
              .set({ quantity: newQty })
              .where(eq(warehouseInventory.id, inv.id));
          }
        }

        // 3. Delete warehouse movements for this session
        await db.delete(warehouseMovements)
          .where(eq(warehouseMovements.processingSessionId, input.sessionId));
      }

      await db.update(processingSessions)
        .set({ status: "cancelled", completedAt: null })
        .where(eq(processingSessions.id, input.sessionId));

      await logMilkAudit({
        action: "processing_session_cancelled",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          previousStatus: session.status,
          milkReturned: session.status === "completed",
          sessionCode: session.sessionCode,
        }),
      });

      return { success: true, milkReturned: session.status === "completed" };
    }),

  /**
   * Delete a cancelled session permanently.
   * Only sessions with status "cancelled" can be deleted.
   * Removes the session and all related inputs/outputs.
   */
  deleteSession: cheesemakerProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      const [session] = await db
        .select()
        .from(processingSessions)
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (session.status !== "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Удалить можно только отменённые сессии" });
      }

      // Delete related outputs and inputs first
      await db.delete(processingOutputs).where(eq(processingOutputs.sessionId, input.sessionId));
      await db.delete(processingInputs).where(eq(processingInputs.sessionId, input.sessionId));
      // Delete the session itself
      await db.delete(processingSessions).where(eq(processingSessions.id, input.sessionId));

      await logMilkAudit({
        action: "processing_session_cancelled",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: input.sessionId,
        details: "Session permanently deleted",
      });

      return { success: true };
    }),

  /**
   * Correct a completed session:
   * 1. Reverse tank deductions (add milk back)
   * 2. Reverse warehouse credits (subtract products)
   * 3. Delete warehouse movements for this session
   * 4. Set session back to "in_progress" for re-editing
   */
  correctSession: cheesemakerProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const worker = ctx.farmWorker;

      const [session] = await db
        .select()
        .from(processingSessions)
        .where(eq(processingSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (session.status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Исправить можно только завершённую сессию" });
      }

      // Load inputs and outputs
      const inputs = await db
        .select()
        .from(processingInputs)
        .where(eq(processingInputs.sessionId, input.sessionId));

      const outputs = await db
        .select()
        .from(processingOutputs)
        .where(eq(processingOutputs.sessionId, input.sessionId));

      // 1. Reverse tank deductions — add milk back
      for (const inp of inputs) {
        const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, inp.tankId)).limit(1);
        if (tank) {
          const newVolume = tank.currentVolumeMl + inp.volumeMl;
          await db.update(milkTanks)
            .set({
              currentVolumeMl: newVolume,
              status: newVolume > 0 ? "filling" : "empty",
            })
            .where(eq(milkTanks.id, inp.tankId));

          // Create reversal tank movement
          await db.insert(milkTankMovements).values({
            tankId: inp.tankId,
            movementType: "adjustment",
            volumeMl: inp.volumeMl,
            tankVolumeAfterMl: newVolume,
            performedByWorkerId: worker.workerId,
            note: `Откат переработки: сессия ${session.sessionCode}`,
          });
        }
      }

      // 2. Reverse warehouse credits
      for (const out of outputs) {
        const [inv] = await db
          .select()
          .from(warehouseInventory)
          .where(
            and(
              eq(warehouseInventory.warehouseId, out.warehouseId),
              eq(warehouseInventory.catalogItemId, out.catalogItemId),
            ),
          )
          .limit(1);

        if (inv) {
          const newQty = Math.max(0, inv.quantity - out.quantity);
          await db.update(warehouseInventory)
            .set({ quantity: newQty })
            .where(eq(warehouseInventory.id, inv.id));
        }
      }

      // 3. Delete warehouse movements for this session
      await db.delete(warehouseMovements)
        .where(eq(warehouseMovements.processingSessionId, input.sessionId));

      // 4. Reset conversion data on outputs
      for (const out of outputs) {
        await db.update(processingOutputs)
          .set({
            actualConversionRatio: null,
            baseConversionRatio: null,
            deviationPercent: null,
          })
          .where(eq(processingOutputs.id, out.id));
      }

      // 5. Set session back to in_progress
      await db.update(processingSessions)
        .set({ status: "in_progress", completedAt: null })
        .where(eq(processingSessions.id, input.sessionId));

      await logMilkAudit({
        action: "processing_session_corrected",
        workerId: worker.workerId,
        entityType: "processing_session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({ sessionCode: session.sessionCode }),
      });

      return { success: true };
    }),

  /**
   * List available products from tierProductCatalog for output selection.
   */
  catalogItems: cheesemakerProcedure.query(async () => {
    const db = await getDb();
    return db
      .select({
        id: tierProductCatalog.id,
        productType: tierProductCatalog.productType,
        label: tierProductCatalog.label,
        species: tierProductCatalog.species,
        conversionRatio: tierProductCatalog.conversionRatio,
        unit: tierProductCatalog.unit,
      })
      .from(tierProductCatalog)
      .where(eq(tierProductCatalog.isEnabled, 1))
      .orderBy(asc(tierProductCatalog.sortOrder));
  }),

  /**
   * List active warehouses for product destination selection.
   */
  activeWarehouses: cheesemakerProcedure.query(async () => {
    const db = await getDb();
    return db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        description: warehouses.description,
      })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.name));
  }),

  /**
   * List active tanks with current volume for input selection.
   */
  activeTanks: cheesemakerProcedure.query(async () => {
    const db = await getDb();
    return db
      .select({
        id: milkTanks.id,
        name: milkTanks.name,
        milkType: milkTanks.milkType,
        capacityMl: milkTanks.capacityMl,
        currentVolumeMl: milkTanks.currentVolumeMl,
        status: milkTanks.status,
      })
      .from(milkTanks)
      .where(eq(milkTanks.isActive, true))
      .orderBy(asc(milkTanks.name));
  }),
});
