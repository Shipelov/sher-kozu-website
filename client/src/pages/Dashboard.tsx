/*
Design Philosophy Reminder — Dashboard.tsx
Biomorphic Tech owner dashboard.
Core hierarchy: animal first, product second, club third, AI fourth.
Must feel like a warm ownership hub, not an order management panel.
*/

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Bell,
  BookOpen,
  Bot,
  Camera,
  Calendar,
  ChevronRight,
  Heart,
  Milk,
  Package,
  Sparkles,
  Star,
  Thermometer,
  Truck,
  Users,
  Waves,
} from "lucide-react";

const CDN = {
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  delivery: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/delivery_box_6b16c712.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
};

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 250);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone} progress-bar-fill`} style={{ width: `${width}%` }} />
    </div>
  );
}

const diaryEntries = [
  {
    date: "13 марта",
    title: "Марта встретила утро на солнечном выгуле",
    text: "Сегодня у неё высокий аппетит, спокойный ритм и отличный надой. После обеда фермер загрузил новые фотографии в дневник.",
  },
  {
    date: "12 марта",
    title: "SPA-уход и расчёсывание шерсти",
    text: "Плановые процедуры прошли мягко: груминг, травяная ванна и осмотр копыт. Показатели здоровья сохранили высокий уровень.",
  },
  {
    date: "11 марта",
    title: "Первая весенняя прогулка на лугу",
    text: "Марта провела на открытом воздухе почти три часа. Это повысило активность и настроение — что важно для пользовательского чувства связи.",
  },
];

const clubMoments = [
  {
    title: "Закрытый ужин на ферме",
    meta: "22 марта · осталось 4 места",
  },
  {
    title: "Семейный визит к Марте",
    meta: "5 апреля · персональная запись",
  },
  {
    title: "Мастер-класс по сыроварению",
    meta: "12 апреля · клубный формат",
  },
];

const notifications = [
  "Новая запись в дневнике Марты опубликована 2 часа назад",
  "Следующая доставка сформирована на 15 марта",
  "Именной сыр «Марта Петровых» готов к включению в коробку",
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid gap-4 rounded-[2rem] border border-border/70 bg-white/80 p-5 shadow-sm backdrop-blur md:grid-cols-[1fr_auto] md:items-center"
          >
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-primary">Owner dashboard</p>
                <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Александр, здесь соединяются Марта, продукты и клубная жизнь.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Это главный экран владельца: живая связь с животным, статус семейной коробки и маршруты в клуб и трекер происхождения.
                </p>
              </div>

            <div className="flex items-center gap-3 self-start md:self-center">
              <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm transition-colors hover:bg-muted/50">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-accent" />
              </button>
              <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-primary">Статус</div>
                <div className="mt-1 font-mono-data text-sm font-semibold text-foreground">Owner since 14.02.2025</div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-12 gap-4 md:gap-5">
            <motion.section
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_30px_70px_-38px_rgba(26,58,42,0.28)] lg:col-span-5"
            >
              <div className="relative h-64 overflow-hidden">
                <img src={CDN.goat} alt="Коза Марта" className="h-full w-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/80 via-dark-oak/15 to-transparent" />
                <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                    <span className="pulse-dot" />
                    Марта онлайн сейчас
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                    <Star className="h-3.5 w-3.5 fill-white" />
                    Элита
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/65">Ваше животное</p>
                  <h2 className="mt-2 text-3xl font-semibold">Коза Марта</h2>
                  <p className="mt-1 text-sm text-white/75">Англо-нубийская · 3 года · эмоциональный центр вашего опыта</p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><Heart className="h-4 w-4 text-rose-500" /> Счастье</span>
                      <span className="font-mono-data font-semibold text-foreground">87%</span>
                    </div>
                    <ProgressBar value={87} tone="bg-rose-400" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><Thermometer className="h-4 w-4 text-primary" /> Здоровье</span>
                      <span className="font-mono-data font-semibold text-foreground">94%</span>
                    </div>
                    <ProgressBar value={94} tone="bg-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary/80">
                    🥕 Покормить морковкой
                  </button>
                  <button className="rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-accent/25">
                    🛁 Заказать SPA-уход
                  </button>
                </div>

                <div className="grid gap-3">
                  <Link href="/animal/marta" className="group flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                    <div>
                      <div className="font-semibold text-foreground">Открыть полный профиль животного</div>
                      <div className="mt-1 text-xs text-muted-foreground">Фото, история и живой контакт с Мартой</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link href="/tracker" className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92">
                      К трекеру продуктов
                    </Link>
                    <Link href="/club" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                      В клубную ленту
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>

            <div className="col-span-12 grid grid-cols-12 gap-4 lg:col-span-7">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовый статус</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Следующая доставка уже собирается.</h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
                        Здесь видно, что именно собирается в семейную коробку и на каком этапе находится доставка.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Package className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-border/70">
                  <img src={CDN.delivery} alt="Следующая доставка" className="h-36 w-full object-cover" />
                  <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="text-sm font-semibold text-foreground">15 марта · суббота</div>
                      <div className="mt-1 text-sm text-muted-foreground">Коробка: молоко 2 л, сыр «Марта Петровых», натуральный йогурт 500 г</div>
                    </div>
                    <div className="rounded-full bg-accent/20 px-4 py-2 text-xs font-semibold text-amber-800">Сборка 45%</div>
                  </div>
                </div>

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

                <Link href="/tracker" className="group mt-5 flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                  <div>
                    <div className="font-semibold text-foreground">Открыть полный трекер продуктов</div>
                    <div className="mt-1 text-xs text-muted-foreground">Состав молока, надои и история доставок</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Live-слой</p>
                    <h3 className="mt-2 text-xl font-semibold text-foreground">Прямой эфир стойла</h3>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-border/70">
                  <div className="relative">
                    <img src={CDN.liveCam} alt="Прямой эфир" className="h-48 w-full object-cover" />
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur">Камера · Стойло №3</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-secondary/55 p-4 text-sm text-muted-foreground">
                  Live-камера возвращает ощущение присутствия между визитами, событиями и доставками.
                </div>

                <Link href="/animal/marta" className="group mt-4 flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                  <div>
                    <div className="font-semibold text-foreground">Перейти к профилю Марты</div>
                    <div className="mt-1 text-xs text-muted-foreground">Открыть галерею, историю и профиль животного</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Дневник</p>
                    <h3 className="mt-2 text-xl font-semibold text-foreground">Последние события из жизни Марты</h3>
                  </div>
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>

                <div className="mt-4 space-y-3">
                  {diaryEntries.map((entry) => (
                    <div key={entry.title} className="rounded-2xl bg-muted/45 p-4 transition-colors hover:bg-muted/65">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.text}</p>
                    </div>
                  ))}
                </div>

                <Link href="/animal/marta" className="group mt-4 flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
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
                <div className="flex items-center justify-between gap-3">
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
                      AI-slot для Sprint 2
                    </div>
                    <h3 className="mt-4 font-display text-3xl">Куратор владельца появится здесь.</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                      Этот блок подготавливает следующий слой ценности: персональные рекомендации по уходу, объяснение событий фермы,
                      голос животного и умные сценарии удержания.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/65">
                      <span className="rounded-full border border-white/15 px-3 py-1">voice of animal</span>
                      <span className="rounded-full border border-white/15 px-3 py-1">storyteller</span>
                      <span className="rounded-full border border-white/15 px-3 py-1">retention agent</span>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[1.5rem] bg-white/8 p-4 backdrop-blur md:min-w-[280px]">
                    {notifications.map((note) => (
                      <div key={note} className="rounded-2xl border border-white/10 bg-white/8 p-3 text-sm text-white/82">
                        {note}
                      </div>
                    ))}
                    <div className="rounded-2xl border border-dashed border-white/20 p-3 text-xs text-white/55">
                      Пространство для AI-объяснений, рекомендаций и next-best-action сценариев.
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
                  <img src={CDN.family} alt="Семья на ферме" className="h-full min-h-[220px] w-full object-cover" />
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Ритм участия</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Сайт должен удерживать пользователя между продуктом и жизнью фермы.</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      Каждая зона дашборда должна вести либо в эмоциональный слой, либо в продуктовый маршрут, либо в клубную среду.
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
