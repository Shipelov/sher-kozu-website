import type { ZoyaAssembledContext } from "./zoyaContextAssembler";

const FIELD_LABELS: Record<string, string> = {
  profileName: "имя профиля",
  relationship: "для кого составляется рацион",
  gender: "пол",
  birthDate: "дату рождения",
  heightCm: "рост",
  weightKg: "вес",
  goals: "цель питания",
  activityLevel: "уровень активности",
  allergies: "аллергии или подтверждение их отсутствия",
  restrictions: "ограничения или подтверждение их отсутствия",
};

export type ZoyaProfileGateMeta = {
  status: ZoyaAssembledContext["status"];
  activeProfileId: number | null;
  activeProfileName: string | null;
  profileComplete: boolean;
  profileNeedsReview: boolean;
  missingFields: string[];
  actions: Array<"login" | "create_profile" | "edit_profile" | "confirm_profile" | "switch_profile">;
};

export function buildZoyaProfileGateMeta(context: ZoyaAssembledContext): ZoyaProfileGateMeta {
  const actions: ZoyaProfileGateMeta["actions"] = [];
  if (context.status === "needs_authentication") actions.push("login");
  if (context.status === "needs_profile") actions.push("create_profile");
  if (context.status === "needs_profile_completion") actions.push("edit_profile", "switch_profile");
  if (context.status === "needs_profile_confirmation") actions.push("confirm_profile", "edit_profile", "switch_profile");

  return {
    status: context.status,
    activeProfileId: context.profile?.id ?? null,
    activeProfileName: context.profile?.profileName ?? null,
    profileComplete: context.profileRequirements?.isComplete ?? false,
    profileNeedsReview: context.profileRequirements?.needsReview ?? false,
    missingFields: context.pendingClarifications,
    actions,
  };
}

export function buildZoyaProfileGateReply(context: ZoyaAssembledContext): string | null {
  if (context.status === "ready") return null;

  if (context.status === "needs_authentication") {
    return "Для персональной рекомендации нужен аккаунт и профиль питания. Войдите или зарегистрируйтесь; общие вопросы о продуктах и питании можно задавать без профиля.";
  }

  if (context.status === "needs_profile") {
    return "Чтобы составить персональную рекомендацию, сначала заполните короткую анкету профиля питания. Нажмите **«Заполнить профиль»** над чатом. После сохранения я продолжу с тем же запросом.";
  }

  if (context.status === "needs_profile_completion") {
    const missing = context.pendingClarifications
      .map((field) => FIELD_LABELS[field] ?? field)
      .join(", ");
    return `Для безопасного персонального расчёта дополните профиль **${context.profile?.profileName ?? "питания"}**: ${missing}. Нажмите **«Изменить»** над чатом — остальные данные повторно вводить не потребуется.`;
  }

  if (context.status === "needs_request_clarification") {
    if (context.pendingClarifications.includes("confirmedProducts")) {
      return "Я не вижу подтверждённой продукции в вашем активном продуктовом плане. Проверьте настройку плана или сформулируйте запрос без привязки к собственной поставке — тогда я предложу общий вариант.";
    }
    if (context.pendingClarifications.includes("dairyShareBasis")) {
      return "Уточните, пожалуйста, что означает указанная доля молочной продукции: **процент суточной калорийности**, **процент массы всей еды** или **доля вашей поставки за период**. После выбора я продолжу расчёт с тем же профилем и продуктами.";
    }
  }

  return `Перед персональной рекомендацией подтвердите профиль **${context.profile?.profileName ?? "питания"}** в блоке над чатом. Там же можно изменить данные или выбрать другого члена семьи.`;
}
