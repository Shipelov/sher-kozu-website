import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Heart, Milk, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const formatPrice = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(minor / 100);

const getSpeciesLabel = (species: string) => {
  if (species === "goat") return "Коза";
  if (species === "sheep") return "Овца";
  return "Животное";
};

const getAvailabilityTone = (slots: number, total: number) => {
  if (slots <= 0) {
    return {
      label: "Слоты заняты",
      className: "border-stone-300 bg-stone-100 text-stone-700",
    };
  }

  if (slots === 1 || slots < total) {
    return {
      label: `Осталось ${slots} из ${total}`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: `Свободно ${slots} из ${total}`,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
};

function AnimalsCatalogSkeleton() {
  return (
    <section className="container py-16 md:py-20">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-stone-200 shadow-sm">
            <Skeleton className="h-64 w-full" />
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function AnimalsCatalog() {
  const { data, isLoading } = trpc.animals.listPublic.useQuery();

  if (isLoading) {
    return <AnimalsCatalogSkeleton />;
  }

  const animals = data ?? [];

  return (
    <main className="bg-gradient-to-b from-[#fbf6ef] via-white to-[#f7f3ed] text-stone-900">
      <section className="container grid gap-8 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-end md:py-20">
        <div className="space-y-5">
          <Badge className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-primary">
            Каталог животных
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
              Выберите животное, за которым ваша семья будет наблюдать, заботиться и получать продукцию его молока.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
              Каждая карточка показывает историю животного, свободные слоты совместного владения и стартовый уровень участия.
              Это первый шаг в цифровую экосистему Sher Kozu: от выбора до личного кабинета и продуктов.
            </p>
          </div>
        </div>

        <Card className="border-stone-200 bg-white/85 shadow-sm backdrop-blur">
          <CardContent className="grid gap-4 p-6 text-sm text-stone-700 sm:grid-cols-3">
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Животных в каталоге</p>
              <p className="text-3xl font-semibold text-stone-900">{animals.length}</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">С совместным владением</p>
              <p className="text-3xl font-semibold text-stone-900">до 3</p>
            </div>
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Длительность статуса</p>
              <p className="text-3xl font-semibold text-stone-900">1–12 мес.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container pb-20">
        {animals.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {animals.map((animal) => {
              const availability = getAvailabilityTone(animal.availableSlots, animal.totalOwnershipSlots);

              return (
                <Card key={animal.id} className="group overflow-hidden border-stone-200 bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative h-64 overflow-hidden bg-stone-100">
                    {animal.coverImageUrl ? (
                      <img
                        src={animal.coverImageUrl}
                        alt={animal.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">Изображение появится после загрузки</div>
                    )}
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <Badge className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-white backdrop-blur">
                        {getSpeciesLabel(animal.species)}
                      </Badge>
                      {animal.isFeatured ? (
                        <Badge className="rounded-full border border-white/20 bg-white/90 px-3 py-1 text-stone-900">
                          Рекомендуем
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <CardContent className="space-y-5 p-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${availability.className}`}>
                          {availability.label}
                        </Badge>
                        {animal.breed ? (
                          <span className="text-xs text-stone-500">{animal.breed}</span>
                        ) : null}
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-stone-900">{animal.name}</h2>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{animal.shortDescription}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-stone-500">Здоровье</p>
                        <p className="text-lg font-semibold text-stone-900">{animal.healthScore}/100</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                          <Heart className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-stone-500">Удовлетворённость</p>
                        <p className="text-lg font-semibold text-stone-900">{animal.happinessScore}/100</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <Milk className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-stone-500">Потенциал молока</p>
                        <p className="text-lg font-semibold text-stone-900">{animal.milkPotentialScore}/100</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-stone-500">От</p>
                        <p className="text-lg font-semibold text-stone-900">{formatPrice(animal.baseMonthlyPriceMinor)}/мес</p>
                      </div>
                    </div>

                    <Link href={`/animals/${animal.slug}`}>
                      <Button className="w-full rounded-full">
                        Открыть карточку животного
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="text-2xl font-semibold text-stone-900">Каталог пока заполняется</h2>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-stone-600">
                Администратор уже получил foundation для Sprint 1. После наполнения базы здесь появятся козы и овцы со свободными слотами участия.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
