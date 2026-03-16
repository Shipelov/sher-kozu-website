import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Eye, EyeOff, Leaf, Milk, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type AdminAnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type AdminAnimalSpecies = "goat" | "sheep";

type AdminAnimalRecord = {
  id: number;
  slug: string;
  name: string;
  species: AdminAnimalSpecies;
  breed: string | null;
  status: AdminAnimalStatus;
  totalOwnershipSlots: number;
  activeOwnerships: number;
  availableSlots: number;
  baseMonthlyPriceMinor: number;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  isFeatured: number | boolean;
  coverImageUrl: string | null;
};

const formatPrice = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(minor / 100);

function getStatusBadge(status: AdminAnimalStatus) {
  if (status === "public_available") {
    return { label: "Доступно", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  if (status === "public_limited") {
    return { label: "Слотов мало", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  if (status === "fully_booked") {
    return { label: "Заполнено", className: "border-stone-300 bg-stone-100 text-stone-700" };
  }
  if (status === "archived") {
    return { label: "Архив", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  return { label: "Скрыто", className: "border-rose-200 bg-rose-50 text-rose-800" };
}

function getSpeciesLabel(species: AdminAnimalSpecies) {
  return species === "goat" ? "Коза" : "Овца";
}

function getNextVisibilityMode(status: AdminAnimalStatus): "public" | "hidden" | "archived" {
  if (status === "hidden") return "public";
  return "hidden";
}

function getVisibilityActionLabel(status: AdminAnimalStatus) {
  return status === "hidden" ? "Опубликовать" : "Скрыть";
}

function filterAdminAnimals(
  animals: AdminAnimalRecord[],
  query: string,
  status: AdminAnimalStatus | "all",
  species: AdminAnimalSpecies | "all"
) {
  const normalizedQuery = query.trim().toLowerCase();

  return animals.filter((animal) => {
    const matchesQuery = !normalizedQuery
      || [animal.name, animal.slug, animal.breed ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === "all" || animal.status === status;
    const matchesSpecies = species === "all" || animal.species === species;

    return matchesQuery && matchesStatus && matchesSpecies;
  });
}

function AdminAnimalsTable({
  animals,
  onToggleVisibility,
  isUpdating,
}: {
  animals: AdminAnimalRecord[];
  onToggleVisibility: (animal: AdminAnimalRecord) => void;
  isUpdating: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Животное</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Слоты</TableHead>
            <TableHead>Показатели</TableHead>
            <TableHead>Цена</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animals.map((animal) => {
            const statusBadge = getStatusBadge(animal.status);
            return (
              <TableRow key={animal.id} className="align-top">
                <TableCell>
                  <div className="flex gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">
                      {animal.coverImageUrl ? (
                        <img src={animal.coverImageUrl} alt={animal.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-400">
                          {animal.species === "goat" ? <Milk className="h-5 w-5" /> : <Leaf className="h-5 w-5" />}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{animal.name}</p>
                        {animal.isFeatured ? (
                          <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">Featured</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{getSpeciesLabel(animal.species)} · {animal.breed || "Порода уточняется"}</p>
                      <p className="text-xs text-muted-foreground">slug: {animal.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`rounded-full border ${statusBadge.className}`}>{statusBadge.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{animal.availableSlots} свободно / {animal.totalOwnershipSlots}</p>
                    <p className="text-muted-foreground">Активных: {animal.activeOwnerships}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <span>Здоровье: {animal.healthScore}</span>
                    <span>Счастье: {animal.happinessScore}</span>
                    <span>Молоко: {animal.milkPotentialScore}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium text-foreground">{formatPrice(animal.baseMonthlyPriceMinor)}/мес</div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Link href={`/animals/${animal.slug}`}>
                      <Button variant="outline" size="sm" className="rounded-full">
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Открыть
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onToggleVisibility(animal)}
                      disabled={isUpdating || animal.status === "archived"}
                    >
                      {animal.status === "hidden" ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                      {getVisibilityActionLabel(animal.status)}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminAnimals() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.adminAnimals.list.useQuery();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminAnimalStatus | "all">("all");
  const [species, setSpecies] = useState<AdminAnimalSpecies | "all">("all");

  const setVisibilityMutation = trpc.adminAnimals.setVisibility.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.adminAnimals.list.invalidate(),
        utils.animals.listPublic.invalidate(),
      ]);
    },
  });

  const animals = (data ?? []) as AdminAnimalRecord[];
  const filteredAnimals = useMemo(() => {
    return filterAdminAnimals(animals, query, status, species);
  }, [animals, query, status, species]);

  const publicCount = animals.filter((animal) => animal.status === "public_available" || animal.status === "public_limited").length;
  const hiddenCount = animals.filter((animal) => animal.status === "hidden").length;
  const bookedCount = animals.filter((animal) => animal.status === "fully_booked").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-[linear-gradient(180deg,rgba(251,246,239,0.82),rgba(255,255,255,0.96))]">
        <Card className="overflow-hidden rounded-[2rem] border-border/70 shadow-sm">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <Badge className="w-fit rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
                Admin · каталог животных
              </Badge>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">Управление ядром Sher Kozu начинается с понятного каталога животных.</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  Эта первая админ-панель помогает команде быстро увидеть, что уже опубликовано, сколько слотов свободно и какие карточки требуют наполнения перед публичным запуском каталога.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-border/70 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Публично</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{publicCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Скрыто</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{hiddenCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Полностью занято</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{bookedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Поиск и операционный фокус</CardTitle>
            <CardDescription>
              Фильтры помогают быстро найти животных по имени, slug, статусу публикации и виду, не уходя в SQL или консольные операции.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.4fr_0.4fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по имени, slug или породе"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as AdminAnimalStatus | "all") }>
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="public_available">Доступно</SelectItem>
                <SelectItem value="public_limited">Слотов мало</SelectItem>
                <SelectItem value="fully_booked">Заполнено</SelectItem>
                <SelectItem value="hidden">Скрыто</SelectItem>
                <SelectItem value="archived">Архив</SelectItem>
              </SelectContent>
            </Select>
            <Select value={species} onValueChange={(value) => setSpecies(value as AdminAnimalSpecies | "all") }>
              <SelectTrigger>
                <SelectValue placeholder="Вид" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все виды</SelectItem>
                <SelectItem value="goat">Козы</SelectItem>
                <SelectItem value="sheep">Овцы</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div>
            {isLoading ? (
              <Card className="rounded-[2rem] border-border/70 shadow-sm">
                <CardContent className="p-6 text-sm text-muted-foreground">Загружаем каталог животных для admin view…</CardContent>
              </Card>
            ) : filteredAnimals.length ? (
              <AdminAnimalsTable
                animals={filteredAnimals}
                onToggleVisibility={(animal) => {
                  setVisibilityMutation.mutate({ id: animal.id, mode: getNextVisibilityMode(animal.status) });
                }}
                isUpdating={setVisibilityMutation.isPending}
              />
            ) : (
              <Card className="rounded-[2rem] border-border/70 shadow-sm">
                <CardContent className="p-8 text-center">
                  <p className="text-lg font-medium text-foreground">По текущим фильтрам животных не найдено.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Измените фильтры или начните наполнять каталог через adminAnimals.create на следующем шаге интерфейса.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="rounded-[2rem] border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Операционные сигналы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl bg-secondary/50 p-4">
                  Животные со статусом <strong className="text-foreground">hidden</strong> не попадают в публичный каталог и не отвлекают пользователя до готовности карточки.
                </div>
                <div className="rounded-2xl bg-secondary/50 p-4">
                  Статус <strong className="text-foreground">fully_booked</strong> помогает команде видеть дефицит и готовить новые карточки или новые слоты участия.
                </div>
                <div className="rounded-2xl bg-secondary/50 p-4">
                  Следующим слоем можно добавить создание, редактирование медиа и ручное управление feature-приоритетом животных.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Быстрые переходы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/animals" className="flex items-center justify-between rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40">
                  <span>Открыть публичный каталог</span>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
                <Link href="/dashboard" className="flex items-center justify-between rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40">
                  <span>Вернуться в owner dashboard</span>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export { filterAdminAnimals, getStatusBadge, getNextVisibilityMode };
