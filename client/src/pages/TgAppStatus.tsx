/**
 * Telegram Mini App — Animal Status screen
 * Shows animal photo, wellness metrics, and basic info.
 */

import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { useTelegram } from "@/contexts/TelegramContext";
import { trpc } from "@/lib/trpc";
import { Heart, Activity, Smile, Loader2, Camera } from "lucide-react";

function WellnessBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#1a3a2a]/70">{label}</span>
          <span className="text-xs font-bold text-[#1a3a2a]">{clampedValue}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#1a3a2a]/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${clampedValue}%`,
              backgroundColor:
                clampedValue >= 70
                  ? "#22c55e"
                  : clampedValue >= 40
                    ? "#f59e0b"
                    : "#ef4444",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function TgAppStatus() {
  const { webApp } = useTelegram();

  // Use ownerDashboard to get animal data
  const { data: dashData, isLoading } = trpc.animals.ownerDashboard.useQuery(undefined, {
    retry: 1,
  });

  if (isLoading) {
    return (
      <TelegramMiniAppLayout title="Моё животное">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1a3a2a]" />
        </div>
      </TelegramMiniAppLayout>
    );
  }

  const animal = dashData?.animal;
  const ownership = dashData?.ownership;

  if (!animal) {
    return (
      <TelegramMiniAppLayout title="Моё животное">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
          <Camera className="h-12 w-12 text-[#1a3a2a]/20" />
          <p className="text-sm text-[#1a3a2a]/60">
            У вас пока нет животного. Выберите своё на koza.vip
          </p>
        </div>
      </TelegramMiniAppLayout>
    );
  }

  const happinessScore = animal.happinessScore ?? 0;
  const healthScore = animal.healthScore ?? 0;
  const moodScore = animal.careLevelScore ?? Math.round((happinessScore + healthScore) / 2);

  return (
    <TelegramMiniAppLayout title="Моё животное">
      {/* Animal photo */}
      {animal.coverImageUrl && (
        <div className="relative w-full aspect-[16/10] overflow-hidden">
          <img
            src={animal.coverImageUrl}
            alt={animal.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-xl font-bold text-white">{animal.name}</h2>
            <p className="text-sm text-white/70">
              {animal.breed} · {(ownership as any)?.sharePercent ?? 100}% владения
            </p>
          </div>
        </div>
      )}

      {!animal.coverImageUrl && (
        <div className="bg-[#1a3a2a] px-5 py-6">
          <h2 className="text-xl font-bold text-white">{animal.name}</h2>
          <p className="text-sm text-white/70 mt-1">
            {animal.breed} · {(ownership as any)?.sharePercent ?? 100}% владения
          </p>
        </div>
      )}

      {/* Wellness metrics */}
      <div className="px-4 pt-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#1a3a2a]/80 uppercase tracking-wider">
          Показатели благополучия
        </h3>

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <WellnessBar
            label="Счастье"
            value={happinessScore}
            icon={Heart}
            color="bg-rose-100 text-rose-500"
          />
          <WellnessBar
            label="Здоровье"
            value={healthScore}
            icon={Activity}
            color="bg-emerald-100 text-emerald-500"
          />
          <WellnessBar
            label="Настроение"
            value={moodScore}
            icon={Smile}
            color="bg-amber-100 text-amber-500"
          />
        </div>
      </div>

      {/* Animal info */}
      <div className="px-4 pt-5 pb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1a3a2a]/80 uppercase tracking-wider mb-3">
            Информация
          </h3>
          <div className="space-y-2.5">
            {animal.breed && (
              <InfoRow label="Порода" value={animal.breed} />
            )}
            {animal.species && (
              <InfoRow
                label="Вид"
                value={animal.species === "goat" ? "Коза" : "Овца"}
              />
            )}
            {animal.shortDescription && (
              <InfoRow label="Описание" value={animal.shortDescription} />
            )}
          </div>
        </div>
      </div>
    </TelegramMiniAppLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1a3a2a]/5 last:border-0">
      <span className="text-xs text-[#1a3a2a]/50">{label}</span>
      <span className="text-xs font-medium text-[#1a3a2a]">{value}</span>
    </div>
  );
}
