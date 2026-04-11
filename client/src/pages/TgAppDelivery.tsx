/**
 * Telegram Mini App — Delivery Tracker screen
 * Shows delivery timeline with statuses.
 * Supports multiple animals with a selector.
 */

import { useState, useMemo } from "react";
import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { useTelegram } from "@/contexts/TelegramContext";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  Check,
  Camera,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  pending: { label: "Ожидает", icon: Clock, color: "text-gray-500", bg: "bg-gray-100" },
  preparing: { label: "Готовится", icon: Package, color: "text-blue-500", bg: "bg-blue-100" },
  in_transit: { label: "В пути", icon: Truck, color: "text-amber-500", bg: "bg-amber-100" },
  delivered: { label: "Доставлено", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100" },
  cancelled: { label: "Отменено", icon: AlertCircle, color: "text-red-500", bg: "bg-red-100" },
};

export default function TgAppDelivery() {
  const { webApp } = useTelegram();
  const [selectedAnimalSlug, setSelectedAnimalSlug] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Get owner dashboard to find all animals
  const { data: dashData, isLoading: dashLoading } =
    trpc.animals.ownerDashboard.useQuery(undefined, { retry: 1 });

  const allAnimals = useMemo(() => {
    return (dashData as any)?.allOwnerships ?? [];
  }, [dashData]);

  // Determine which animal to show
  const activeSlug = selectedAnimalSlug ?? (dashData as any)?.animal?.slug ?? allAnimals[0]?.animalSlug ?? null;
  const activeAnimal = allAnimals.find((o: any) => o.animalSlug === activeSlug) ?? null;

  // Get product tracker data for selected animal
  const { data: trackerData, isLoading: trackerLoading } =
    trpc.productTracker.getByAnimal.useQuery(
      { animalSlug: activeSlug! },
      { enabled: !!activeSlug, retry: 1 }
    );

  const isLoading = dashLoading || trackerLoading;

  const handleSelectAnimal = (slug: string) => {
    webApp?.HapticFeedback?.selectionChanged();
    setSelectedAnimalSlug(slug);
    setSelectorOpen(false);
  };

  if (isLoading) {
    return (
      <TelegramMiniAppLayout title="Доставки">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1a3a2a]" />
        </div>
      </TelegramMiniAppLayout>
    );
  }

  const deliveries = (trackerData as any)?.deliveries ?? [];

  // Sort: active first, then by date desc
  const sorted = [...deliveries].sort((a: any, b: any) => {
    if (a.status !== "delivered" && b.status === "delivered") return -1;
    if (a.status === "delivered" && b.status !== "delivered") return 1;
    const dateA = new Date(a.scheduledDate || a.deliveryDate || 0).getTime();
    const dateB = new Date(b.scheduledDate || b.deliveryDate || 0).getTime();
    return dateB - dateA;
  });

  return (
    <TelegramMiniAppLayout title="Доставки">
      {/* Animal selector — only show if multiple animals */}
      {allAnimals.length > 1 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {activeAnimal?.coverImageUrl && (
                <img
                  src={activeAnimal.coverImageUrl}
                  alt={activeAnimal.animalName}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-[#1a3a2a]">
                  {activeAnimal?.animalName ?? "Животное"}
                </p>
                <p className="text-[10px] text-[#1a3a2a]/50">
                  {deliveries.length} {deliveries.length === 1 ? "доставка" : deliveries.length < 5 ? "доставки" : "доставок"}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-[#1a3a2a]/40 transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
          </button>

          {selectorOpen && (
            <div className="mt-1 bg-white rounded-xl shadow-lg overflow-hidden border border-[#1a3a2a]/10">
              {allAnimals.map((o: any) => (
                <button
                  key={o.animalSlug}
                  onClick={() => handleSelectAnimal(o.animalSlug)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a3a2a]/5 transition-colors"
                >
                  {o.coverImageUrl ? (
                    <img src={o.coverImageUrl} alt={o.animalName} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a2a]/10 flex items-center justify-center">
                      <Camera className="h-4 w-4 text-[#1a3a2a]/30" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-[#1a3a2a]">{o.animalName}</p>
                    <p className="text-[10px] text-[#1a3a2a]/50">{o.breed}</p>
                  </div>
                  {o.animalSlug === activeSlug && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!deliveries.length ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
          <Truck className="h-12 w-12 text-[#1a3a2a]/20" />
          <p className="text-sm text-[#1a3a2a]/60">
            Доставок пока нет. Они появятся после подтверждения продуктового плана.
          </p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3 pb-4">
          {sorted.map((d: any, i: number) => {
            const config = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
            const Icon = config.icon;
            const date = d.scheduledDate || d.deliveryDate;

            return (
              <div key={d.id || i} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1a3a2a]">
                        {d.label || `Доставка #${d.id}`}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    {date && (
                      <p className="text-xs text-[#1a3a2a]/50 mt-1">
                        {new Date(date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    {d.products && d.products.length > 0 && (
                      <p className="text-xs text-[#1a3a2a]/40 mt-1 truncate">
                        {d.products.map((p: any) => p.name || p.productName).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TelegramMiniAppLayout>
  );
}
