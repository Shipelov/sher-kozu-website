export type EntityAdminTabValue = "posts" | "events" | "members";
export type AdminTabValue = EntityAdminTabValue | "activity";
export type AdminActionType = "create" | "update" | "delete" | "bulk" | "preset";

export type AdminActionLogEntry = {
  id: number;
  timestamp: number;
  area: AdminTabValue;
  actionType: AdminActionType;
  title: string;
  description: string;
};

export type CriticalNotificationRule = {
  actionType: AdminActionType;
  area: EntityAdminTabValue | "all";
  minAffectedCount: number;
};

export type CriticalNotificationSettings = {
  enabled: boolean;
  notifyOnDelete: boolean;
  notifyOnBulk: boolean;
  notifyOnPreset: boolean;
  minBulkCount: number;
};

export type CriticalNotificationCandidate = {
  area: AdminTabValue;
  actionType: AdminActionType;
  title: string;
  description: string;
  affectedCount?: number;
};

export type CriticalNotificationDecision = {
  shouldNotify: boolean;
  severityLabel: "high" | "medium";
  reason: string;
};

export const defaultCriticalNotificationSettings = (): CriticalNotificationSettings => ({
  enabled: true,
  notifyOnDelete: true,
  notifyOnBulk: true,
  notifyOnPreset: false,
  minBulkCount: 3,
});

export function recordAdminAction(
  currentLog: AdminActionLogEntry[],
  area: AdminTabValue,
  actionType: AdminActionType,
  title: string,
  description: string,
  now = Date.now(),
) {
  return [
    {
      id: now + currentLog.length,
      timestamp: now,
      area,
      actionType,
      title,
      description,
    },
    ...currentLog,
  ].slice(0, 6);
}

export function shouldSendCriticalNotification(
  candidate: CriticalNotificationCandidate,
  settings: CriticalNotificationSettings,
): CriticalNotificationDecision {
  if (!settings.enabled) {
    return { shouldNotify: false, severityLabel: "medium", reason: "Уведомления отключены в настройках." };
  }

  if (candidate.area === "activity") {
    return { shouldNotify: false, severityLabel: "medium", reason: "Служебная вкладка журнала не порождает отдельные критические уведомления." };
  }

  if (candidate.actionType === "delete" && settings.notifyOnDelete) {
    return { shouldNotify: true, severityLabel: "high", reason: "Удаление считается критически важным действием." };
  }

  if (candidate.actionType === "bulk" && settings.notifyOnBulk) {
    const affectedCount = candidate.affectedCount ?? 0;
    if (affectedCount >= settings.minBulkCount) {
      return {
        shouldNotify: true,
        severityLabel: affectedCount >= Math.max(settings.minBulkCount + 2, 5) ? "high" : "medium",
        reason: `Массовая операция затронула ${affectedCount} записей, что не ниже порога ${settings.minBulkCount}.`,
      };
    }

    return {
      shouldNotify: false,
      severityLabel: "medium",
      reason: `Массовая операция затронула ${affectedCount} записей — это ниже порога ${settings.minBulkCount}.`,
    };
  }

  if (candidate.actionType === "preset" && settings.notifyOnPreset) {
    return { shouldNotify: true, severityLabel: "medium", reason: "Уведомления о пресетах включены вручную." };
  }

  return { shouldNotify: false, severityLabel: "medium", reason: "Это действие не входит в набор критических правил." };
}

export function buildCriticalNotificationPayload(
  candidate: CriticalNotificationCandidate,
  decision: CriticalNotificationDecision,
  actorLabel: string,
) {
  const affectedLine = candidate.affectedCount ? `\nЗатронуто записей: ${candidate.affectedCount}.` : "";

  return {
    title: `[Admin Club][${decision.severityLabel.toUpperCase()}] ${candidate.title}`,
    content: [
      `Администратор: ${actorLabel}.`,
      `Область: ${candidate.area}.`,
      `Тип действия: ${candidate.actionType}.`,
      `Причина критичности: ${decision.reason}`,
      `Описание: ${candidate.description}.${affectedLine}`,
    ].join("\n"),
  };
}
