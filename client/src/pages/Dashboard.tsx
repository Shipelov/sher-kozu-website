import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Heart, Thermometer, Milk, Package, Camera, BookOpen,
  ChevronRight, Star, Gift, Zap, TrendingUp, Bell, Calendar,
  ShoppingBag, Users, Leaf
} from "lucide-react";

const CDN = {
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  delivery: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/delivery_box_6b16c712.jpg",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/named_cheese_e69af325.jpg",
};

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const step = value / 40;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, value);
      setDisplay(Math.round(current));
      if (current >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span className="font-mono-data">{display}{suffix}</span>;
}

function ProgressBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full progress-bar-fill`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

const diaryEntries = [
  { date: "13 марта", text: "Сегодня меня угостили морковкой! Так вкусно 🥕 Надой сегодня 1.8 л.", mood: "😊" },
  { date: "12 марта", text: "Провела SPA-процедуры. Шерсть блестит, настроение отличное!", mood: "✨" },
  { date: "11 марта", text: "Гуляла на свежем воздухе 3 часа. Весна чувствуется!", mood: "🌿" },
];

const notifications = [
  { icon: Milk, text: "Надой за сегодня: 1.8 л", time: "2 ч назад", color: "text-primary" },
  { icon: Package, text: "Доставка запланирована на 15 марта", time: "5 ч назад", color: "text-accent" },
  { icon: Gift, text: "День рождения Марты через 12 дней!", time: "вчера", color: "text-amber-500" },
  { icon: Star, text: "Ваш сыр «Марта Премиум» созрел", time: "2 дня назад", color: "text-purple-500" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <p className="text-sm text-muted-foreground mb-1">Добро пожаловать,</p>
              <h1 className="text-3xl font-bold text-foreground">Александр Петров</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Владелец с <span className="font-mono-data text-primary font-semibold">14 февраля 2025</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="relative p-2.5 rounded-xl bg-card border border-border shadow-sm"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
              </motion.button>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                АП
              </div>
            </div>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-12 gap-4">

            {/* Animal Card — large */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="col-span-12 md:col-span-4 bg-card rounded-2xl border border-border shadow-sm overflow-hidden card-hover"
            >
              <div className="relative h-52 overflow-hidden">
                <img src={CDN.goat} alt="Коза Марта" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pulse-dot" />
                    <span className="text-xs font-medium">Онлайн сейчас</span>
                  </div>
                  <h2 className="text-xl font-bold">Коза Марта</h2>
                  <p className="text-sm text-white/80">Англо-нубийская · 3 года</p>
                </div>
                <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Элита
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Heart className="w-3.5 h-3.5 text-rose-500" /> Счастье</span>
                    <span className="font-mono-data font-semibold text-foreground">87%</span>
                  </div>
                  <ProgressBar value={87} color="bg-rose-400" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Thermometer className="w-3.5 h-3.5 text-primary" /> Здоровье</span>
                    <span className="font-mono-data font-semibold text-foreground">94%</span>
                  </div>
                  <ProgressBar value={94} color="bg-primary" />
                </div>
                <div className="flex gap-2 pt-1">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex-1 text-xs font-semibold bg-primary/10 text-primary rounded-xl py-2.5 hover:bg-primary/20 transition-colors"
                  >
                    🥕 Покормить
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex-1 text-xs font-semibold bg-accent/10 text-amber-700 rounded-xl py-2.5 hover:bg-accent/20 transition-colors"
                  >
                    🛁 SPA-уход
                  </motion.button>
                </div>
                <Link href="/animal/marta">
                  <button className="w-full text-xs text-primary font-medium flex items-center justify-center gap-1 py-1 hover:underline">
                    Полный профиль <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
            </motion.div>

            {/* Stats column */}
            <div className="col-span-12 md:col-span-8 grid grid-cols-2 gap-4">
              {/* Milk stats */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-2 sm:col-span-1 bg-card rounded-2xl border border-border shadow-sm p-5 card-hover"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Надой сегодня</p>
                    <p className="text-4xl font-bold text-foreground">
                      <AnimatedNumber value={1.8} />
                      <span className="text-lg text-muted-foreground ml-1">л</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Milk className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+12% к прошлой неделе</span>
                </div>
                <div className="mt-3 h-12 flex items-end gap-1">
                  {[1.4, 1.6, 1.5, 1.7, 1.8, 1.6, 1.8].map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${(v / 2) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                      className={`flex-1 rounded-sm ${i === 6 ? "bg-primary" : "bg-primary/25"}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span className="text-primary font-semibold">Вс</span>
                </div>
              </motion.div>

              {/* Delivery tracker */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="col-span-2 sm:col-span-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden card-hover"
              >
                <div className="relative h-28 overflow-hidden">
                  <img src={CDN.delivery} alt="Доставка" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-3 text-white">
                    <p className="text-xs opacity-80">Следующая доставка</p>
                    <p className="font-bold">15 марта, суббота</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Собирается</span><span>В пути</span><span>Доставлено</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "45%" }}
                          transition={{ delay: 0.5, duration: 1 }}
                          className="h-full bg-accent rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Состав:</span> Молоко 2л · Сыр «Марта» 300г · Йогурт 500г
                  </div>
                </div>
              </motion.div>

              {/* Live cam */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="col-span-2 sm:col-span-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden card-hover"
              >
                <div className="relative h-36 overflow-hidden group">
                  <img src={CDN.liveCam} alt="Прямой эфир" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                    <Camera className="w-3 h-3 inline mr-1" />
                    Стойло №3
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
                    </div>
                  </motion.button>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold">Прямой эфир 24/7</p>
                  <p className="text-xs text-muted-foreground">Эксклюзивно для владельца</p>
                </div>
              </motion.div>

              {/* Named cheese */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="col-span-2 sm:col-span-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden card-hover"
              >
                <div className="relative h-36 overflow-hidden">
                  <img src={CDN.cheese} alt="Именной сыр" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 text-white">
                    <p className="text-xs opacity-80">Именной продукт</p>
                    <p className="font-bold text-sm">Сыр «Марта Петровых»</p>
                  </div>
                  <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Созрел!
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">Выдержка 21 день · Жирность 45%</p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    className="mt-2 w-full text-xs font-semibold bg-accent/15 text-amber-700 rounded-lg py-2 hover:bg-accent/25 transition-colors"
                  >
                    Добавить в доставку
                  </motion.button>
                </div>
              </motion.div>
            </div>

            {/* Diary */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 md:col-span-5 bg-card rounded-2xl border border-border shadow-sm p-5 card-hover"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Дневник Марты
                </h3>
                <Link href="/animal/marta">
                  <span className="text-xs text-primary hover:underline cursor-pointer">Все записи</span>
                </Link>
              </div>
              <div className="space-y-3">
                {diaryEntries.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className="flex gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-2xl">{entry.mood}</span>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{entry.date}</p>
                      <p className="text-sm text-foreground leading-relaxed">{entry.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="col-span-12 md:col-span-4 bg-card rounded-2xl border border-border shadow-sm p-5 card-hover"
            >
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-primary" />
                Уведомления
              </h3>
              <div className="space-y-3">
                {notifications.map((n, i) => {
                  const Icon = n.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.07 }}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className={`p-2 rounded-lg bg-muted ${n.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{n.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="col-span-12 md:col-span-3 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-sm p-5 text-white"
            >
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Быстрые действия
              </h3>
              <div className="space-y-2.5">
                {[
                  { icon: ShoppingBag, label: "Заказать корм", sub: "Морковь, сено, зерно" },
                  { icon: Calendar, label: "Запись на визит", sub: "Приехать на ферму" },
                  { icon: Gift, label: "Подарить подписку", sub: "Другу или партнёру" },
                  { icon: Users, label: "Клубная лента", sub: "Новости сообщества" },
                ].map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-left"
                    >
                      <div className="p-1.5 rounded-lg bg-white/20">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{action.label}</p>
                        <p className="text-xs text-white/70">{action.sub}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-white/50" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
