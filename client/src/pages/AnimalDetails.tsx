import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Heart, Milk, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link, useRoute } from "wouter";

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

function AnimalDetailsSkeleton() {
  return (
    <main className="container py-16 md:py-20">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Skeleton className="h-[420px] w-full rounded-[2rem]" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      </div>
    </main>
  );
}

export default function AnimalDetails() {
  const [, params] = useRoute("/animals/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading } = trpc.animals.getBySlug.useQuery(
    { slug },
    { enabled: Boolean(slug) }
  );
  const plansQuery = trpc.plans.listActive.useQuery();

  if (isLoading) {
    return <AnimalDetailsSkeleton />;
  }

  if (!data) {
    return (
      <main className="container py-16 md:py-20">
        <Card className="border-stone-200 shadow-sm">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="text-2xl font-semibold text-stone-900">Карточка животного не найдена</h1>
            <p className="text-sm leading-6 text-stone-600">
              Возможно, животное было скрыто администратором или slug изменился. Вернитесь в каталог и выберите другого участника фермы.
            </p>
            <div>
              <Link href="/animals">
                <Button variant="outline" className="rounded-full">Вернуться в каталог</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const plans = (plansQuery.data ?? []).filter((plan: (typeof plansQuery.data)[number]) => plan.isActive);
  const gallery = data.media?.length
    ? data.media
    : data.coverImageUrl
      ? [{ id: "cover", url: data.coverImageUrl, title: data.name, kind: "image" as const }]
      : [];

  return (
    <main className="bg-gradient-to-b from-[#fbf6ef] via-white to-[#f7f3ed] text-stone-900">
      <section className="container py-12 md:py-16">
        <Link href="/animals">
          <Button variant="ghost" className="mb-6 rounded-full px-0 text-stone-600 hover:text-stone-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к каталогу
          </Button>
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              {gallery[0]?.url ? (
                <img src={gallery[0].url} alt={gallery[0].title ?? data.name} className="h-[420px] w-full object-cover" />
              ) : (
                <div className="flex h-[420px] items-center justify-center text-stone-400">Изображение появится после загрузки</div>
              )}
            </div>

            {gallery.length > 1 ? (
              <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                {gallery.slice(0, 4).map((item: (typeof gallery)[number]) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <img src={item.url} alt={item.title ?? data.name} className="h-28 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                {getSpeciesLabel(data.species)}
              </Badge>
              <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                Свободно слотов: {data.availableSlots} / {data.totalOwnershipSlots}
              </Badge>
              {data.breed ? <Badge variant="outline" className="rounded-full">{data.breed}</Badge> : null}
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{data.name}</h1>
              <p className="text-base leading-7 text-stone-600">{data.shortDescription}</p>
            </div>

            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-stone-500">Здоровье</p>
                  <p className="text-lg font-semibold">{data.healthScore}/100</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <Heart className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-stone-500">Удовлетворённость</p>
                  <p className="text-lg font-semibold">{data.happinessScore}/100</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <Milk className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-stone-500">Потенциал молока</p>
                  <p className="text-lg font-semibold">{data.milkPotentialScore}/100</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-stone-500">Уровень care</p>
                  <p className="text-lg font-semibold">{data.careLevelScore}/100</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Стартовая цена участия</p>
                    <p className="text-3xl font-semibold text-stone-900">{formatPrice(data.baseMonthlyPriceMinor)}/мес</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-700">
                    <Users className="h-4 w-4" />
                    До {data.totalOwnershipSlots} семей
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-stone-900">Доступные планы подключения</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {plans.length ? (
                      plans.map((plan: (typeof plans)[number]) => (
                        <div key={plan.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <p className="font-medium text-stone-900">{plan.name}</p>
                          <p className="mt-1 text-xs leading-5 text-stone-600">{plan.description ?? "План будет использоваться в checkout на следующем этапе."}</p>
                          <p className="mt-3 text-sm font-semibold text-primary">от {formatPrice(plan.baseMonthlyPriceMinor)}/мес</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                        Администратор скоро добавит первые планы участия для checkout-сценария.
                      </div>
                    )}
                  </div>
                </div>

                <Button className="w-full rounded-full" disabled>
                  Checkout будет следующим шагом Sprint 2
                </Button>
              </CardContent>
            </Card>

            {data.story ? (
              <Card className="border-stone-200 bg-white shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">История животного</p>
                  <p className="text-sm leading-7 text-stone-700">{data.story}</p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
