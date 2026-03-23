import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Trophy,
  Crown,
  Medal,
  Star,
  Heart,
  ChevronLeft,
  Sparkles,
  Users,
  Loader2,
} from "lucide-react";
import WellnessRadarChart from "@/components/WellnessRadarChart";
import ShowMoreList from "@/components/ShowMoreList";

/* ── Title helpers ── */
const TITLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  legend: { label: "Легенда фермы", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  master: { label: "Мастер заботы", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  expert: { label: "Эксперт фермы", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  caretaker: { label: "Заботливый хозяин", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  newcomer: { label: "Новичок", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

function getTitleInfo(title?: string | null) {
  return TITLE_LABELS[title ?? "newcomer"] ?? TITLE_LABELS.newcomer;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">{rank}</span>;
}

type TabId = "herd" | "owners";

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<TabId>("herd");
  const { user } = useAuth();

  const herdQuery = trpc.gamification.leaderboard.herd.useQuery({ limit: 20 });
  const ownersQuery = trpc.gamification.leaderboard.owners.useQuery({ limit: 20 });
  const myRatingQuery = trpc.gamification.leaderboard.myRating.useQuery();

  const tabs: { id: TabId; label: string; icon: typeof Trophy }[] = [
    { id: "herd", label: "Рейтинг стада", icon: Heart },
    { id: "owners", label: "Рейтинг владельцев", icon: Users },
  ];

  const myRating = myRatingQuery.data;
  const myTitle = getTitleInfo(myRating?.title);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pb-14 pt-24 md:pt-28">
        <div className="container space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-border p-2 transition hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Рейтинг фермы</h1>
              <p className="text-sm text-muted-foreground">Чем больше заботы — тем выше рейтинг</p>
            </div>
          </div>

          {/* My Rating Card */}
          {myRating && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2rem] border border-border/70 bg-gradient-to-r from-card via-card to-primary/5 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Ваш рейтинг</p>
                    <p className="mt-0.5 text-2xl font-bold text-foreground">
                      {myRating.totalScore ?? 0}
                      <span className="ml-2 text-sm font-medium text-muted-foreground">очков</span>
                    </p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${myTitle.bg} ${myTitle.color}`}>
                  <Sparkles className="h-4 w-4" />
                  {myTitle.label}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Средний рейтинг животных</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{myRating.averageAnimalRating ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Бонус активности</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">+{myRating.activityBonus ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Количество животных</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{myRating.animalCount ?? 0}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Herd Leaderboard */}
          {activeTab === "herd" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {herdQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !herdQuery.data?.length ? (
                <div className="rounded-[2rem] border border-dashed border-border bg-card p-8 text-center">
                  <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Рейтинг стада пока пуст — покупайте подарки в маркетплейсе, чтобы ваше животное поднялось в рейтинге.</p>
                </div>
              ) : (
                <ShowMoreList
                  items={herdQuery.data}
                  pageSize={10}
                  getKey={(animal: any) => animal.animalId}
                  className="space-y-3"
                  buttonLabel="Показать ещё"
                  renderItem={(animal: any, idx: number) => (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`rounded-2xl border p-4 transition ${
                        idx < 3 ? "border-primary/20 bg-primary/5" : "border-border/70 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-border/50">
                          {getRankIcon(idx + 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/animals/${animal.animal?.slug ?? animal.animalId}`} className="font-semibold text-foreground hover:text-primary truncate">
                              {animal.animal?.name ?? `Животное #${animal.animalId}`}
                            </Link>
                            {idx === 0 && <Crown className="h-4 w-4 text-amber-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Общий рейтинг: {animal.overallRating ?? 0}
                          </p>
                        </div>
                        <div className="hidden sm:block">
                          <WellnessRadarChart
                            metrics={{
                              happiness: animal.happiness ?? 50,
                              health: animal.health ?? 50,
                              attachment: animal.attachment ?? 50,
                              mood: animal.mood ?? 50,
                              obedience: animal.obedience ?? 50,
                            }}
                            size={90}
                          />
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{animal.overallRating ?? 0}</div>
                          <div className="text-[10px] text-muted-foreground">ОЧКОВ</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                />
              )}
            </motion.div>
          )}

          {/* Owners Leaderboard */}
          {activeTab === "owners" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {ownersQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !ownersQuery.data?.length ? (
                <div className="rounded-[2rem] border border-dashed border-border bg-card p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Рейтинг владельцев пока пуст.</p>
                </div>
              ) : (
                <ShowMoreList
                  items={ownersQuery.data}
                  pageSize={10}
                  getKey={(owner: any) => owner.ownerOpenId}
                  className="space-y-3"
                  buttonLabel="Показать ещё"
                  renderItem={(owner: any, idx: number) => {
                    const titleInfo = getTitleInfo(owner.title);
                    const isMe = user?.openId === owner.ownerOpenId;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`rounded-2xl border p-4 transition ${
                          isMe
                            ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                            : idx < 3
                            ? "border-primary/20 bg-primary/5"
                            : "border-border/70 bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-border/50">
                            {getRankIcon(idx + 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {owner.user?.name ?? "Владелец"}
                                {isMe && <span className="ml-1 text-xs text-primary">(вы)</span>}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${titleInfo.bg} ${titleInfo.color}`}>
                                <Star className="h-3 w-3" />
                                {titleInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {owner.animalCount ?? 0} животных · Средний рейтинг: {owner.averageAnimalRating ?? 0}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{owner.totalScore ?? 0}</div>
                            <div className="text-[10px] text-muted-foreground">ОЧКОВ</div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }}
                />
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
