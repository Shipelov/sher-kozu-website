/*
Design Philosophy Reminder — Dashboard.tsx
Biomorphic Tech owner cockpit.
Core: not an admin panel, but a premium emotional operating system for personal farming.
Must feel like a living bridge between animal, products, club and future AI curation.
*/

import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  Bot,
  Calendar,
  Camera,
  ChevronRight,
  Heart,
  Milk,
  Package,
  Sparkles,
  Truck,
  Users,
  Waves,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
  dairyBox: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
};

const diaryEntries = [
  {
    title: "Утренний обход завершён",
    date: "Сегодня · 07:20",
    text: "Марта бодра, активно ест и спокойно реагирует на новую порцию сена. Уходовая команда отмечает хороший ритм и стабильное настроение.",
  },
  {
    title: "Подготовлена именная коробка",
    date: "Сегодня · 11:10",
    text: "Партия молока и сыр «Марта Петровых» уже собраны в коробку семьи. Трекер продукта обновлён и готов к следующему статусу доставки.",
  },
  {
    title: "Подтверждён клубный визит",
    date: "Вчера · 18:40",
    text: "Семья записана на камерный визит на ферму с дегустацией и встречей с Мартой. Сценарий усиливает личную связь между продуктом и жизнью животного.",
  },
];

const clubMoments = [
  { title: "Закрытый ужин на ферме", meta: "22 марта · 4 места" },
  { title: "День рождения Марты", meta: "14 апреля · персональный формат" },
  { title: "Мастер-класс по сыроварению", meta: "5 апреля · 8 мест" },
];

const notifications = [
  "Марта сегодня в спокойном ритме — команда ухода не заметила отклонений.",
  "Коробка семьи собрана на 45% и уже связана с активной партией молока.",
  "Клуб напомнит о визите на ферму за 24 часа и покажет персональный маршрут дня.",
];

const atmosphereSignals = [
  "Каждый блок ведёт в другой слой экосистемы, а не замыкается на себе.",
  "Визуальный язык кабинета соединяет продуктовую прозрачность с теплом семейной фермы.",
  "Даже live-слой работает как эмоциональное присутствие, а не как декоративный виджет.",
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="relative min-h-[420px] overflow-hidden">
                <img src={CDN.hero} alt="Семейная ферма" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.86),rgba(25,22,20,0.48),rgba(25,22,20,0.18))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-300 backdrop-blur">
                      <Sparkles className="h-4 w-4" />
                      Кабинет владельца
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/80 backdrop-blur">
                      <MapPin className="h-4 w-4" />
                      Ферма, животное, продукт и клуб в одном ритме
                    </div>
                  </div>

                  <div className="max-w-2xl">
                    <h1 className="font-display text-4xl text-white md:text-6xl">Цифровое сердце Sher Kozu собирает личное фермерство в один понятный маршрут.</h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/76 md:text-base">
                      Это не обычный личный кабинет. Здесь владелец видит состояние животного, путь продукта, клубную жизнь и сигналы,
                      которые поддерживают вовлечённость между доставками и визитами.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(250,245,237,0.92))] p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Марта", value: "в хорошем ритме", icon: Heart },
                    { label: "Активная доставка", value: "ДСТ-2026-031", icon: Package },
                    { label: "Следующее событие", value: "Клубный ужин", icon: Calendar },
                    { label: "Прозрачность партии", value: "подтверждена", icon: ShieldCheck },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{item.value}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                  <img src={CDN.dairyBox} alt="Именная продуктовая коробка" className="h-44 w-full object-cover" />
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Продукт в фокусе</p>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">Именная коробка уже собрана как продолжение истории Марты.</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Визуальный слой кабинета показывает, что продукт — это не отдельная покупка, а материализованное продолжение связи с животным.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-12 gap-5">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Сводка дня</p>
                  <h3 className="mt-2 text-2xl font-semibold text-foreground">Марта, продукт и маршрут семьи синхронизированы.</h3>
                </div>
                <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                  <span className="pulse-dot" />
                  Live day status
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                Кабинет должен быстро объяснять состояние системы: как чувствует себя животное, какая доставка в фокусе и где находится
                следующая эмоциональная точка контакта семьи с фермой.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Надой сегодня", value: "1.8 л", icon: Milk },
                  { label: "Именной продукт", value: "Сыр созрел", icon: Sparkles },
                  { label: "Маршрут", value: "Ферма → семья", icon: Truck },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl bg-secondary/55 p-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.16em]">{item.label}</span>
                      </div>
                      <div className="mt-3 text-lg font-semibold text-foreground">{item.value}</div>
                    </div>
                  );
                })}
              </div>

              <Link href="/tracker" className="group mt-5 flex flex-col items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-foreground">Открыть полный трекер продукта</div>
                  <div className="mt-1 text-xs text-muted-foreground">Состав молока, надои и история доставок</div>
                </div>
                <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm md:col-span-5"
            >
              <div className="relative">
                <img src={CDN.liveCam} alt="Портрет Марты" className="h-72 w-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/80 via-dark-oak/10 to-transparent" />
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs backdrop-blur">
                    <Camera className="h-3.5 w-3.5" />
                    Камера · Стойло №3
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold">Прямой эфир и портрет делают присутствие реальным.</h3>
                  <p className="mt-2 text-sm leading-6 text-white/74">Даже когда пользователь не на ферме, кабинет возвращает ощущение личного контакта и включённости.</p>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-2xl bg-secondary/55 p-4 text-sm text-muted-foreground">
                  Live-слой должен работать как эмоциональный мост между продуктом, заботой о животном и клубными визитами.
                </div>

                <Link href="/animal/marta" className="group mt-4 flex flex-col items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-foreground">Перейти к профилю Марты</div>
                    <div className="mt-1 text-xs text-muted-foreground">Открыть галерею, историю и профиль животного</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Дневник</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Последние события из жизни Марты</h3>
                </div>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-4 space-y-3">
                {diaryEntries.map((entry) => (
                  <div key={entry.title} className="rounded-2xl bg-muted/45 p-4 transition-colors hover:bg-muted/65">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.text}</p>
                  </div>
                ))}
              </div>

              <Link href="/animal/marta" className="group mt-4 flex flex-col items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-foreground">Продолжить в профиле Марты</div>
                  <div className="mt-1 text-xs text-muted-foreground">Открыть полную биографию, галерею и фотопоток</div>
                </div>
                <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-5"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Клуб</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Ближайшие моменты сообщества</h3>
                </div>
                <Users className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-4 space-y-3">
                {clubMoments.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-white p-4">
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.meta}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                <Link href="/club" className="group flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-secondary/80">
                  <span>Открыть клубную ленту</span>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/tracker" className="group flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                  <div>
                    <div className="font-semibold text-foreground">Проверить продуктовый трекер</div>
                    <div className="mt-1 text-xs text-muted-foreground">Увидеть путь коробки и активную доставку</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)]"
            >
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-300">
                    <Bot className="h-3.5 w-3.5" />
                    AI-блок для Sprint 2
                  </div>
                  <h3 className="mt-4 font-display text-3xl">Куратор владельца появится здесь.</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                    Следующий слой ценности — персональные рекомендации по уходу, объяснение событий фермы,
                    сценарии возвращения в продукт и персональные подсказки по клубной жизни.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/65">
                    <span className="rounded-full border border-white/15 px-3 py-1">голос животного</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">истории и объяснения</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">сценарии возврата</span>
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 rounded-[1.5rem] bg-white/8 p-4 backdrop-blur md:min-w-[300px]">
                  {notifications.map((note) => (
                    <div key={note} className="rounded-2xl border border-white/10 bg-white/8 p-3 text-sm text-white/82">
                      {note}
                    </div>
                  ))}
                  <div className="rounded-2xl border border-dashed border-white/20 p-3 text-xs text-white/55">
                    Пространство для AI-объяснений, рекомендаций и следующих лучших действий владельца.
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
            >
              <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
                <img src={CDN.family} alt="Семья на ферме" className="h-full min-h-[260px] w-full object-cover" />
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Ритм участия</p>
                  <h3 className="mt-2 text-2xl font-semibold text-foreground">Сайт удерживает пользователя между продуктом, животным и жизнью фермы.</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Каждая зона дашборда должна вести либо в эмоциональный слой, либо в продуктовый маршрут,
                    либо в клубную среду. Поэтому визуальные блоки здесь не декоративны, а навигационно значимы.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: Waves, label: "Живой ритм", value: "Дневник + Live" },
                      { icon: Calendar, label: "Возврат", value: "События клуба" },
                      { icon: Camera, label: "Присутствие", value: "24/7 touchpoints" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-2xl bg-secondary/55 p-4">
                          <Icon className="h-4 w-4 text-primary" />
                          <div className="mt-3 text-xs uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
                          <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 space-y-2">
                    {atmosphereSignals.map((note) => (
                      <div key={note} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Star className="mt-0.5 h-4 w-4 text-accent" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
