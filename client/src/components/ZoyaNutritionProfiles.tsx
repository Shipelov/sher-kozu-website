import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ProfileItem = {
  id: number;
  profileName: string | null;
  relationship: "self" | "spouse" | "child" | "family" | "other" | null;
  gender: "male" | "female" | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: "low" | "light" | "moderate" | "high" | "very_high" | null;
  activityDetails: string | null;
  goals: string[] | null;
  allergies: string[] | null;
  restrictions: string[] | null;
  preferredProducts: string[] | null;
  dislikedProducts: string[] | null;
  mealPreferences: { mealsPerDay?: number; preferredTimes?: string[]; notes?: string } | null;
  medicalNotes: string | null;
  noAllergiesConfirmed: boolean;
  noRestrictionsConfirmed: boolean;
  isPrimary: boolean;
  onboardingStatus: "draft" | "complete";
  confirmedAt: Date | string | null;
  lastReviewedAt: Date | string | null;
  requirements: {
    isComplete: boolean;
    missingFields: string[];
    needsReview: boolean;
  };
};

type ProfileForm = {
  profileName: string;
  relationship: ProfileItem["relationship"];
  gender: ProfileItem["gender"];
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goals: string;
  activityLevel: ProfileItem["activityLevel"];
  activityDetails: string;
  allergies: string;
  restrictions: string;
  preferredProducts: string;
  dislikedProducts: string;
  mealsPerDay: string;
  mealNotes: string;
  medicalNotes: string;
  noAllergiesConfirmed: boolean;
  noRestrictionsConfirmed: boolean;
};

const EMPTY_FORM: ProfileForm = {
  profileName: "",
  relationship: "self",
  gender: null,
  birthDate: "",
  heightCm: "",
  weightKg: "",
  goals: "",
  activityLevel: null,
  activityDetails: "",
  allergies: "",
  restrictions: "",
  preferredProducts: "",
  dislikedProducts: "",
  mealsPerDay: "",
  mealNotes: "",
  medicalNotes: "",
  noAllergiesConfirmed: false,
  noRestrictionsConfirmed: false,
};

const RELATIONSHIP_LABELS: Record<NonNullable<ProfileItem["relationship"]>, string> = {
  self: "Я",
  spouse: "Супруг(а)",
  child: "Ребёнок",
  family: "Член семьи",
  other: "Другой человек",
};

const ACTIVITY_LABELS: Record<NonNullable<ProfileItem["activityLevel"]>, string> = {
  low: "Низкая",
  light: "Лёгкая",
  moderate: "Умеренная",
  high: "Высокая",
  very_high: "Очень высокая",
};

function splitList(value: string): string[] {
  return Array.from(new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)));
}

function joinList(value: string[] | null | undefined): string {
  return value?.join(", ") ?? "";
}

function formFromProfile(profile: ProfileItem): ProfileForm {
  return {
    profileName: profile.profileName ?? "",
    relationship: profile.relationship,
    gender: profile.gender,
    birthDate: profile.birthDate ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    goals: joinList(profile.goals),
    activityLevel: profile.activityLevel,
    activityDetails: profile.activityDetails ?? "",
    allergies: joinList(profile.allergies),
    restrictions: joinList(profile.restrictions),
    preferredProducts: joinList(profile.preferredProducts),
    dislikedProducts: joinList(profile.dislikedProducts),
    mealsPerDay: profile.mealPreferences?.mealsPerDay?.toString() ?? "",
    mealNotes: profile.mealPreferences?.notes ?? "",
    medicalNotes: profile.medicalNotes ?? "",
    noAllergiesConfirmed: profile.noAllergiesConfirmed,
    noRestrictionsConfirmed: profile.noRestrictionsConfirmed,
  };
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export type ZoyaNutritionProfilesProps = {
  isAuthenticated: boolean;
  userId?: number | null;
  activeProfileId: number | null;
  onActiveProfileChange: (profileId: number | null) => void;
  onProfileConfirmed: (confirmed: boolean) => void;
  compact?: boolean;
};

export default function ZoyaNutritionProfiles({
  isAuthenticated,
  userId,
  activeProfileId,
  onActiveProfileChange,
  onProfileConfirmed,
  compact = false,
}: ZoyaNutritionProfilesProps) {
  const utils = trpc.useUtils();
  const profilesQuery = trpc.nutritionist.profiles.list.useQuery(undefined, { enabled: isAuthenticated });
  const createProfile = trpc.nutritionist.profiles.create.useMutation();
  const updateProfile = trpc.nutritionist.profiles.update.useMutation();
  const confirmProfile = trpc.nutritionist.profiles.confirm.useMutation();
  const setPrimary = trpc.nutritionist.profiles.setPrimary.useMutation();
  const archiveProfile = trpc.nutritionist.profiles.archive.useMutation();
  const profiles = (profilesQuery.data ?? []) as ProfileItem[];
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)
    ?? profiles.find((profile) => profile.isPrimary)
    ?? profiles[0]
    ?? null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [acceptedProfileId, setAcceptedProfileId] = useState<number | null>(null);
  const storageKey = userId ? `zoya_active_nutrition_profile_${userId}` : null;

  useEffect(() => {
    if (!isAuthenticated || profiles.length === 0 || activeProfileId) return;
    const storedId = storageKey ? Number(localStorage.getItem(storageKey)) : NaN;
    const selected = profiles.find((profile) => profile.id === storedId)
      ?? profiles.find((profile) => profile.isPrimary)
      ?? profiles[0];
    onActiveProfileChange(selected?.id ?? null);
  }, [activeProfileId, isAuthenticated, onActiveProfileChange, profiles, storageKey]);

  useEffect(() => {
    if (!storageKey || !activeProfileId) return;
    localStorage.setItem(storageKey, String(activeProfileId));
  }, [activeProfileId, storageKey]);

  useEffect(() => {
    setAcceptedProfileId(null);
    onProfileConfirmed(false);
  }, [activeProfileId, onProfileConfirmed]);

  const busy = createProfile.isPending
    || updateProfile.isPending
    || confirmProfile.isPending
    || setPrimary.isPending
    || archiveProfile.isPending;

  const summary = useMemo(() => {
    if (!activeProfile) return "";
    const parts = [activeProfile.profileName ?? "Профиль"];
    const age = calculateAge(activeProfile.birthDate);
    if (age !== null) parts.push(`${age} лет`);
    if (activeProfile.heightCm) parts.push(`${activeProfile.heightCm} см`);
    if (activeProfile.weightKg) parts.push(`${activeProfile.weightKg} кг`);
    if (activeProfile.goals?.length) parts.push(activeProfile.goals.join(", "));
    if (activeProfile.allergies?.length) parts.push(`аллергии: ${activeProfile.allergies.slice(0, 2).join(", ")}`);
    else if (activeProfile.noAllergiesConfirmed) parts.push("аллергий нет");
    if (activeProfile.restrictions?.length) parts.push(`ограничения: ${activeProfile.restrictions.slice(0, 2).join(", ")}`);
    else if (activeProfile.noRestrictionsConfirmed) parts.push("ограничений нет");
    return parts.join(" · ");
  }, [activeProfile]);

  const canSaveProfile = useMemo(() => {
    const height = Number(form.heightCm);
    const weight = Number(form.weightKg);
    const allergiesComplete = Boolean(form.allergies.trim()) || form.noAllergiesConfirmed;
    const restrictionsComplete = Boolean(form.restrictions.trim()) || form.noRestrictionsConfirmed;
    return Boolean(
      form.profileName.trim()
      && form.relationship
      && form.gender
      && form.birthDate
      && Number.isFinite(height) && height >= 50 && height <= 250
      && Number.isFinite(weight) && weight >= 15 && weight <= 400
      && splitList(form.goals).length > 0
      && form.activityLevel
      && allergiesComplete
      && restrictionsComplete,
    );
  }, [form]);

  if (!isAuthenticated) return null;

  const openCreate = () => {
    setEditingProfileId(null);
    setForm({ ...EMPTY_FORM, relationship: profiles.length === 0 ? "self" : "other" });
    setDialogOpen(true);
  };

  const openEdit = (profile: ProfileItem) => {
    setEditingProfileId(profile.id);
    setForm(formFromProfile(profile));
    setDialogOpen(true);
  };

  const selectProfile = (profileId: number) => {
    onActiveProfileChange(profileId);
    setAcceptedProfileId(null);
    onProfileConfirmed(false);
  };

  const acceptProfile = async () => {
    if (!activeProfile) return;
    if (!activeProfile.requirements.isComplete) {
      openEdit(activeProfile);
      return;
    }
    try {
      if (activeProfile.requirements.needsReview || !activeProfile.confirmedAt) {
        await confirmProfile.mutateAsync({ profileId: activeProfile.id });
        await utils.nutritionist.profiles.list.invalidate();
      }
      setAcceptedProfileId(activeProfile.id);
      onProfileConfirmed(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось подтвердить профиль");
    }
  };

  const saveProfile = async () => {
    const payload = {
      profileName: form.profileName,
      relationship: form.relationship,
      gender: form.gender,
      birthDate: form.birthDate || null,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      goals: splitList(form.goals),
      activityLevel: form.activityLevel,
      activityDetails: form.activityDetails || null,
      allergies: splitList(form.allergies),
      restrictions: splitList(form.restrictions),
      preferredProducts: splitList(form.preferredProducts),
      dislikedProducts: splitList(form.dislikedProducts),
      mealPreferences: {
        mealsPerDay: form.mealsPerDay ? Number(form.mealsPerDay) : undefined,
        notes: form.mealNotes || undefined,
      },
      medicalNotes: form.medicalNotes || null,
      noAllergiesConfirmed: form.allergies.trim() ? false : form.noAllergiesConfirmed,
      noRestrictionsConfirmed: form.restrictions.trim() ? false : form.noRestrictionsConfirmed,
    };

    try {
      const saved = editingProfileId
        ? await updateProfile.mutateAsync({ profileId: editingProfileId, data: payload })
        : await createProfile.mutateAsync(payload);
      if (saved.requirements.isComplete) {
        await confirmProfile.mutateAsync({ profileId: saved.id });
      }
      await utils.nutritionist.profiles.list.invalidate();
      onActiveProfileChange(saved.id);
      setAcceptedProfileId(saved.requirements.isComplete ? saved.id : null);
      onProfileConfirmed(saved.requirements.isComplete);
      setDialogOpen(false);
      toast.success(saved.requirements.isComplete ? "Профиль сохранён и подтверждён" : "Черновик профиля сохранён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить профиль");
    }
  };

  const makePrimary = async () => {
    if (!activeProfile) return;
    try {
      await setPrimary.mutateAsync({ profileId: activeProfile.id });
      await utils.nutritionist.profiles.list.invalidate();
      toast.success("Основной профиль изменён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить основной профиль");
    }
  };

  const archiveCurrent = async () => {
    if (!activeProfile || activeProfile.isPrimary) return;
    try {
      await archiveProfile.mutateAsync({ profileId: activeProfile.id });
      await utils.nutritionist.profiles.list.invalidate();
      onActiveProfileChange(profiles.find((profile) => profile.isPrimary)?.id ?? null);
      setDialogOpen(false);
      toast.success("Профиль удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить профиль");
    }
  };

  return (
    <>
      <section className={cn("border-b border-emerald-100 bg-emerald-50/55", compact ? "px-3 py-2" : "px-4 py-3")}>
        {profilesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            Загружаю профиль питания…
          </div>
        ) : profilesQuery.isError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-red-700">Не удалось загрузить профили питания.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => profilesQuery.refetch()} className="h-8 text-xs">
              Повторить
            </Button>
          </div>
        ) : !activeProfile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-950">Персональный профиль не заполнен</p>
              <p className="text-[11px] text-emerald-900/65">Анкета нужна только для персональных расчётов.</p>
            </div>
            <Button type="button" size="sm" onClick={openCreate} className="h-8 bg-emerald-700 text-xs hover:bg-emerald-800">
              Заполнить
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                  <UserRound className="h-3.5 w-3.5" />
                  Профиль для рекомендации
                </p>
                <p className="mt-0.5 truncate text-[11px] text-emerald-900/70">{summary}</p>
              </div>
              {activeProfile.requirements.isComplete ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Заполнен</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Нужно дополнить</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {profiles.length > 1 && (
                <Select value={String(activeProfile.id)} onValueChange={(value) => selectProfile(Number(value))}>
                  <SelectTrigger className="h-8 w-auto min-w-36 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={String(profile.id)}>
                        {profile.profileName}{profile.isPrimary ? " · основной" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="sm"
                onClick={acceptProfile}
                disabled={busy || acceptedProfileId === activeProfile.id}
                className="h-8 bg-emerald-700 px-3 text-xs hover:bg-emerald-800"
              >
                {acceptedProfileId === activeProfile.id ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                {acceptedProfileId === activeProfile.id ? "Используется" : "Использовать"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => openEdit(activeProfile)} className="h-8 px-2 text-xs">
                <Pencil className="mr-1 h-3.5 w-3.5" /> Изменить
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={openCreate} className="h-8 px-2 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Добавить профиль
              </Button>
            </div>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfileId ? "Изменить профиль питания" : "Новый профиль питания"}</DialogTitle>
            <DialogDescription>
              Эти данные используются только для персональных рекомендаций Зои. Медицинские сведения можно не указывать.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2 sm:grid-cols-2">
            <ProfileField label="Имя профиля *">
              <Input value={form.profileName} onChange={(event) => setForm({ ...form, profileName: event.target.value })} placeholder="Например, Алексей" />
            </ProfileField>
            <ProfileField label="Кем приходится владельцу *">
              <Select value={form.relationship ?? undefined} onValueChange={(value) => setForm({ ...form, relationship: value as ProfileItem["relationship"] })}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </ProfileField>
            <ProfileField label="Пол *">
              <Select value={form.gender ?? undefined} onValueChange={(value) => setForm({ ...form, gender: value as ProfileItem["gender"] })}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Мужчина</SelectItem>
                  <SelectItem value="female">Женщина</SelectItem>
                </SelectContent>
              </Select>
            </ProfileField>
            <ProfileField label="Дата рождения *">
              <Input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
            </ProfileField>
            <ProfileField label="Рост, см *">
              <Input type="number" min={50} max={250} value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} />
            </ProfileField>
            <ProfileField label="Вес, кг *">
              <Input type="number" min={15} max={400} step="0.1" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} />
            </ProfileField>
            <ProfileField label="Цели *" className="sm:col-span-2">
              <Input value={form.goals} onChange={(event) => setForm({ ...form, goals: event.target.value })} placeholder="Например: рост мышц, поддержание веса" />
            </ProfileField>
            <ProfileField label="Уровень активности *">
              <Select value={form.activityLevel ?? undefined} onValueChange={(value) => setForm({ ...form, activityLevel: value as ProfileItem["activityLevel"] })}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </ProfileField>
            <ProfileField label="Тренировки и активность">
              <Input value={form.activityDetails} onChange={(event) => setForm({ ...form, activityDetails: event.target.value })} placeholder="Силовые, 3 раза в неделю" />
            </ProfileField>
            <ProfileField label="Аллергии" className="sm:col-span-2">
              <Textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value, noAllergiesConfirmed: false })} placeholder="Через запятую" />
              <ConfirmEmpty checked={form.noAllergiesConfirmed} onChange={(checked) => setForm({ ...form, noAllergiesConfirmed: checked, allergies: checked ? "" : form.allergies })} label="Подтверждаю, что известных пищевых аллергий нет" />
            </ProfileField>
            <ProfileField label="Ограничения и лечебные диеты" className="sm:col-span-2">
              <Textarea value={form.restrictions} onChange={(event) => setForm({ ...form, restrictions: event.target.value, noRestrictionsConfirmed: false })} placeholder="Через запятую" />
              <ConfirmEmpty checked={form.noRestrictionsConfirmed} onChange={(checked) => setForm({ ...form, noRestrictionsConfirmed: checked, restrictions: checked ? "" : form.restrictions })} label="Подтверждаю, что специальных ограничений нет" />
            </ProfileField>
            <ProfileField label="Предпочитаемые продукты">
              <Textarea value={form.preferredProducts} onChange={(event) => setForm({ ...form, preferredProducts: event.target.value })} placeholder="Через запятую" />
            </ProfileField>
            <ProfileField label="Нежелательные продукты">
              <Textarea value={form.dislikedProducts} onChange={(event) => setForm({ ...form, dislikedProducts: event.target.value })} placeholder="Через запятую" />
            </ProfileField>
            <ProfileField label="Приёмов пищи в день">
              <Input type="number" min={1} max={8} value={form.mealsPerDay} onChange={(event) => setForm({ ...form, mealsPerDay: event.target.value })} />
            </ProfileField>
            <ProfileField label="Предпочтения по режиму">
              <Input value={form.mealNotes} onChange={(event) => setForm({ ...form, mealNotes: event.target.value })} placeholder="Например, плотный завтрак" />
            </ProfileField>
            <ProfileField label="Дополнительные сведения" className="sm:col-span-2">
              <Textarea value={form.medicalNotes} onChange={(event) => setForm({ ...form, medicalNotes: event.target.value })} placeholder="Необязательно. Не используйте этот раздел для экстренной медицинской информации." />
            </ProfileField>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {editingProfileId && activeProfile && !activeProfile.isPrimary && (
                <Button type="button" variant="destructive" onClick={archiveCurrent} disabled={busy}>Удалить</Button>
              )}
              {editingProfileId && activeProfile && !activeProfile.isPrimary && (
                <Button type="button" variant="outline" onClick={makePrimary} disabled={busy}>Сделать основным</Button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button type="button" onClick={saveProfile} disabled={busy || !canSaveProfile} className="bg-emerald-700 hover:bg-emerald-800">
                {busy ? "Сохраняю…" : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
          {!canSaveProfile && (
            <p className="text-xs text-amber-700">
              Заполните все поля со звёздочкой и укажите аллергии/ограничения либо явно подтвердите их отсутствие.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ConfirmEmpty({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}
