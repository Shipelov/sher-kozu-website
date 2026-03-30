import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";

import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ScrollRemaining from "@/components/ScrollRemaining";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import {
  Award,
  Bell,
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  Sparkles,
  Star,
  Users,
  Wine,
} from "lucide-react";

const CDN = {
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
};

const filters = [
  { key: "all", label: "Все" },
  { key: "journal", label: "Дневник" },
  { key: "event", label: "События" },
  { key: "member", label: "Участники" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

type ClubPost = {
  id: number;
  category: string;
  author: string;
  avatar: string;
  role: string;
  timeLabel: string;
  title: string;
  text: string;
  imageUrl: string | null;
  likes: number;
  comments: number;
  tagsCsv: string | null;
  pinned: number;
};

type ClubEvent = {
  id: number;
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
};

type ClubMember = {
  id: number;
  name: string;
  animal: string;
  sinceLabel: string;
  badge: string;
};

function toneClassName(tone: string) {
  switch (tone) {
    case "warm":
      return "bg-amber-50 border-amber-200";
    case "rose":
      return "bg-rose-50 border-rose-200";
    case "soft":
    default:
      return "bg-green-50 border-green-200";
  }
}

function normalizeTags(tagsCsv: string | null) {
  if (!tagsCsv) return [] as string[];
  return tagsCsv
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function PostCard({ post }: { post: ClubPost }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const likeCount = liked ? post.likes + 1 : post.likes;
  const tags = normalizeTags(post.tagsCsv);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
    >
      {post.pinned ? (
        <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-5 py-3 text-xs font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Закреплённое сообщение от фермы
        </div>
      ) : null}

      <div className="p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
              {post.avatar}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{post.author}</div>
              <div className="text-xs text-muted-foreground">
                {post.role} · {post.timeLabel}
              </div>
            </div>
          </div>

          <button
            onClick={() => setSaved((value) => !value)}
            className={`rounded-xl p-2 transition-colors ${saved ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Bookmark className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-semibold text-foreground">{post.title}</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.text}</p>
        </div>

        {post.imageUrl ? (
          <div className="mt-4 overflow-hidden rounded-[1.5rem]">
            <img src={post.imageUrl} alt={post.title} className="h-60 w-full object-cover transition-transform duration-500 hover:scale-105" />
          </div>
        ) : null}

        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <button onClick={() => setLiked((value) => !value)} className={`flex items-center gap-2 transition-colors ${liked ? "text-rose-500" : "hover:text-rose-500"}`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
            {likeCount}
          </button>
          <button className="flex items-center gap-2 transition-colors hover:text-foreground">
            <MessageCircle className="h-4 w-4" />
            {post.comments}
          </button>
          <button className="ml-auto flex items-center gap-2 transition-colors hover:text-foreground">
            <Share2 className="h-4 w-4" />
            Поделиться
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function ClubFeed() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const requestedAnimalSlug = useMemo(() => {
    return new URLSearchParams(searchString).get("animal") || null;
  }, [searchString]);

  const { isAuthenticated } = useAuth();

  const clubQuery = trpc.club.feed.useQuery();
  const dashboardQuery = trpc.animals.ownerDashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const animalsQuery = trpc.animals.listPublic.useQuery();

  const posts = (clubQuery.data?.posts ?? []) as ClubPost[];
  const events = (clubQuery.data?.events ?? []) as ClubEvent[];
  const members = (clubQuery.data?.members ?? []) as ClubMember[];

  const ownerAnimal = dashboardQuery.data?.animal ?? null;
  const ownership = dashboardQuery.data?.ownership ?? null;
  const fallbackAnimal = animalsQuery.data?.find((animal) => animal.slug === requestedAnimalSlug) ?? animalsQuery.data?.[0] ?? null;

  const activeAnimalSlug = requestedAnimalSlug ?? ownerAnimal?.slug ?? fallbackAnimal?.slug ?? "";
  const activeAnimalName = ownerAnimal?.name ?? fallbackAnimal?.name ?? "вашего животного";
  const activeAnimalCoverUrl = animalsQuery.data?.find((a) => a.slug === activeAnimalSlug)?.coverImageUrl ?? ownerAnimal?.coverImageUrl ?? null;
  const activeAnimalSharePercent = ownership?.sharePercent ?? ownerAnimal?.mySharePercent ?? 0;

  const profileHref = `/animals/${activeAnimalSlug}`;
  const trackerHref = `/tracker?animal=${activeAnimalSlug}`;
  const dashboardHref = activeAnimalSlug ? `/dashboard?animal=${activeAnimalSlug}` : "/dashboard";
  const clubHref = activeAnimalSlug ? `/club?animal=${activeAnimalSlug}` : "/club";
  const isGuestJourney = !ownership;

  const visiblePosts = useMemo(() => {
    if (activeFilter === "all") return posts;
    if (activeFilter === "member") {
      return posts.filter((post) => post.category === "member" || post.category === "members");
    }
    return posts.filter((post) => post.category === activeFilter);
  }, [activeFilter, posts]);

  const clubSignals = activeAnimalSharePercent
    ? [
        `Ваш клуб строится вокруг ${activeAnimalName} и вашего участия ${activeAnimalSharePercent}%.`,
        "Дневник фермы, визиты, семейные события — всё связано с вашим животным.",
        "Профиль животного, трекер продуктов и личный кабинет — всегда на расстоянии одного клика.",
      ]
    : [
        "События, дневник фермы и живые истории участников.",
        "Каждый пост связан с животным, продуктом или семейным визитом.",
        "Профиль животного, трекер и кабинет — всегда на расстоянии одного клика.",
      ];

  const stats = [
    { value: String(members.length || 0), label: "семей в клубе" },
    { value: String(events.length || 0), label: "события в календаре" },
    { value: String(posts.reduce((sum, post) => sum + post.likes, 0)), label: "суммарных реакций" },
    { value: activeAnimalSharePercent ? `${activeAnimalSharePercent}%` : posts.length ? "live" : "0", label: activeAnimalSharePercent ? "ваше участие" : "ритм сообщества" },
  ];

  const nextEvent = events.find((event) => ["Открыта запись", "Мест осталось мало", "Скоро"].includes(event.status)) ?? events[0] ?? null;
  const ritualTitle = nextEvent?.title ? `${nextEvent.title} — событие с ${activeAnimalName}.` : `День ${activeAnimalName} уже в календаре.`;
  const ritualDescription = nextEvent?.description ?? (activeAnimalSharePercent
    ? `Ваше участие ${activeAnimalSharePercent}% делает клубные события личными — каждое связано с ${activeAnimalName} и вашей семьёй.`
    : "Семейные визиты, мастер-классы и праздники — события, которые остаются в памяти.");

  const heroDescription = ownership
    ? `Дневник фермы, события и истории участников — всё вокруг ${activeAnimalName} и вашего участия ${activeAnimalSharePercent}%.`
    : "Дневник фермы, семейные визиты, мастер-классы и живые истории участников — место, где ферма становится частью вашей жизни."

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <PageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Главная", href: "/" },
              { label: "Клуб" },
            ]}
          />

          {/* Animal Switcher */}
          {(animalsQuery.data?.length ?? 0) > 1 && (
            <div className="relative mb-6" data-testid="clubAnimalSwitcher">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="inline-flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                {activeAnimalCoverUrl ? (
                  <img
                    src={activeAnimalCoverUrl}
                    alt={activeAnimalName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-primary">
                    <Heart className="h-3.5 w-3.5" />
                  </div>
                )}
                <span>{activeAnimalName}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {switcherOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
                  >
                    <div className="p-2">
                      <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Переключить животное
                      </p>
                      {animalsQuery.data?.map((animal) => {
                        const isActive = animal.slug === activeAnimalSlug;
                        return (
                          <button
                            key={animal.slug}
                            onClick={() => {
                              setLocation(`/club?animal=${animal.slug}`);
                              setSwitcherOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                              isActive
                                ? "bg-primary/8 font-semibold text-primary"
                                : "text-foreground hover:bg-secondary/60"
                            }`}
                          >
                            {animal.coverImageUrl ? (
                              <img
                                src={animal.coverImageUrl}
                                alt={animal.name}
                                className="h-9 w-9 rounded-full object-cover ring-2 ring-border/40"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-2 ring-border/40">
                                <Heart className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{animal.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {animal.species === "goat" ? "Коза" : animal.species === "sheep" ? "Овца" : animal.species}
                                {animal.breed ? ` · ${animal.breed}` : ""}
                              </div>
                            </div>
                            {isActive && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {switcherOpen && (
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setSwitcherOpen(false)}
                />
              )}
            </div>
          )}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8 overflow-hidden rounded-[2.25rem] border border-border/70 shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <img src={CDN.club} alt="Клуб Шерь Козу" className="h-[420px] w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.82),rgba(25,22,20,0.34),rgba(25,22,20,0.18))]" />
            <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-300 backdrop-blur">
                  <Award className="h-4 w-4" />
                  Закрытый клуб владельцев
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/80 backdrop-blur">
                  <MapPin className="h-4 w-4" />
                  {ownership ? `${activeAnimalName} · ${activeAnimalSharePercent}% участия` : "Семейная ферма + digital community"}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="max-w-2xl">
                  <h1 className="font-display text-4xl text-white md:text-6xl">Клуб Шерь Козу — сообщество семей, которые знают своих животных по имени.</h1>
                  <p className="mt-4 text-sm leading-7 text-white/75 md:text-base">{heroDescription}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-center text-white sm:grid-cols-2">
                  {stats.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                      <div className="font-mono-data text-2xl font-semibold">{item.value}</div>
                      <div className="mt-1 text-xs text-white/70">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 space-y-4 lg:col-span-7">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                {filters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      activeFilter === filter.key
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {clubQuery.isLoading ? (
                <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm" data-testid="clubLoading">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Загружаем живую клубную ленту фермы…
                  </div>
                </div>
              ) : null}

              {clubQuery.isError ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[2rem] border border-destructive/30 bg-destructive/5 p-6 shadow-sm"
                  data-testid="clubError"
                >
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-foreground">Не удалось загрузить клубную ленту</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Произошла ошибка при загрузке постов, событий и участников. Попробуйте обновить страницу.
                      </p>
                    </div>
                    <button
                      onClick={() => clubQuery.refetch()}
                      className="shrink-0 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90"
                    >
                      Попробовать снова
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {!clubQuery.isLoading && !clubQuery.isError && !visiblePosts.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[2rem] border border-dashed border-primary/20 bg-primary/5 p-6 text-center shadow-sm"
                  data-testid="clubEmptyPosts"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-foreground">Клубная лента пока пуста</h4>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {activeFilter !== "all"
                      ? `Нет публикаций в категории \u00ab${filters.find(f => f.key === activeFilter)?.label}\u00bb. Попробуйте выбрать \u00abВсе\u00bb или другой фильтр.`
                      : "После первого события или дневниковой записи здесь появится живая история вашей фермы."}
                  </p>
                  {activeFilter !== "all" && (
                    <button
                      onClick={() => setActiveFilter("all")}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Показать все
                    </button>
                  )}
                </motion.div>
              ) : null}

              {visiblePosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            <div className="col-span-12 space-y-4 lg:col-span-5">
              <motion.section
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
                className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">Календарь клуба</p>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">Ближайшие события клуба</h2>
                  </div>
                  <Calendar className="h-5 w-5 text-primary" />
                </div>

                <ScrollRemaining totalItems={events.length} itemHeight={120} className="mt-5 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {events.length ? (
                    events.map((event) => (
                      <div key={event.id} className={["min-w-0 rounded-[1.5rem] border p-4", toneClassName(event.tone)].join(" ")}>
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                          <span className="text-xs text-muted-foreground">{event.dateLabel}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-foreground">{event.status}</span>
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                            Записаться <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Ближайшие события появятся здесь после публикации новой клубной программы.
                    </div>
                  )}
                </ScrollRemaining>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="min-w-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
              >
                <img src={(ownerAnimal?.coverImageUrl && ownerAnimal.coverImageUrl !== "NULL") ? ownerAnimal.coverImageUrl : CDN.goat} alt={activeAnimalName} className="h-56 w-full object-cover object-top" />
                <div className="p-5">
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Персональный ритуал</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{ritualTitle}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{ritualDescription}</p>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.16 }}
                className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">Участники</p>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">Кто уже внутри клуба</h2>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>

                <ScrollRemaining totalItems={members.length} itemHeight={64} className="mt-5 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {members.length ? (
                    members.map((member) => (
                      <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-[1.5rem] bg-secondary/50 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-xs font-semibold text-primary">
                          {member.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground">{member.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.animal} · {member.sinceLabel}
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-[11px] text-primary shadow-sm">{member.badge}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Состав клуба появится здесь после добавления первых участников.
                    </div>
                  )}
                </ScrollRemaining>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)]"
              >
                <div className="flex items-center gap-2 text-amber-300">
                  <Wine className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.2em]">Маршруты сообщества</span>
                </div>
                <h2 className="mt-4 font-display text-3xl">Животное, продукт и семья — всё связано.</h2>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  {ownership
                    ? `Из клуба вы можете перейти к профилю ${activeAnimalName}, трекеру продуктов или личному кабинету.`
                    : "События, сообщество и ощущение принадлежности к жизни фермы."}
                </p>
                {isGuestJourney ? (
                  <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-white/8 p-4 text-sm text-white/78">
                    <div className="text-xs uppercase tracking-[0.16em] text-amber-300">Как присоединиться</div>
                    <div className="mt-2 text-base font-semibold text-white">Клуб → Профиль животного → Выбор доли → Вход</div>
                    <p className="mt-2 leading-6 text-white/65">
                      Клуб можно изучать и без аккаунта. Следующий шаг — откройте профиль животного, выберите формат участия и войдите в аккаунт, чтобы клуб стал персональным.
                    </p>
                  </div>
                ) : null}
                <div className="mt-5 space-y-2 text-sm text-white/72">
                  {clubSignals.map((note) => (
                    <div key={note} className="flex items-start gap-2">
                      <Star className="mt-0.5 h-4 w-4 text-amber-300" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3">
                  <Link href={profileHref} className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-white">К профилю {activeAnimalName}</div>
                      <div className="mt-1 text-xs text-white/60">Дневник, история и галерея вашего животного</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link href={trackerHref} className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-white">К трекеру продуктов</div>
                      <div className="mt-1 text-xs text-white/60">Состав молока, доставки и путь продукта</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link href={dashboardHref} className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-white">В кабинет</div>
                      <div className="mt-1 text-xs text-white/60">Ваше участие, следующие шаги и быстрые действия</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.24 }}
                className="min-w-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
              >
                <div className="grid gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <img src={CDN.family} alt="Семейный визит" className="h-full min-h-[220px] w-full object-cover" />
                  <div className="p-5">
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">Уведомления клуба</p>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">Уведомления клуба</h2>
                    <div className="mt-5 space-y-3">
                      {[
                        `Новые посты о ${activeAnimalName} и команде ухода`,
                        "Анонсы клубных событий и персональных визитов",
                        ownership ? "Упоминания вашей семьи и животного в ленте" : "Упоминания семьи и животного в ленте",                      ].map((item) => (
                        <div key={item} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/55 px-4 py-3">
                          <span className="text-sm text-foreground">{item}</span>
                          <div className="flex h-6 w-11 shrink-0 items-center rounded-full bg-primary px-1">
                            <div className="ml-auto h-4 w-4 rounded-full bg-white shadow" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <Bell className="h-4 w-4 text-primary" />
                      Уведомления помогают не пропустить важное.
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Link href={profileHref} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92">
                        К профилю {activeAnimalName}
                      </Link>
                      <Link href={trackerHref} className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                        К трекеру продуктов
                      </Link>
                      <Link href={dashboardHref} className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                        В кабинет
                      </Link>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Текущий клубный маршрут: <Link href={clubHref} className="text-primary hover:underline">{activeAnimalName}</Link>
                    </div>
                  </div>
                </div>
              </motion.section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
