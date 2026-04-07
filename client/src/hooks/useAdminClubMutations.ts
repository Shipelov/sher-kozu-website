import {
  type PendingDeleteState,
} from "@/pages/adminClubShared";
import {
  buildCriticalNotificationPayload,
  recordAdminAction,
  recordCriticalNotificationHistory,
  shouldSendCriticalNotification,
  type AdminActionLogEntry,
  type AdminActionType,
  type AdminTabValue,
  type CriticalNotificationHistoryEntry,
  type CriticalNotificationSettings,
} from "@/lib/adminClubActivity";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";

interface MutationDeps {
  setPendingDelete: Dispatch<SetStateAction<PendingDeleteState>>;
  setActionLog: Dispatch<SetStateAction<AdminActionLogEntry[]>>;
  setCriticalNotificationHistory: Dispatch<SetStateAction<CriticalNotificationHistoryEntry[]>>;
  criticalNotificationSettings: CriticalNotificationSettings;
  setPresetName: Dispatch<SetStateAction<Record<"posts" | "events" | "members", string>>>;
}

export function useAdminClubMutations(deps: MutationDeps) {
  const {
    setPendingDelete,
    setActionLog,
    setCriticalNotificationHistory,
    criticalNotificationSettings,
    setPresetName,
  } = deps;

  const utils = trpc.useUtils();

  const refreshAdminData = async () => {
    await Promise.all([
      utils.adminClub.dashboard.invalidate(),
      utils.club.feed.invalidate(),
      Promise.resolve(),
    ]);
  };

  // ── Critical notification helper ──
  const notifyCriticalAction = trpc.system.notifyOwner.useMutation({
    onError: (error: unknown) => {
      toast.error("Критическое уведомление не отправлено", {
        description: error instanceof Error ? error.message : "Повторите попытку позже.",
      });
    },
  });

  const processCriticalAdminNotification = async (
    area: AdminTabValue,
    actionType: AdminActionType,
    title: string,
    description: string,
    affectedCount?: number,
  ) => {
    setActionLog((current) => recordAdminAction(current, area, actionType, title, description));

    const decision = shouldSendCriticalNotification({
      area,
      actionType,
      title,
      description,
      affectedCount,
    }, criticalNotificationSettings);

    if (!decision.shouldNotify) {
      return;
    }

    const actorLabel = "Администратор фермы";
    const payload = buildCriticalNotificationPayload({
      area,
      actionType,
      title,
      description,
      affectedCount,
    }, decision, actorLabel);

    const result = await notifyCriticalAction.mutateAsync(payload);

    if (area === "posts" || area === "events" || area === "members") {
      setCriticalNotificationHistory((current) => recordCriticalNotificationHistory(current, {
        area,
        actionType,
        title,
        description,
        affectedCount,
      }, decision, actorLabel, result.success));
    }

    toast[decision.severityLabel === "high" ? "warning" : "info"]("Критическое уведомление отправлено", {
      description: result.success
        ? `Оповещение зафиксировано для действия «${title}».`
        : `Действие «${title}» помечено как критическое, но канал уведомлений временно недоступен.`,
    });
  };

  // ── Bitrix mutations ──
  const retryLeadSync = trpc.bitrixAdmin.retryLeadSync.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setActionLog((current) => recordAdminAction(current, "bitrix", "sync", "Повторная синхронизация Bitrix24", `Заявка #${variables.leadId ?? "?"} повторно отправлена в CRM.`));
      toast.success("Повторная синхронизация запущена", {
        description: `Заявка #${variables.leadId ?? "?"} повторно отправлена в Bitrix24 CRM.`,
      });
    },
    onError: (error: unknown) => {
      toast.error("Не удалось повторить синхронизацию", {
        description: error instanceof Error ? error.message : "Повторите попытку позже.",
      });
    },
  });

  const refreshDealSnapshot = async (dealId: string, leadId?: number | null) => {
    try {
      await utils.bitrixAdmin.dealSnapshot.fetch({ dealId, leadId: leadId ?? undefined });
      await refreshAdminData();
      setActionLog((current) => recordAdminAction(current, "bitrix", "refresh", "Обновлён snapshot сделки", `Для заявки #${leadId ?? "?"} обновлён статус сделки и следующей активности.`));
      toast.success("Snapshot сделки обновлён", {
        description: `Bitrix24 snapshot для заявки #${leadId ?? "?"} успешно обновлён.`,
      });
    } catch (error) {
      toast.error("Не удалось обновить snapshot сделки", {
        description: error instanceof Error ? error.message : "Повторите попытку позже.",
      });
    }
  };

  // ── Post mutations ──
  const createPost = trpc.adminClub.createPost.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пост создан", {
        description: `Материал «${variables.title || "Без названия"}» опубликован в клубной ленте.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось создать пост", { description: error.message });
    },
  });

  const updatePost = trpc.adminClub.updatePost.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пост сохранён", {
        description: `Изменения для поста «${variables.title || "Без названия"}» успешно записаны.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить пост", { description: error.message });
    },
  });

  const deletePost = trpc.adminClub.deletePost.useMutation({
    onSuccess: async () => {
      setPendingDelete((current) => {
        const deletedTitle = current?.title ?? "выбранный пост";
        toast.success("Пост удалён", {
          description: `Материал «${deletedTitle}» убран из клубной ленты.`,
        });
        return null;
      });
      await refreshAdminData();
    },
    onError: (error) => {
      toast.error("Не удалось удалить пост", { description: error.message });
    },
  });

  // ── Event mutations ──
  const createEvent = trpc.adminClub.createEvent.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Событие создано", {
        description: `Карточка «${variables.title || "Без названия"}» добавлена в Club Feed.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось создать событие", { description: error.message });
    },
  });

  const updateEvent = trpc.adminClub.updateEvent.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Событие сохранено", {
        description: `Изменения для события «${variables.title || "Без названия"}» успешно применены.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить событие", { description: error.message });
    },
  });

  const deleteEvent = trpc.adminClub.deleteEvent.useMutation({
    onSuccess: async () => {
      setPendingDelete((current) => {
        const deletedTitle = current?.title ?? "выбранное событие";
        toast.success("Событие удалено", {
          description: `Карточка «${deletedTitle}» убрана из расписания клуба.`,
        });
        return null;
      });
      await refreshAdminData();
    },
    onError: (error) => {
      toast.error("Не удалось удалить событие", { description: error.message });
    },
  });

  // ── Member mutations ──
  const createMember = trpc.adminClub.createMember.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Участник добавлен", {
        description: `Профиль «${variables.name || "Без имени"}» появился в составе клуба.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось добавить участника", { description: error.message });
    },
  });

  const updateMember = trpc.adminClub.updateMember.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Участник сохранён", {
        description: `Изменения для профиля «${variables.name || "Без имени"}» успешно записаны.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить участника", { description: error.message });
    },
  });

  const deleteMember = trpc.adminClub.deleteMember.useMutation({
    onSuccess: async () => {
      setPendingDelete((current) => {
        const deletedTitle = current?.title ?? "выбранный участник";
        toast.success("Участник удалён", {
          description: `Профиль «${deletedTitle}» убран из клубного состава.`,
        });
        return null;
      });
      await refreshAdminData();
    },
    onError: (error) => {
      toast.error("Не удалось удалить участника", { description: error.message });
    },
  });

  // ── Bulk mutations ──
  const bulkHidePosts = trpc.adminClub.bulkHidePosts.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      const label = variables.hidden ? "скрыто" : "показано";
      toast.success(`${variables.ids.length} постов ${label}`, {
        description: variables.hidden
          ? "Выбранные посты больше не видны в публичной ленте."
          : "Выбранные посты снова видны в публичной ленте.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось изменить видимость постов", { description: error.message });
    },
  });

  const bulkDeletePosts = trpc.adminClub.bulkDeletePosts.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setPendingDelete(null);
      toast.success(`${variables.ids.length} постов удалено`, {
        description: "Выбранные посты безвозвратно удалены.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить посты", { description: error.message });
    },
  });

  const bulkHideEvents = trpc.adminClub.bulkHideEvents.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      const label = variables.hidden ? "скрыто" : "показано";
      toast.success(`${variables.ids.length} событий ${label}`, {
        description: variables.hidden
          ? "Выбранные события больше не видны в публичной ленте."
          : "Выбранные события снова видны в публичной ленте.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось изменить видимость событий", { description: error.message });
    },
  });

  const bulkDeleteEvents = trpc.adminClub.bulkDeleteEvents.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setPendingDelete(null);
      toast.success(`${variables.ids.length} событий удалено`, {
        description: "Выбранные события безвозвратно удалены.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить события", { description: error.message });
    },
  });

  const bulkHideMembers = trpc.adminClub.bulkHideMembers.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      const label = variables.hidden ? "скрыто" : "показано";
      toast.success(`${variables.ids.length} участников ${label}`, {
        description: variables.hidden
          ? "Выбранные участники больше не видны в публичной ленте."
          : "Выбранные участники снова видны в публичной ленте.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось изменить видимость участников", { description: error.message });
    },
  });

  const bulkDeleteMembers = trpc.adminClub.bulkDeleteMembers.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setPendingDelete(null);
      toast.success(`${variables.ids.length} участников удалено`, {
        description: "Выбранные участники безвозвратно удалены.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить участников", { description: error.message });
    },
  });

  // ── Preset mutations ──
  const createPreset = trpc.adminClub.createPreset.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setPresetName((current) => ({ ...current, [variables.tab]: "" }));
      toast.success("Пресет сохранён", {
        description: `Набор «${variables.name}» теперь доступен для вкладки ${variables.tab}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить пресет", { description: error.message });
    },
  });

  const deletePreset = trpc.adminClub.deletePreset.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пресет удалён", {
        description: `Сохранённый набор #${variables.id} удалён из панели.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить пресет", { description: error.message });
    },
  });

  return {
    refreshAdminData,
    processCriticalAdminNotification,
    retryLeadSync,
    refreshDealSnapshot,
    createPost, updatePost, deletePost,
    createEvent, updateEvent, deleteEvent,
    createMember, updateMember, deleteMember,
    bulkHidePosts, bulkDeletePosts,
    bulkHideEvents, bulkDeleteEvents,
    bulkHideMembers, bulkDeleteMembers,
    createPreset, deletePreset,
  };
}

export type AdminClubMutations = ReturnType<typeof useAdminClubMutations>;
