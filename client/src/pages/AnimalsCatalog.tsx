import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Heart, Sparkles, Waves } from "lucide-react";
import { Link } from "wouter";
import AnimalShareCard from "@/components/AnimalShareCard";

const speciesConfig = {
  goat: {
    title: "Козы",
    singular: "Коза",
    description:
      "Живые профили коз Sher Kozu: эмоциональная связь, молочный потенциал и личная история каждой семьи с конкретным животным.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    emptyTitle: "Козы скоро появятся",
    emptyText: "Как только администратор опубликует новые профили коз, они появятся в этом разделе галереи.",
    relationshipEmptyTitle: "Коз в отношениях пока нет",
    relationshipEmptyText:
      "Когда у коз появится временный владелец на все доли, они отобразятся здесь со статусом «в отношениях».",
    sharedEmptyTitle: "Коз для совместного статуса пока нет",
    sharedEmptyText:
      "Как только у коз появится частичная занятость, они отобразятся здесь со статусом «можно шерить».",
    availableEmptyTitle: "Свободных коз пока нет",
    availableEmptyText:
      "Когда в разделе коз появятся полностью свободные профили, они будут показаны здесь со статусом «на выданье».",
    icon: Heart,
  },
  sheep: {
    title: "Овцы",
    singular: "Овца",
    description:
      "Раздел с овцами помогает быстро выбрать мягкий характер, статус участия и перейти в полный профиль животного в один клик.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    emptyTitle: "Овцы скоро появятся",
    emptyText: "После публикации первых овец в системе здесь откроется отдельная галерея с карточками и переходом в профиль.",
    relationshipEmptyTitle: "Овец в отношениях пока нет",
    relationshipEmptyText:
      "Когда у овцы все доли будут заняты временным владельцем, она появится здесь со статусом «в отношениях».",
    sharedEmptyTitle: "Овец для шеринг-статуса пока нет",
    sharedEmptyText:
      "Когда у овцы появится частичная занятость, она будет показана здесь со статусом «можно шерить».",
    availableEmptyTitle: "Свободных овец пока нет",
    availableEmptyText:
      "Как только овца будет полностью свободна и готова к сделке, она появится здесь со статусом «на выданье».",
    icon: Waves,
  },
} as const;

type SupportedSpecies = keyof typeof speciesConfig;
type StatusFilter = "relationship" | "available" | "shared";

type CatalogAnimal = {
  id: number;
  slug: string;
  name: string;
  species: string;
  coverImageUrl: string | null;
  breed: string | null;
  availableSlots: number;
  totalOwnershipSlots: number;
  shortDescription: string;
  isFeatured: boolean;
  occupiedUntil: string | null;
  fullPriceMinor?: number;
  ownedPercent?: number;
  availablePercent?: number;
  shareUnitPercent?: number;
  shareUnitPriceMinor?: number;
  availableSharePercents?: number[];
};

const statusFilterOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "relationship", label: "В отношениях" },
  { value: "available", label: "На выданье" },
  { value: "shared", label: "Можно шерить" },
];

function formatOccupiedUntil(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrency(minor?: number | null) {
  const safeMinor = Math.max(0, minor ?? 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(safeMinor / 100);
}

function getRelationshipStatus(slots: number, total: number, occupiedUntil?: string | null) {
  const occupiedUntilLabel = formatOccupiedUntil(occupiedUntil ?? null);

  if (slots <= 0) {
    return {
      filter: "relationship" as const,
      label: "Статус: в отношениях",
      helper: occupiedUntilLabel
        ? `На 100% есть временный владелец. Занято до ${occupiedUntilLabel}.`
        : "На 100% есть временный владелец. Можно указать срок действия статуса до конкретной даты в профиле сделки.",
      className: "border-rose-200 bg-rose-50 text-rose-800",
      compactLabel: "В отношениях",
      occupiedUntilLabel,
    };
  }

  if (slots >= total) {
    return {
      filter: "available" as const,
      label: "Статус: на выданье",
      helper: "Профиль полностью свободен и готов к сделке.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      compactLabel: "На выданье",
      occupiedUntilLabel: null,
    };
  }

  return {
    filter: "shared" as const,
    label: `Статус: можно шерить · свободно ${slots} из ${total}`,
    helper: "Есть временный владелец, но не на 100%: можно рассмотреть совместный статус.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    compactLabel: "Можно шерить",
    occupiedUntilLabel: null,
  };
}

function getShareBlockSummary(animal: CatalogAnimal) {
  const shareUnitPercent = animal.shareUnitPercent ?? 10;
  const availablePercent = animal.availablePercent ?? 0;
  const ownedPercent = animal.ownedPercent ?? 0;
  const availableSharePercents = animal.availableSharePercents ?? [];
  const primarySharePercent = availableSharePercents[0] ?? shareUnitPercent;
  const primarySharePriceMinor = animal.fullPriceMinor
    ? Math.round((animal.fullPriceMinor * primarySharePercent) / 100)
    : animal.shareUnitPriceMinor ?? 0;

  return {
    shareUnitPercent,
    availablePercent,
    ownedPercent,
    availableSharePercents,
    primarySharePercent,
    primarySharePriceMinor,
  };
}

function AnimalsCatalogSkeleton() {
  return (
    <section className="container space-y-10 py-16 md:py-20">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-full max-w-2xl" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-36" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <Card key={cardIndex} className="overflow-hidden border-stone-200 shadow-sm">
                <Skeleton className="h-56 w-full" />
                <CardContent className="space-y-4 p-6">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-11 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function AnimalSpeciesSection({
  species,
  animals,
  filter,
  onFilterChange,
  selectedSharePercent,
}: {
  species: SupportedSpecies;
  animals: CatalogAnimal[];
  filter: StatusFilter;
  onFilterChange: (value: StatusFilter) => void;
  selectedSharePercent: number | null;
}) {
  const config = speciesConfig[species];
  const Icon = config.icon;

  const filteredAnimals = useMemo(
    () => animals.filter((animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === filter),
    [animals, filter]
  );

  const relationshipCount = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "relationship"
  ).length;
  const availableCount = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "available"
  ).length;
  const sharedCount = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "shared"
  ).length;

  const emptyState = {
    relationship: {
      title: config.relationshipEmptyTitle,
      text: config.relationshipEmptyText,
    },
    available: {
      title: config.availableEmptyTitle,
      text: config.availableEmptyText,
    },
    shared: {
      title: config.sharedEmptyTitle,
      text: config.sharedEmptyText,
    },
  }[filter];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-white/90 p-6 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Badge className={`rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] ${config.tone}`}>
            {config.title}
          </Badge>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">{config.title}</h2>
            <p className="max-w-3xl text-sm leading-7 text-stone-600 md:text-base">{config.description}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">В разделе</p>
              <p className="font-medium text-stone-900">
                {animals.length} {animals.length === 1 ? config.singular.toLowerCase() : config.title.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">По статусам</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-stone-900">
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800">В отношениях: {relationshipCount}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">На выданье: {availableCount}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Можно шерить: {sharedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {statusFilterOptions.map((option) => {
          const isActive = filter === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              onClick={() => onFilterChange(option.value)}
              className={
                isActive
                  ? "rounded-full border-stone-900 bg-stone-900 text-white hover:bg-stone-800 hover:text-white"
                  : "rounded-full border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              }
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {filteredAnimals.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredAnimals.map((animal) => {
            const availability = getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil);
            const shareSummary = getShareBlockSummary(animal);
            const hasSelectedShare = selectedSharePercent !== null;
            const matchesSelectedShare = hasSelectedShare && shareSummary.availableSharePercents.includes(selectedSharePercent);

            return (
              <Link key={animal.id} href={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}>
                <Card
                  className={`group h-full cursor-pointer overflow-hidden bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${matchesSelectedShare ? "border-amber-400 ring-2 ring-amber-200 shadow-[0_18px_45px_-28px_rgba(217,119,6,0.55)]" : "border-stone-200"}`}
                >
                  <div className="relative h-56 overflow-hidden bg-stone-100">
                    {animal.coverImageUrl ? (
                      <img
                        src={animal.coverImageUrl}
                        alt={animal.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">Аватарка появится после загрузки</div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                      <Badge className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-white backdrop-blur">
                        {config.singular}
                      </Badge>
                      <div className="flex flex-col items-end gap-2">
                        {matchesSelectedShare ? (
                          <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900 shadow-sm">
                            Выбрано {selectedSharePercent}%
                          </Badge>
                        ) : null}
                        {animal.isFeatured ? (
                          <Badge className="rounded-full border border-white/20 bg-white/90 px-3 py-1 text-stone-900">
                            Профиль недели
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <CardContent className="space-y-5 p-6">
                    <div className="space-y-3">
                      <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${availability.className}`}>
                        {availability.label}
                      </Badge>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-semibold text-stone-900">{animal.name}</h3>
                        <p className="text-sm text-stone-500">{animal.breed ?? `${config.singular} Sher Kozu`}</p>
                      </div>
                      <AnimalShareCard
                        statusLabel={availability.label}
                        statusClassName={availability.className}
                        name={animal.name}
                        breedLabel={animal.breed ?? `${config.singular} Sher Kozu`}
                        priceLabel={formatCurrency(animal.fullPriceMinor)}
                        occupiedPercent={shareSummary.ownedPercent}
                        availablePercent={shareSummary.availablePercent}
                        shareUnitPercent={shareSummary.shareUnitPercent}
                        primarySharePercent={shareSummary.primarySharePercent}
                        primarySharePriceLabel={formatCurrency(shareSummary.primarySharePriceMinor)}
                        availableSharePercents={shareSummary.availableSharePercents}
                        helperText={availability.helper}
                        description={`${availability.helper} В профиле откроется тот же сценарий: свободные доли шагом ${shareSummary.shareUnitPercent}% и один основной CTA.`}
                        ctaLabel="Открыть профиль и продолжить с выбранной долей"
                        ctaHref={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}
                        ctaAsButton
                        theme="stone"
                        occupiedUntilLabel={availability.occupiedUntilLabel}
                        title="Один и тот же сценарий выбора доли на всей витрине"
                        eyebrow="Статус, доля и цена"
                        compact
                      />

                      <p className="line-clamp-3 text-sm leading-6 text-stone-600">{animal.shortDescription}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-stone-300 bg-white/80 shadow-sm">
          <CardContent className="space-y-3 p-8 text-center">
            <h3 className="text-2xl font-semibold text-stone-900">{emptyState.title}</h3>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-stone-600">{emptyState.text}</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default function AnimalsCatalog() {
  const { data, isLoading } = trpc.animals.listPublic.useQuery();
  const [goatFilter, setGoatFilter] = useState<StatusFilter>("available");
  const [sheepFilter, setSheepFilter] = useState<StatusFilter>("available");
  const selectedSharePercent = useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("share"));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, []);

  if (isLoading) {
    return <AnimalsCatalogSkeleton />;
  }

  const animals = data ?? [];
  const goats = animals.filter((animal) => animal.species === "goat");
  const sheep = animals.filter((animal) => animal.species === "sheep");
  const totalRelationship = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "relationship"
  ).length;
  const totalAvailable = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "available"
  ).length;
  const totalShared = animals.filter(
    (animal) => getRelationshipStatus(animal.availableSlots, animal.totalOwnershipSlots, animal.occupiedUntil).filter === "shared"
  ).length;

  return (
    <div className="bg-[#f7f1e8] pb-20 pt-10 text-stone-900 md:pt-14">
      <section className="container space-y-8">
        <div className="overflow-hidden rounded-[2.5rem] border border-stone-200 bg-white/95 shadow-xl shadow-stone-200/50">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.35fr_0.95fr] md:px-10 md:py-10">
            <div className="space-y-5">
              <Badge className="rounded-full border border-stone-300 bg-stone-100 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.28em] text-stone-700">
                Галерея животных
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
                  Выбирайте животное по типу отношений, а не только по виду.
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-600 md:text-lg">
                  Вкладка разделена на коз и овец, а внутри каждого раздела можно фильтровать профили по статусу участия: полностью занято, полностью свободно или доступно для совместного статуса.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-stone-900 px-6 text-white hover:bg-stone-800">
                  <a href="#goats">Смотреть коз</a>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-stone-300 bg-white text-stone-800 hover:bg-stone-50">
                  <a href="#sheep">Смотреть овец</a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">В отношениях</p>
                <p className="text-3xl font-semibold text-stone-900">{totalRelationship}</p>
              </div>
              <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">На выданье</p>
                <p className="text-3xl font-semibold text-stone-900">{totalAvailable}</p>
              </div>
              <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Можно шерить</p>
                <p className="text-3xl font-semibold text-stone-900">{totalShared}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-[2rem] border border-stone-200 bg-white/90 p-6 text-sm leading-7 text-stone-600 shadow-sm md:grid-cols-3">
          <div className="space-y-2 rounded-[1.5rem] bg-rose-50 p-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
              <Sparkles className="h-4 w-4" /> В отношениях
            </p>
            <p>На 100% есть временный владелец. Для такого статуса логично показывать срок, до какой даты животное закреплено.</p>
          </div>
          <div className="space-y-2 rounded-[1.5rem] bg-emerald-50 p-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              <Heart className="h-4 w-4" /> На выданье
            </p>
            <p>Профиль полностью свободен и готов к сделке: временного владельца нет, все доли доступны.</p>
          </div>
          <div className="space-y-2 rounded-[1.5rem] bg-amber-50 p-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              <Waves className="h-4 w-4" /> Можно шерить
            </p>
            <p>Есть временный владелец, но не на 100%. Животное можно рассматривать для совместного статуса или совместной сделки.</p>
          </div>
        </div>

        <div className="space-y-12">
          <div id="goats">
            <AnimalSpeciesSection
              species="goat"
              animals={goats}
              filter={goatFilter}
              onFilterChange={setGoatFilter}
              selectedSharePercent={selectedSharePercent}
            />
          </div>
          <div id="sheep">
            <AnimalSpeciesSection
              species="sheep"
              animals={sheep}
              filter={sheepFilter}
              onFilterChange={setSheepFilter}
              selectedSharePercent={selectedSharePercent}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
