import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { ComparisonRadarChart } from "@/components/RadarChart";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  ArrowLeftRight,
  Trophy,
  Heart,
  Shield,
  Smile,
  Star,
  Brain,
  Home,
} from "lucide-react";

const METRIC_LABELS = [
  { key: "happiness", label: "Счастье", emoji: "😊" },
  { key: "health", label: "Здоровье", emoji: "🩺" },
  { key: "attachment", label: "Привязанность", emoji: "💕" },
  { key: "mood", label: "Настроение", emoji: "🌤️" },
  { key: "obedience", label: "Послушание", emoji: "🎓" },
  { key: "overallRating", label: "Общий", emoji: "⭐" },
];

const METRIC_ICONS: Record<string, React.ReactNode> = {
  happiness: <Smile className="h-4 w-4" />,
  health: <Shield className="h-4 w-4" />,
  attachment: <Heart className="h-4 w-4" />,
  mood: <Star className="h-4 w-4" />,
  obedience: <Brain className="h-4 w-4" />,
  overallRating: <Trophy className="h-4 w-4" />,
};

function AnimalSelector({
  animals,
  selectedId,
  onSelect,
  label,
  excludeId,
}: {
  animals: Array<{ id: number; name: string; species: string; coverImageUrl?: string | null; slug?: string | null }>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  label: string;
  excludeId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const filtered = excludeId ? animals.filter((a) => a.id !== excludeId) : animals;
  const selected = animals.find((a) => a.id === selectedId);

  return (
    <div className="relative">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-accent/30 transition-colors text-left"
      >
        {selected?.coverImageUrl && selected.coverImageUrl !== "NULL" ? (
          <img src={selected.coverImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Heart className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {selected ? selected.name : "Выберите животное"}
          </p>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {selected.species === "goat" ? "🐐 Коза" : "🐑 Овца"}
            </p>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-20 mt-1 w-full max-h-[300px] overflow-y-auto rounded-xl border border-border/70 bg-card shadow-lg"
        >
          {filtered.map((animal) => (
            <button
              key={animal.id}
              onClick={() => {
                onSelect(animal.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
            >
              {animal.coverImageUrl && animal.coverImageUrl !== "NULL" ? (
                <img src={animal.coverImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                  {animal.species === "goat" ? "🐐" : "🐑"}
                </div>
              )}
              <span className="flex-1 text-sm font-medium text-foreground truncate">{animal.name}</span>
              {animal.id === selectedId && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground text-center">Нет доступных животных</p>
          )}
        </motion.div>
      )}
    </div>
  );
}

function MetricComparisonRow({
  label,
  emoji,
  metricKey,
  valueA,
  valueB,
}: {
  label: string;
  emoji: string;
  metricKey: string;
  valueA: number;
  valueB: number;
}) {
  const diff = valueA - valueB;
  const winner = diff > 0 ? "A" : diff < 0 ? "B" : "tie";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2 w-24 text-sm text-muted-foreground">
        {METRIC_ICONS[metricKey]}
        <span>{label}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className={`text-sm font-semibold w-8 text-right ${winner === "A" ? "text-[#6d8c54]" : "text-foreground"}`}>
          {valueA}
        </span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
          <div
            className="h-full rounded-l-full transition-all"
            style={{
              width: `${(valueA / (valueA + valueB || 1)) * 100}%`,
              backgroundColor: "#6d8c54",
            }}
          />
          <div
            className="h-full rounded-r-full transition-all"
            style={{
              width: `${(valueB / (valueA + valueB || 1)) * 100}%`,
              backgroundColor: "#c77d3a",
            }}
          />
        </div>
        <span className={`text-sm font-semibold w-8 ${winner === "B" ? "text-[#c77d3a]" : "text-foreground"}`}>
          {valueB}
        </span>
      </div>
      {diff !== 0 && (
        <span className={`text-xs font-medium ${winner === "A" ? "text-[#6d8c54]" : "text-[#c77d3a]"}`}>
          {winner === "A" ? `+${diff}` : `${diff}`}
        </span>
      )}
      {diff === 0 && <span className="text-xs text-muted-foreground w-8">=</span>}
    </div>
  );
}

export default function AnimalCompare() {
  const [animalIdA, setAnimalIdA] = useState<number | null>(null);
  const [animalIdB, setAnimalIdB] = useState<number | null>(null);
  const [preselected, setPreselected] = useState(false);

  // Read ?animal=slug query parameter for pre-selection from AnimalProfile
  const searchString = useSearch();
  const preselectedSlug = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("animal") || null;
  }, [searchString]);

  // Get herd leaderboard which includes wellness metrics
  const { data: herdData, isLoading: herdLoading } = trpc.gamification.leaderboard.herd.useQuery({ limit: 50 });

  const animals = useMemo(() => {
    if (!herdData) return [];
    return herdData
      .filter((h: any) => h.animal)
      .map((h: any) => ({
        id: h.animalId,
        name: h.animal.name || `Животное #${h.animalId}`,
        species: h.animal.species || "goat",
        coverImageUrl: h.animal.coverImageUrl,
        slug: h.animal.slug,
        metrics: {
          happiness: h.happiness,
          health: h.health,
          attachment: h.attachment,
          mood: h.mood,
          obedience: h.obedience,
          overallRating: h.overallRating,
        },
      }));
  }, [herdData]);

  // Pre-select animal A from query parameter
  useEffect(() => {
    if (preselected || !preselectedSlug || animals.length === 0) return;
    const match = animals.find((a: any) => a.slug === preselectedSlug || String(a.id) === preselectedSlug);
    if (match) {
      setAnimalIdA(match.id);
      setPreselected(true);
    }
  }, [preselectedSlug, animals, preselected]);

  const animalA = animals.find((a: any) => a.id === animalIdA);
  const animalB = animals.find((a: any) => a.id === animalIdB);

  const radarDataA = animalA
    ? METRIC_LABELS.map((m) => ({
        label: m.label,
        value: animalA.metrics[m.key as keyof typeof animalA.metrics] ?? 0,
        emoji: m.emoji,
      }))
    : [];

  const radarDataB = animalB
    ? METRIC_LABELS.map((m) => ({
        label: m.label,
        value: animalB.metrics[m.key as keyof typeof animalB.metrics] ?? 0,
        emoji: m.emoji,
      }))
    : [];

  // Calculate winner
  const totalA = radarDataA.reduce((s, d) => s + d.value, 0);
  const totalB = radarDataB.reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl pt-24 pb-12">
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          className="mb-6"
          items={[
            { label: "Главная", href: "/" },
            { label: "Каталог", href: "/animals" },
            ...(animalA
              ? [{ label: animalA.name, href: `/animal/${animalA.slug || animalA.id}` }]
              : []),
            { label: "Сравнение" },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Сравнение животных</h1>
              <p className="text-sm text-muted-foreground">Выберите двух животных для сравнения метрик бок о бок</p>
            </div>
          </div>
        </div>

        {herdLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Animal selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <AnimalSelector
                animals={animals}
                selectedId={animalIdA}
                onSelect={setAnimalIdA}
                label="Животное A"
                excludeId={animalIdB}
              />
              <AnimalSelector
                animals={animals}
                selectedId={animalIdB}
                onSelect={setAnimalIdB}
                label="Животное B"
                excludeId={animalIdA}
              />
            </div>

            {animalA && animalB ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Winner banner */}
                {totalA !== totalB && (
                  <div className={`rounded-2xl border p-4 text-center ${
                    totalA > totalB
                      ? "border-[#6d8c54]/30 bg-[#6d8c54]/5"
                      : "border-[#c77d3a]/30 bg-[#c77d3a]/5"
                  }`}>
                    <Trophy className={`h-6 w-6 mx-auto mb-1 ${totalA > totalB ? "text-[#6d8c54]" : "text-[#c77d3a]"}`} />
                    <p className="text-sm font-semibold text-foreground">
                      {totalA > totalB ? animalA.name : animalB.name} лидирует
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Сумма метрик: {Math.max(totalA, totalB)} vs {Math.min(totalA, totalB)} (разница: {Math.abs(totalA - totalB)})
                    </p>
                  </div>
                )}

                {/* Radar chart */}
                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <ComparisonRadarChart
                    dataA={radarDataA}
                    dataB={radarDataB}
                    labelA={animalA.name}
                    labelB={animalB.name}
                    size={340}
                  />
                </div>

                {/* Metric-by-metric comparison */}
                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Детальное сравнение</h3>
                  <div className="divide-y divide-border/50">
                    {METRIC_LABELS.map((m) => (
                      <MetricComparisonRow
                        key={m.key}
                        label={m.label}
                        emoji={m.emoji}
                        metricKey={m.key}
                        valueA={animalA.metrics[m.key as keyof typeof animalA.metrics] ?? 0}
                        valueB={animalB.metrics[m.key as keyof typeof animalB.metrics] ?? 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Links to profiles */}
                <div className="grid grid-cols-2 gap-4">
                  {[animalA, animalB].map((animal, idx) => (
                    <Link
                      key={animal.id}
                      href={`/animals/${animal.slug || animal.id}`}
                      className={`rounded-2xl border p-4 hover:shadow-md transition-shadow flex items-center gap-3 ${
                        idx === 0 ? "border-[#6d8c54]/30" : "border-[#c77d3a]/30"
                      }`}
                    >
                      {animal.coverImageUrl && animal.coverImageUrl !== "NULL" ? (
                        <img src={animal.coverImageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          {animal.species === "goat" ? "🐐" : "🐑"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{animal.name}</p>
                        <p className="text-xs text-muted-foreground">Открыть профиль →</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Выберите двух животных для сравнения</p>
                <p className="text-sm mt-1">Используйте селекторы выше, чтобы выбрать животных из стада</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
