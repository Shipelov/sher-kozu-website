import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Heart, Sparkles, Waves } from "lucide-react";
import { Link } from "wouter";

const speciesConfig = {
  goat: {
    title: "Козы",
    singular: "Коза",
    description:
      "Живые профили коз Sher Kozu: эмоциональная связь, молочный потенциал и личная история каждой семьи с конкретным животным.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    emptyTitle: "Козы скоро появятся",
    emptyText: "Как только администратор опубликует новые профили коз, они появятся в этом разделе галереи.",
    soldEmptyTitle: "Проданных коз пока нет",
    soldEmptyText: "Когда в разделе коз появятся уже закреплённые за семьями животные, они отобразятся здесь как проданные.",
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
    soldEmptyTitle: "Проданных овец пока нет",
    soldEmptyText: "Как только все слоты у овцы будут заняты, она появится в этом фильтре как проданная.",
    icon: Waves,
  },
} as const;

type SupportedSpecies = keyof typeof speciesConfig;
type StatusFilter = "available" | "sold";

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
};

const statusFilterOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "available", label: "В наличии" },
  { value: "sold", label: "Продано" },
];

const getAvailabilityTone = (slots: number, total: number) => {
  if (slots <= 0) {
    return {
      label: "Статус: продано",
      className: "border-stone-300 bg-stone-100 text-stone-700",
      filter: "sold" as const,
    };
  }

  if (slots === 1 || slots < total) {
    return {
      label: `Статус: в наличии ${slots} из ${total}`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
      filter: "available" as const,
    };
  }

  return {
    label: `Статус: в наличии ${slots} из ${total}`,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    filter: "available" as const,
  };
};

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
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-32" />
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
}: {
  species: SupportedSpecies;
  animals: CatalogAnimal[];
  filter: StatusFilter;
  onFilterChange: (value: StatusFilter) => void;
}) {
  const config = speciesConfig[species];
  const Icon = config.icon;

  const filteredAnimals = useMemo(
    () => animals.filter((animal) => getAvailabilityTone(animal.availableSlots, animal.totalOwnershipSlots).filter === filter),
    [animals, filter]
  );

  const availableCount = animals.filter((animal) => animal.availableSlots > 0).length;
  const soldCount = animals.filter((animal) => animal.availableSlots <= 0).length;
  const emptyTitle = filter === "available" ? config.emptyTitle : config.soldEmptyTitle;
  const emptyText = filter === "available" ? config.emptyText : config.soldEmptyText;

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
            <div className="mt-2 flex items-center gap-2 text-stone-900">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">В наличии: {availableCount}</span>
              <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-700">Продано: {soldCount}</span>
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
            const availability = getAvailabilityTone(animal.availableSlots, animal.totalOwnershipSlots);

            return (
              <Link key={animal.id} href={`/animals/${animal.slug}`}>
                <Card className="group h-full cursor-pointer overflow-hidden border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
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
                      {animal.isFeatured ? (
                        <Badge className="rounded-full border border-white/20 bg-white/90 px-3 py-1 text-stone-900">
                          Профиль недели
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-6">
                    <div className="space-y-3">
                      <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${availability.className}`}>
                        {availability.label}
                      </Badge>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-semibold text-stone-900">{animal.name}</h3>
                        <p className="text-sm text-stone-500">{animal.breed ?? `${config.singular} Sher Kozu`}</p>
                      </div>
                      <p className="line-clamp-3 text-sm leading-6 text-stone-600">{animal.shortDescription}</p>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                      <span>Открыть полный профиль</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
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
            <h3 className="text-2xl font-semibold text-stone-900">{emptyTitle}</h3>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-stone-600">{emptyText}</p>
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

  if (isLoading) {
    return <AnimalsCatalogSkeleton />;
  }

  const animals = data ?? [];
  const goats = animals.filter((animal) => animal.species === "goat");
  const sheep = animals.filter((animal) => animal.species === "sheep");
  const totalAvailable = animals.filter((animal) => animal.availableSlots > 0).length;
  const totalSold = animals.filter((animal) => animal.availableSlots <= 0).length;

  return (
    <main className="bg-gradient-to-b from-[#fbf6ef] via-white to-[#f7f3ed] text-stone-900">
      <section className="container grid gap-8 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-end md:py-20">
        <div className="space-y-5">
          <Badge className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-primary">
            Галерея животных
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
              Выберите раздел, затем отфильтруйте животных по статусу и откройте карточку козы или овцы с переходом в полноценный профиль.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
              Галерея теперь устроена как понятный маршрут выбора: сначала вид животного, затем фильтр по наличию или продаже,
              после чего остаётся компактная подборка карточек с аватаркой, статусом и именем.
            </p>
          </div>
        </div>

        <Card className="border-stone-200 bg-white/85 shadow-sm backdrop-blur">
          <CardContent className="grid gap-4 p-6 text-sm text-stone-700 sm:grid-cols-4">
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Всего в галерее</p>
              <p className="text-3xl font-semibold text-stone-900">{animals.length}</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Козы</p>
              <p className="text-3xl font-semibold text-stone-900">{goats.length}</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">В наличии</p>
              <p className="text-3xl font-semibold text-stone-900">{totalAvailable}</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Продано</p>
              <p className="text-3xl font-semibold text-stone-900">{totalSold}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container space-y-10 pb-20">
        <div className="flex flex-wrap gap-3">
          <a href="#goats" className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900">
            <Heart className="h-4 w-4" />
            Козы
          </a>
          <a href="#sheep" className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900">
            <Waves className="h-4 w-4" />
            Овцы
          </a>
          <Link href={animals[0] ? `/animals/${animals[0].slug}` : "/animals"}>
            <Button variant="outline" className="rounded-full border-stone-300 bg-white">
              <Sparkles className="mr-2 h-4 w-4" />
              Открыть профиль недели
            </Button>
          </Link>
        </div>

        <div id="goats">
          <AnimalSpeciesSection species="goat" animals={goats} filter={goatFilter} onFilterChange={setGoatFilter} />
        </div>

        <div id="sheep">
          <AnimalSpeciesSection species="sheep" animals={sheep} filter={sheepFilter} onFilterChange={setSheepFilter} />
        </div>
      </section>
    </main>
  );
}
