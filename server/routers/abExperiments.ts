import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  listExperiments,
  getExperimentById,
  createExperiment,
  updateExperiment,
  deleteExperiment,
  listVariants,
  countVariantsByExperimentIds,
  createVariant,
  deleteVariant,
  getOrAssignVariant,
  recordConversion,
  getExperimentResults,
  getActiveExperimentsForPage,
} from "../db";

/* ── Zod schemas ── */

const createExperimentInput = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  targetPage: z.string().min(1).max(512),
  goalEvent: z.string().min(1).max(256),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateExperimentInput = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "running", "paused", "completed"]).optional(),
  targetPage: z.string().min(1).max(512).optional(),
  goalEvent: z.string().min(1).max(256).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const createVariantInput = z.object({
  experimentId: z.number().int(),
  variantKey: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  weight: z.number().int().min(0).max(100).default(50),
  config: z.string().optional(),
});

/* ── Router ── */

export const abExperimentsRouter = router({
  /* ─── Admin endpoints ─── */

  list: adminProcedure.query(async () => {
    const experiments = await listExperiments();
    // Один запрос по всем экспериментам вместо N параллельных соединений
    const variantCounts = await countVariantsByExperimentIds(
      experiments.map((exp: { id: number }) => exp.id),
    );
    return experiments.map((exp: { id: number }) => ({
      ...exp,
      variantCount: variantCounts.get(exp.id) ?? 0,
    }));
  }),

  getById: adminProcedure.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const experiment = await getExperimentById(input.id);
    if (!experiment) return null;
    const variants = await listVariants(input.id);
    const results = await getExperimentResults(input.id);
    return { ...experiment, variants, results };
  }),

  create: adminProcedure.input(createExperimentInput).mutation(async ({ input, ctx }) => {
    const result = await createExperiment({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      createdBy: ctx.user.openId,
    });
    return result;
  }),

  update: adminProcedure.input(updateExperimentInput).mutation(async ({ input }) => {
    const { id, ...data } = input;
    const updateData: Record<string, unknown> = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    await updateExperiment(id, updateData as any);
    return { success: true };
  }),

  delete: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    await deleteExperiment(input.id);
    return { success: true };
  }),

  addVariant: adminProcedure.input(createVariantInput).mutation(async ({ input }) => {
    return createVariant(input);
  }),

  removeVariant: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    await deleteVariant(input.id);
    return { success: true };
  }),

  results: adminProcedure.input(z.object({ experimentId: z.number().int() })).query(async ({ input }) => {
    return getExperimentResults(input.experimentId);
  }),

  /* ─── Public endpoints (called from client for variant assignment) ─── */

  /** Get active experiments for a given page */
  activeForPage: publicProcedure.input(z.object({
    pagePath: z.string(),
    visitorId: z.string(),
    sessionId: z.string(),
  })).query(async ({ input }) => {
    const experiments = await getActiveExperimentsForPage(input.pagePath);
    // Assign visitor to each experiment
    const assignments = await Promise.all(
      experiments.map(async (exp: { id: number; name: string; goalEvent: string }) => {
        const { variant } = await getOrAssignVariant(exp.id, input.visitorId, input.sessionId);
        return {
          experimentId: exp.id,
          experimentName: exp.name,
          goalEvent: exp.goalEvent,
          variantKey: variant?.variantKey ?? "control",
          variantLabel: variant?.label ?? "Контроль",
          config: variant?.config ? JSON.parse(variant.config) : null,
        };
      })
    );
    return assignments;
  }),

  /** Record a conversion event */
  recordConversion: publicProcedure.input(z.object({
    experimentId: z.number().int(),
    visitorId: z.string(),
  })).mutation(async ({ input }) => {
    await recordConversion(input.experimentId, input.visitorId);
    return { success: true };
  }),
});
