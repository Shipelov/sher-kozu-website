import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listAlertHistory,
  getMetricForWindow,
  recordAlertTrigger,
} from "../db";
import { notifyOwner } from "../_core/notification";

/* ── Zod schemas ── */

const createRuleInput = z.object({
  name: z.string().min(1).max(256),
  metric: z.enum(["page_views", "unique_visitors", "sessions", "bounce_rate", "avg_time"]),
  operator: z.enum(["gt", "lt", "change_pct_up", "change_pct_down"]),
  threshold: z.number().min(0),
  windowHours: z.number().int().min(1).max(720).default(24),
  enabled: z.boolean().default(true),
});

const updateRuleInput = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(256).optional(),
  metric: z.enum(["page_views", "unique_visitors", "sessions", "bounce_rate", "avg_time"]).optional(),
  operator: z.enum(["gt", "lt", "change_pct_up", "change_pct_down"]).optional(),
  threshold: z.number().min(0).optional(),
  windowHours: z.number().int().min(1).max(720).optional(),
  enabled: z.boolean().optional(),
});

/* ── Metric labels for notifications ── */

const METRIC_LABELS: Record<string, string> = {
  page_views: "Просмотры страниц",
  unique_visitors: "Уникальные посетители",
  sessions: "Сессии",
  bounce_rate: "Показатель отказов (%)",
  avg_time: "Среднее время на странице (сек)",
};

const OPERATOR_LABELS: Record<string, string> = {
  gt: "превышает",
  lt: "ниже",
  change_pct_up: "вырос на %",
  change_pct_down: "упал на %",
};

/* ── Router ── */

export const analyticsAlertsRouter = router({
  listRules: adminProcedure.query(async () => {
    return listAlertRules();
  }),

  createRule: adminProcedure.input(createRuleInput).mutation(async ({ input, ctx }) => {
    return createAlertRule({ ...input, createdBy: ctx.user.openId });
  }),

  updateRule: adminProcedure.input(updateRuleInput).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await updateAlertRule(id, data);
    return { success: true };
  }),

  deleteRule: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    await deleteAlertRule(input.id);
    return { success: true };
  }),

  history: adminProcedure.input(z.object({
    limit: z.number().int().min(1).max(200).default(50),
  }).optional()).query(async ({ input }) => {
    return listAlertHistory(input?.limit ?? 50);
  }),

  /** Manual trigger to check all rules now (admin can click a button) */
  checkNow: adminProcedure.mutation(async () => {
    return runAnomalyCheck();
  }),
});

/**
 * Core anomaly detection logic.
 * Compares current window vs previous window for each active rule.
 */
export async function runAnomalyCheck(): Promise<{ checked: number; triggered: number }> {
  const rules = await listAlertRules();
  const activeRules = rules.filter((r: { enabled: boolean }) => r.enabled);
  let triggered = 0;

  for (const rule of activeRules) {
    try {
      const now = new Date();
      const windowMs = rule.windowHours * 60 * 60 * 1000;
      const currentFrom = new Date(now.getTime() - windowMs);
      const previousFrom = new Date(currentFrom.getTime() - windowMs);

      const currentValue = await getMetricForWindow(rule.metric, currentFrom, now);
      const previousValue = await getMetricForWindow(rule.metric, previousFrom, currentFrom);

      let shouldTrigger = false;
      let changePct: number | null = null;
      let message = "";

      const metricLabel = METRIC_LABELS[rule.metric] || rule.metric;
      const opLabel = OPERATOR_LABELS[rule.operator] || rule.operator;

      switch (rule.operator) {
        case "gt":
          shouldTrigger = currentValue > rule.threshold;
          message = `${metricLabel} = ${currentValue} ${opLabel} порог ${rule.threshold}`;
          break;
        case "lt":
          shouldTrigger = currentValue < rule.threshold;
          message = `${metricLabel} = ${currentValue} ${opLabel} порога ${rule.threshold}`;
          break;
        case "change_pct_up":
          if (previousValue > 0) {
            changePct = ((currentValue - previousValue) / previousValue) * 100;
            shouldTrigger = changePct > rule.threshold;
            message = `${metricLabel} ${opLabel} ${changePct.toFixed(1)}% (${previousValue} → ${currentValue}), порог ${rule.threshold}%`;
          }
          break;
        case "change_pct_down":
          if (previousValue > 0) {
            changePct = ((previousValue - currentValue) / previousValue) * 100;
            shouldTrigger = changePct > rule.threshold;
            message = `${metricLabel} ${opLabel} ${changePct.toFixed(1)}% (${previousValue} → ${currentValue}), порог ${rule.threshold}%`;
          }
          break;
      }

      if (shouldTrigger) {
        triggered++;
        const alertData = {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          currentValue,
          previousValue: previousValue || null,
          changePct: changePct ?? null,
          message,
          notified: false,
        };

        await recordAlertTrigger(alertData);

        // Send notification to owner
        try {
          const sent = await notifyOwner({
            title: `⚠️ Аномалия: ${rule.name}`,
            content: `${message}\n\nПравило: ${rule.name}\nМетрика: ${metricLabel}\nОкно: ${rule.windowHours}ч`,
          });
          if (sent) {
            // Update the alert history to mark as notified
            // (best-effort, no need to fail the whole check)
          }
        } catch {
          console.warn(`[Analytics Alerts] Failed to notify for rule ${rule.id}`);
        }
      }
    } catch (err) {
      console.error(`[Analytics Alerts] Error checking rule ${rule.id}:`, err);
    }
  }

  return { checked: activeRules.length, triggered };
}
