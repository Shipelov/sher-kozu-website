import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Eye, EyeOff, Leaf, Milk, Pencil, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type AdminAnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type AdminAnimalSpecies = "goat" | "sheep";
type AdminVisibilityMode = "public" | "hidden" | "archived";

type AdminAnimalRecord = {
  id: number;
  slug: string;
  name: string;
  species: AdminAnimalSpecies;
  breed: string | null;
  shortDescription?: string | null;
  story?: string | null;
  galleryIntro?: string | null;
  status: AdminAnimalStatus;
  totalOwnershipSlots: number;
  activeOwnerships: number;
  availableSlots: number;
  baseMonthlyPriceMinor: number;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  careLevelScore?: number;
  isFeatured: number | boolean;
  sortOrder?: number;
  coverImageUrl: string | null;
  publishedAt?: string | number | null;
  media?: Array<{
    kind: "image" | "video" | "document";
    title: string;
    alt?: string | null;
    fileKey: string;
    url: string;
    mimeType: string;
    sortOrder: number;
    isCover: boolean;
  }>;
};

type AnimalFormValues = {
  id?: number;
  name: string;
  slug: string;
  species: AdminAnimalSpecies;
  breed: string;
  shortDescription: string;
  story: string;
  coverImageUrl: string;
  galleryIntro: string;
  status: AdminAnimalStatus;
  totalOwnershipSlots: number;
  baseMonthlyPriceMinor: number;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  careLevelScore: number;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string;
};

const formatPrice = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(minor / 100);

const createEmptyAnimalForm = (): AnimalFormValues => ({
  name: "",
  slug: "",
  species: "goat",
  breed: "",
  shortDescription: "",
  story: "",
  coverImageUrl: "",
  galleryIntro: "",
  status: "hidden",
  totalOwnershipSlots: 3,
  baseMonthlyPriceMinor: 120000,
  healthScore: 75,
  happinessScore: 75,
  milkPotentialScore: 75,
  careLevelScore: 75,
  isFeatured: false,
  sortOrder: 0,
  publishedAt: "",
});

function normalizeAnimalFormValues(animal?: AdminAnimalRecord | null): AnimalFormValues {
  if (!animal) return createEmptyAnimalForm();

  const publishedAtValue = animal.publishedAt
    ? new Date(typeof animal.publishedAt === "number" ? animal.publishedAt : animal.publishedAt).toISOString().slice(0, 16)
    : "";

  return {
    id: animal.id,
    name: animal.name,
    slug: animal.slug,
    species: animal.species,
    breed: animal.breed ?? "",
    shortDescription: animal.shortDescription ?? "",
    story: animal.story ?? "",
    coverImageUrl: animal.coverImageUrl ?? "",
    galleryIntro: animal.galleryIntro ?? "",
    status: animal.status,
    totalOwnershipSlots: animal.totalOwnershipSlots,
    baseMonthlyPriceMinor: animal.baseMonthlyPriceMinor,
    healthScore: animal.healthScore,
    happinessScore: animal.happinessScore,
    milkPotentialScore: animal.milkPotentialScore,
    careLevelScore: animal.careLevelScore ?? 50,
    isFeatured: Boolean(animal.isFeatured),
    sortOrder: animal.sortOrder ?? 0,
    publishedAt: publishedAtValue,
  };
}

function slugifyAnimalName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildAnimalMutationPayload(values: AnimalFormValues) {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    species: values.species,
    breed: values.breed.trim() || null,
    shortDescription: values.shortDescription.trim(),
    story: values.story.trim() || null,
    coverImageUrl: values.coverImageUrl.trim() || null,
    galleryIntro: values.galleryIntro.trim() || null,
    status: values.status,
    totalOwnershipSlots: values.totalOwnershipSlots,
    baseMonthlyPriceMinor: values.baseMonthlyPriceMinor,
    healthScore: values.healthScore,
    happinessScore: values.happinessScore,
    milkPotentialScore: values.milkPotentialScore,
    careLevelScore: values.careLevelScore,
    isFeatured: values.isFeatured,
    sortOrder: values.sortOrder,
    publishedAt: values.publishedAt ? new Date(values.publishedAt).getTime() : null,
    media: [],
  };
}

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

function getNextVisibilityMode(status: AdminAnimalStatus): AdminVisibilityMode {
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
  onEdit,
  isUpdating,
}: {
  animals: AdminAnimalRecord[];
  onToggleVisibility: (animal: AdminAnimalRecord) => void;
  onEdit: (animal: AdminAnimalRecord) => void;
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
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEdit(animal)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
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

function AnimalEditorCard({
  mode,
  values,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  mode: "create" | "edit";
  values: AnimalFormValues;
  onChange: <K extends keyof AnimalFormValues>(key: K, value: AnimalFormValues[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {mode === "create" ? <Plus className="h-5 w-5 text-primary" /> : <Pencil className="h-5 w-5 text-primary" />}
          {mode === "create" ? "Создать животное" : "Редактировать животное"}
        </CardTitle>
        <CardDescription>
          Заполните базовую информацию карточки, чтобы команда могла публиковать, скрывать и дорабатывать каталог без ручного редактирования базы.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="animal-name">Имя</Label>
            <Input id="animal-name" value={values.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Марта" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-slug">Slug</Label>
            <div className="flex gap-2">
              <Input id="animal-slug" value={values.slug} onChange={(event) => onChange("slug", event.target.value)} placeholder="marta" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => onChange("slug", slugifyAnimalName(values.name))}>
                Из имени
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Вид</Label>
            <Select value={values.species} onValueChange={(value) => onChange("species", value as AdminAnimalSpecies)}>
              <SelectTrigger><SelectValue placeholder="Вид" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="goat">Коза</SelectItem>
                <SelectItem value="sheep">Овца</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-breed">Порода</Label>
            <Input id="animal-breed" value={values.breed} onChange={(event) => onChange("breed", event.target.value)} placeholder="Англо-нубийская" />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="animal-short-description">Короткое описание</Label>
            <Textarea
              id="animal-short-description"
              value={values.shortDescription}
              onChange={(event) => onChange("shortDescription", event.target.value)}
              placeholder="Короткое публичное описание для витрины и карточки животного"
              className="min-h-[96px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-story">История</Label>
            <Textarea
              id="animal-story"
              value={values.story}
              onChange={(event) => onChange("story", event.target.value)}
              placeholder="Развернутая история животного, происхождение, особенности характера"
              className="min-h-[132px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-gallery-intro">Вступление к галерее</Label>
            <Textarea
              id="animal-gallery-intro"
              value={values.galleryIntro}
              onChange={(event) => onChange("galleryIntro", event.target.value)}
              placeholder="Короткий текст перед блоком фотографий и медиа"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="animal-cover">Cover image URL</Label>
            <Input id="animal-cover" value={values.coverImageUrl} onChange={(event) => onChange("coverImageUrl", event.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={values.status} onValueChange={(value) => onChange("status", value as AdminAnimalStatus)}>
              <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public_available">Доступно</SelectItem>
                <SelectItem value="public_limited">Слотов мало</SelectItem>
                <SelectItem value="fully_booked">Заполнено</SelectItem>
                <SelectItem value="hidden">Скрыто</SelectItem>
                <SelectItem value="archived">Архив</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-published-at">Дата публикации</Label>
            <Input id="animal-published-at" type="datetime-local" value={values.publishedAt} onChange={(event) => onChange("publishedAt", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-sort-order">Sort order</Label>
            <Input
              id="animal-sort-order"
              type="number"
              min={0}
              max={9999}
              value={values.sortOrder}
              onChange={(event) => onChange("sortOrder", Number(event.target.value || 0))}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="animal-slots">Ownership slots</Label>
            <Input
              id="animal-slots"
              type="number"
              min={1}
              max={3}
              value={values.totalOwnershipSlots}
              onChange={(event) => onChange("totalOwnershipSlots", Number(event.target.value || 1))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-price">Цена в minor units</Label>
            <Input
              id="animal-price"
              type="number"
              min={0}
              max={100000000}
              value={values.baseMonthlyPriceMinor}
              onChange={(event) => onChange("baseMonthlyPriceMinor", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-health">Здоровье</Label>
            <Input
              id="animal-health"
              type="number"
              min={0}
              max={100}
              value={values.healthScore}
              onChange={(event) => onChange("healthScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-happiness">Счастье</Label>
            <Input
              id="animal-happiness"
              type="number"
              min={0}
              max={100}
              value={values.happinessScore}
              onChange={(event) => onChange("happinessScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-milk">Потенциал молока</Label>
            <Input
              id="animal-milk"
              type="number"
              min={0}
              max={100}
              value={values.milkPotentialScore}
              onChange={(event) => onChange("milkPotentialScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-care">Уход</Label>
            <Input
              id="animal-care"
              type="number"
              min={0}
              max={100}
              value={values.careLevelScore}
              onChange={(event) => onChange("careLevelScore", Number(event.target.value || 0))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3">
          <Checkbox
            id="animal-featured"
            checked={values.isFeatured}
            onCheckedChange={(checked) => onChange("isFeatured", Boolean(checked))}
          />
          <div>
            <Label htmlFor="animal-featured" className="text-sm font-medium text-foreground">Показывать как featured</Label>
            <p className="text-xs text-muted-foreground">Помогает выделять животное в витрине и приоритетных подборках.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" className="rounded-full" onClick={onSubmit} disabled={isSubmitting}>
            {mode === "create" ? "Создать карточку" : "Сохранить изменения"}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={isSubmitting}>
            {mode === "create" ? "Очистить форму" : "Отменить редактирование"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnimals() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.adminAnimals.list.useQuery();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminAnimalStatus | "all">("all");
  const [species, setSpecies] = useState<AdminAnimalSpecies | "all">("all");
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<AnimalFormValues>(createEmptyAnimalForm());

  const animals = (data ?? []) as AdminAnimalRecord[];
  const selectedAnimal = useMemo(
    () => animals.find((animal) => animal.id === selectedAnimalId) ?? null,
    [animals, selectedAnimalId]
  );

  useEffect(() => {
    if (editorMode === "edit" && selectedAnimal) {
      setFormValues(normalizeAnimalFormValues(selectedAnimal));
      return;
    }

    if (editorMode === "create") {
      setFormValues(createEmptyAnimalForm());
    }
  }, [editorMode, selectedAnimal]);

  const createMutation = trpc.adminAnimals.create.useMutation({
    onSuccess: async () => {
      toast.success("Животное создано.");
      setEditorMode("create");
      setSelectedAnimalId(null);
      setFormValues(createEmptyAnimalForm());
      await Promise.all([
        utils.adminAnimals.list.invalidate(),
        utils.animals.listPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось создать животное.");
    },
  });

  const updateMutation = trpc.adminAnimals.update.useMutation({
    onSuccess: async () => {
      toast.success("Карточка животного обновлена.");
      await Promise.all([
        utils.adminAnimals.list.invalidate(),
        utils.animals.listPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось сохранить изменения.");
    },
  });

  const setVisibilityMutation = trpc.adminAnimals.setVisibility.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.adminAnimals.list.invalidate(),
        utils.animals.listPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось изменить видимость.");
    },
  });

  const filteredAnimals = useMemo(() => {
    return filterAdminAnimals(animals, query, status, species);
  }, [animals, query, status, species]);

  const publicCount = animals.filter((animal) => animal.status === "public_available" || animal.status === "public_limited").length;
  const hiddenCount = animals.filter((animal) => animal.status === "hidden").length;
  const bookedCount = animals.filter((animal) => animal.status === "fully_booked").length;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const updateFormValue = <K extends keyof AnimalFormValues>(key: K, value: AnimalFormValues[K]) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = () => {
    if (!formValues.name.trim() || !formValues.slug.trim() || !formValues.shortDescription.trim()) {
      toast.error("Заполните имя, slug и короткое описание.");
      return;
    }

    const payload = buildAnimalMutationPayload(formValues);

    if (editorMode === "create") {
      createMutation.mutate(payload);
      return;
    }

    if (!formValues.id) {
      toast.error("Не найден идентификатор животного для редактирования.");
      return;
    }

    updateMutation.mutate({ id: formValues.id, ...payload });
  };

  const handleCancel = () => {
    setEditorMode("create");
    setSelectedAnimalId(null);
    setFormValues(createEmptyAnimalForm());
  };

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

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <AnimalEditorCard
            mode={editorMode}
            values={formValues}
            onChange={updateFormValue}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />

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
                На этом этапе форма покрывает текст, показатели, статус и публикацию. Следующим слоем можно добавить загрузку медиа и редактирование галереи.
              </div>
            </CardContent>
          </Card>
        </div>

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
            <Select value={status} onValueChange={(value) => setStatus(value as AdminAnimalStatus | "all")}>
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
            <Select value={species} onValueChange={(value) => setSpecies(value as AdminAnimalSpecies | "all")}>
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
                onEdit={(animal) => {
                  setEditorMode("edit");
                  setSelectedAnimalId(animal.id);
                  setFormValues(normalizeAnimalFormValues(animal));
                }}
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
                    Измените фильтры или создайте новую карточку в форме слева, чтобы начать наполнять каталог без консольных операций.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between rounded-2xl bg-white px-4 py-6 text-sm font-medium text-foreground hover:bg-secondary/40"
                  onClick={handleCancel}
                >
                  <span>Переключиться в режим создания</span>
                  <Plus className="h-4 w-4 text-primary" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export {
  buildAnimalMutationPayload,
  createEmptyAnimalForm,
  filterAdminAnimals,
  getNextVisibilityMode,
  getStatusBadge,
  normalizeAnimalFormValues,
  slugifyAnimalName,
};
