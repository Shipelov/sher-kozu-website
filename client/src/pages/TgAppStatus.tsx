/**
 * Telegram Mini App — Animal Status screen
 * Shows animal photo, wellness metrics, and basic info.
 * Supports multiple animals with a selector.
 */

import { useState, useMemo } from "react";
import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { useTelegram } from "@/contexts/TelegramContext";
import { trpc } from "@/lib/trpc";
import { Heart, Activity, Smile, Loader2, Camera, ChevronDown, Check } from "lucide-react";

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
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Use ownerDashboard to get all animals data
  const { data: dashData, isLoading } = trpc.animals.ownerDashboard.useQuery(undefined, {
    retry: 1,
  });

  // All owned animals from allOwnerships
  const allAnimals = useMemo(() => {
    return (dashData as any)?.allOwnerships ?? [];
  }, [dashData]);

  // Determine which animal to show
  const activeAnimalId = selectedAnimalId ?? (dashData as any)?.animal?.id ?? allAnimals[0]?.animalId ?? null;

  // Find the selected animal's data
  const selectedOwnership = useMemo(() => {
    if (!activeAnimalId) return null;
    return allAnimals.find((o: any) => o.animalId === activeAnimalId) ?? null;
  }, [allAnimals, activeAnimalId]);

  // If the selected animal is the primary one, use the enriched data from dashData.animal
  const animal = useMemo(() => {
    const primaryAnimal = (dashData as any)?.animal;
    if (primaryAnimal && primaryAnimal.id === activeAnimalId) {
      return primaryAnimal;
    }
    // For non-primary animals, use the ownership data (less detailed)
    if (selectedOwnership) {
      return {
        id: selectedOwnership.animalId,
        slug: selectedOwnership.animalSlug,
        name: selectedOwnership.animalName,
        species: selectedOwnership.species,
        breed: selectedOwnership.breed,
        coverImageUrl: selectedOwnership.coverImageUrl,
        healthScore: null,
        happinessScore: null,
        careLevelScore: null,
      };
    }
    return null;
  }, [dashData, activeAnimalId, selectedOwnership]);

  // Get wellness data for the selected animal (if not primary, fetch separately)
  const primaryAnimalId = (dashData as any)?.animal?.id;
  const needsSeparateWellness = activeAnimalId && activeAnimalId !== primaryAnimalId;

  const { data: wellnessData } = trpc.gamification.wellness.get.useQuery(
    { animalId: activeAnimalId! },
    { enabled: !!needsSeparateWellness, retry: 1 }
  );

  if (isLoading) {
    return (
      <TelegramMiniAppLayout title="Моё животное">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1a3a2a]" />
        </div>
      </TelegramMiniAppLayout>
    );
  }

  if (!animal && allAnimals.length === 0) {
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

  // Wellness scores: from primary animal data or from separate wellness query
  // animalWellnessMetrics table: happiness, health, mood (0-100)
  // animals table: happinessScore, healthScore, careLevelScore (0-100)
  const wellnessSource = needsSeparateWellness ? (wellnessData as any) : null;
  const primaryAnimalData = (dashData as any)?.animal;
  const happinessVal = wellnessSource?.happiness ?? primaryAnimalData?.happinessScore ?? animal?.happinessScore ?? 0;
  const healthVal = wellnessSource?.health ?? primaryAnimalData?.healthScore ?? animal?.healthScore ?? 0;
  const moodVal = wellnessSource?.mood ?? primaryAnimalData?.careLevelScore ?? animal?.careLevelScore ?? Math.round((happinessVal + healthVal) / 2);

  const sharePercent = selectedOwnership?.sharePercent ?? (dashData as any)?.ownership?.sharePercent ?? 100;

  const handleSelectAnimal = (animalId: number) => {
    webApp?.HapticFeedback?.selectionChanged();
    setSelectedAnimalId(animalId);
    setSelectorOpen(false);
  };

  return (
    <TelegramMiniAppLayout title="Моё животное">
      {/* Animal selector — only show if multiple animals */}
      {allAnimals.length > 1 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {animal?.coverImageUrl && (
                <img
                  src={animal.coverImageUrl}
                  alt={animal.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-[#1a3a2a]">{animal?.name}</p>
                <p className="text-[10px] text-[#1a3a2a]/50">
                  {allAnimals.length} {allAnimals.length === 1 ? "животное" : allAnimals.length < 5 ? "животных" : "животных"}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-[#1a3a2a]/40 transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
          </button>

          {selectorOpen && (
            <div className="mt-1 bg-white rounded-xl shadow-lg overflow-hidden border border-[#1a3a2a]/10">
              {allAnimals.map((o: any) => (
                <button
                  key={o.animalId}
                  onClick={() => handleSelectAnimal(o.animalId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a3a2a]/5 transition-colors"
                >
                  {o.coverImageUrl ? (
                    <img
                      src={o.coverImageUrl}
                      alt={o.animalName}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a2a]/10 flex items-center justify-center">
                      <Camera className="h-4 w-4 text-[#1a3a2a]/30" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-[#1a3a2a]">{o.animalName}</p>
                    <p className="text-[10px] text-[#1a3a2a]/50">
                      {o.breed} · {o.sharePercent}%
                    </p>
                  </div>
                  {o.animalId === activeAnimalId && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Animal photo */}
      {animal?.coverImageUrl && (
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
              {animal.breed} · {sharePercent}% владения
            </p>
          </div>
        </div>
      )}

      {!animal?.coverImageUrl && animal && (
        <div className="bg-[#1a3a2a] px-5 py-6">
          <h2 className="text-xl font-bold text-white">{animal.name}</h2>
          <p className="text-sm text-white/70 mt-1">
            {animal.breed} · {sharePercent}% владения
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
            value={happinessVal}
            icon={Heart}
            color="bg-rose-100 text-rose-500"
          />
          <WellnessBar
            label="Здоровье"
            value={healthVal}
            icon={Activity}
            color="bg-emerald-100 text-emerald-500"
          />
          <WellnessBar
            label="Настроение"
            value={moodVal}
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
            {animal?.breed && (
              <InfoRow label="Порода" value={animal.breed} />
            )}
            {animal?.species && (
              <InfoRow
                label="Вид"
                value={animal.species === "goat" ? "Коза" : "Овца"}
              />
            )}
            {animal?.shortDescription && (
              <InfoRow label="Описание" value={animal.shortDescription} />
            )}
            <InfoRow label="Доля владения" value={`${sharePercent}%`} />
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
