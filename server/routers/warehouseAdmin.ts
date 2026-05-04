/**
 * Warehouse Admin tRPC Router.
 *
 * Admin-only CRUD for warehouses and warehouse inventory management.
 * Also provides warehouse movement history and manual adjustments.
 *
 * Endpoints:
 * - warehouseAdmin.list — list all warehouses with inventory summary
 * - warehouseAdmin.create — create a new warehouse
 * - warehouseAdmin.update — update warehouse name/description/active
 * - warehouseAdmin.delete — soft-delete (deactivate) a warehouse
 * - warehouseAdmin.inventory — inventory for a specific warehouse
 * - warehouseAdmin.movements — movement history (paginated)
 * - warehouseAdmin.adjustInventory — manual inventory adjustment
 * - warehouseAdmin.writeoff — write off inventory (spoilage, etc.)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import {
  warehouses,
  warehouseInventory,
  warehouseMovements,
  processingSessions,
  processingInputs,
  processingOutputs,
  farmWorkers,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { logMilkAudit } from "../farmAuth";

export const warehouseAdminRouter = router({
  /**
   * List all warehouses with inventory item count.
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();

    const whs = await db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        description: warehouses.description,
        isActive: warehouses.isActive,
        createdAt: warehouses.createdAt,
        updatedAt: warehouses.updatedAt,
      })
      .from(warehouses)
      .orderBy(asc(warehouses.name));

    // Get inventory counts per warehouse
    const inventoryCounts = await db
      .select({
        warehouseId: warehouseInventory.warehouseId,
        itemCount: sql<number>`COUNT(*)`,
        totalItems: sql<number>`COALESCE(SUM(${warehouseInventory.quantity}), 0)`,
      })
      .from(warehouseInventory)
      .where(sql`${warehouseInventory.quantity} > 0`)
      .groupBy(warehouseInventory.warehouseId);

    const countMap = new Map(inventoryCounts.map((c: any) => [c.warehouseId, c]));

    return whs.map((wh: any) => {
      const counts = countMap.get(wh.id) as any;
      return {
        ...wh,
        itemCount: Number(counts?.itemCount ?? 0),
        totalItems: Number(counts?.totalItems ?? 0),
      };
    });
  }),

  /**
   * Create a new warehouse.
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(160),
        description: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [result] = await db.insert(warehouses).values({
        name: input.name,
        description: input.description ?? null,
        isActive: true,
      });

      await logMilkAudit({
        action: "warehouse_created",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "warehouse",
        entityId: result.insertId,
        detailsJson: JSON.stringify({ name: input.name }),
      });

      return { id: result.insertId, name: input.name };
    }),

  /**
   * Update a warehouse.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(2).max(160).optional(),
        description: z.string().max(1000).optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нечего обновлять" });
      }

      await db.update(warehouses).set(updates).where(eq(warehouses.id, input.id));

      await logMilkAudit({
        action: "warehouse_updated",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "warehouse",
        entityId: input.id,
        detailsJson: JSON.stringify(updates),
      });

      return { success: true };
    }),

  /**
   * Inventory for a specific warehouse.
   */
  inventory: adminProcedure
    .input(z.object({ warehouseId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();

      return db
        .select({
          id: warehouseInventory.id,
          catalogItemId: warehouseInventory.catalogItemId,
          productLabel: warehouseInventory.productLabel,
          quantity: warehouseInventory.quantity,
          unit: warehouseInventory.unit,
          updatedAt: warehouseInventory.updatedAt,
        })
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, input.warehouseId))
        .orderBy(asc(warehouseInventory.productLabel));
    }),

  /**
   * Movement history for a warehouse (paginated).
   */
  movements: adminProcedure
    .input(
      z.object({
        warehouseId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const [movements, [countResult]] = await Promise.all([
        db
          .select({
            id: warehouseMovements.id,
            movementType: warehouseMovements.movementType,
            productLabel: warehouseMovements.productLabel,
            quantity: warehouseMovements.quantity,
            unit: warehouseMovements.unit,
            processingSessionId: warehouseMovements.processingSessionId,
            note: warehouseMovements.note,
            createdAt: warehouseMovements.createdAt,
            workerName: farmWorkers.name,
            sessionCode: processingSessions.sessionCode,
          })
          .from(warehouseMovements)
          .leftJoin(farmWorkers, eq(warehouseMovements.performedByWorkerId, farmWorkers.id))
          .leftJoin(processingSessions, eq(warehouseMovements.processingSessionId, processingSessions.id))
          .where(eq(warehouseMovements.warehouseId, input.warehouseId))
          .orderBy(desc(warehouseMovements.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(warehouseMovements)
          .where(eq(warehouseMovements.warehouseId, input.warehouseId)),
      ]);

      return { movements, total: Number(countResult?.count ?? 0) };
    }),

  /**
   * Manual inventory adjustment (admin only).
   * Used for corrections after physical inventory count.
   */
  adjustInventory: adminProcedure
    .input(
      z.object({
        warehouseId: z.number().int().positive(),
        catalogItemId: z.number().int().positive(),
        productLabel: z.string().min(1).max(160),
        newQuantity: z.number().min(0),
        unit: z.string().min(1).max(16),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Find or create inventory record
      const [existing] = await db
        .select()
        .from(warehouseInventory)
        .where(
          and(
            eq(warehouseInventory.warehouseId, input.warehouseId),
            eq(warehouseInventory.catalogItemId, input.catalogItemId),
          ),
        )
        .limit(1);

      const oldQuantity = existing?.quantity ?? 0;
      const diff = input.newQuantity - oldQuantity;

      if (existing) {
        await db.update(warehouseInventory)
          .set({ quantity: input.newQuantity })
          .where(eq(warehouseInventory.id, existing.id));
      } else {
        await db.insert(warehouseInventory).values({
          warehouseId: input.warehouseId,
          catalogItemId: input.catalogItemId,
          productLabel: input.productLabel,
          quantity: input.newQuantity,
          unit: input.unit,
        });
      }

      // Create movement record for audit trail
      // Use a dummy workerId of 0 for admin adjustments
      await db.insert(warehouseMovements).values({
        warehouseId: input.warehouseId,
        movementType: "adjustment",
        catalogItemId: input.catalogItemId,
        productLabel: input.productLabel,
        quantity: diff,
        unit: input.unit,
        performedByWorkerId: 0, // admin
        note: input.note ?? `Корректировка: ${oldQuantity} → ${input.newQuantity}`,
      });

      await logMilkAudit({
        action: "warehouse_movement",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "warehouse_inventory",
        entityId: existing?.id ?? 0,
        detailsJson: JSON.stringify({
          warehouseId: input.warehouseId,
          catalogItemId: input.catalogItemId,
          oldQuantity,
          newQuantity: input.newQuantity,
          diff,
        }),
      });

      return { success: true, diff };
    }),

  /**
   * Write off inventory (spoilage, expiry, etc.).
   */
  writeoff: adminProcedure
    .input(
      z.object({
        warehouseId: z.number().int().positive(),
        catalogItemId: z.number().int().positive(),
        productLabel: z.string().min(1).max(160),
        quantity: z.number().positive(),
        unit: z.string().min(1).max(16),
        note: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [existing] = await db
        .select()
        .from(warehouseInventory)
        .where(
          and(
            eq(warehouseInventory.warehouseId, input.warehouseId),
            eq(warehouseInventory.catalogItemId, input.catalogItemId),
          ),
        )
        .limit(1);

      if (!existing || existing.quantity < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Недостаточно на складе: ${existing?.quantity ?? 0} ${input.unit}`,
        });
      }

      const newQty = existing.quantity - input.quantity;
      await db.update(warehouseInventory)
        .set({ quantity: newQty })
        .where(eq(warehouseInventory.id, existing.id));

      await db.insert(warehouseMovements).values({
        warehouseId: input.warehouseId,
        movementType: "writeoff",
        catalogItemId: input.catalogItemId,
        productLabel: input.productLabel,
        quantity: -input.quantity,
        unit: input.unit,
        performedByWorkerId: 0, // admin
        note: input.note,
      });

      await logMilkAudit({
        action: "warehouse_movement",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "warehouse_inventory",
        entityId: existing.id,
        detailsJson: JSON.stringify({
          type: "writeoff",
          warehouseId: input.warehouseId,
          catalogItemId: input.catalogItemId,
          quantity: input.quantity,
          reason: input.note,
        }),
      });

      return { success: true, newQuantity: newQty };
    }),

  /**
   * Processing sessions overview for admin (read-only, all sessions).
   */
  processingSessions: adminProcedure
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
   * Conversion coefficient analytics — deviations from base ratios.
   * Returns all completed sessions with their output conversion data.
   */
  conversionAnalytics: adminProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        deviationThreshold: z.number().default(15), // alert if deviation > 15%
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions: any[] = [eq(processingSessions.status, "completed")];
      if (input?.dateFrom) conditions.push(sql`${processingSessions.shiftDate} >= ${input.dateFrom}`);
      if (input?.dateTo) conditions.push(sql`${processingSessions.shiftDate} <= ${input.dateTo}`);

      const sessions = await db
        .select({
          sessionId: processingSessions.id,
          sessionCode: processingSessions.sessionCode,
          shiftDate: processingSessions.shiftDate,
          totalInputMl: processingSessions.totalInputMl,
          workerName: farmWorkers.name,
        })
        .from(processingSessions)
        .leftJoin(farmWorkers, eq(processingSessions.startedByWorkerId, farmWorkers.id))
        .where(and(...conditions))
        .orderBy(desc(processingSessions.shiftDate));

      if (sessions.length === 0) return { sessions: [], alerts: [] };

      const sessionIds = sessions.map((s: any) => s.sessionId);

      const outputs = await db
        .select({
          sessionId: processingOutputs.sessionId,
          productLabel: processingOutputs.productLabel,
          quantity: processingOutputs.quantity,
          unit: processingOutputs.unit,
          actualConversionRatio: processingOutputs.actualConversionRatio,
          baseConversionRatio: processingOutputs.baseConversionRatio,
          deviationPercent: processingOutputs.deviationPercent,
        })
        .from(processingOutputs)
        .where(inArray(processingOutputs.sessionId, sessionIds));

      // Group outputs by session
      const outputsBySession = new Map<number, typeof outputs>();
      for (const out of outputs) {
        const arr = outputsBySession.get(out.sessionId) ?? [];
        arr.push(out);
        outputsBySession.set(out.sessionId, arr);
      }

      const threshold = input?.deviationThreshold ?? 15;
      const alerts: Array<{
        sessionCode: string;
        shiftDate: string;
        productLabel: string;
        deviationPercent: number;
        actualRatio: number;
        baseRatio: number;
      }> = [];

      const enrichedSessions = sessions.map((s: any) => {
        const outs = outputsBySession.get(s.sessionId) ?? [];
        for (const out of outs) {
          if (out.deviationPercent !== null && Math.abs(out.deviationPercent) > threshold) {
            alerts.push({
              sessionCode: s.sessionCode,
              shiftDate: s.shiftDate,
              productLabel: out.productLabel,
              deviationPercent: out.deviationPercent,
              actualRatio: out.actualConversionRatio ?? 0,
              baseRatio: out.baseConversionRatio ?? 0,
            });
          }
        }
        return { ...s, outputs: outs };
      });

      return { sessions: enrichedSessions, alerts };
    }),

  /**
   * Delete a cancelled processing session permanently (admin only).
   */
  deleteProcessingSession: adminProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

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
        workerId: ctx.user.openId,
        entityType: "processing_session",
        entityId: input.sessionId,
        details: "Admin permanently deleted cancelled session",
      });

      return { success: true };
    }),
});
