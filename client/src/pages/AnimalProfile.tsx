import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Heart, Thermometer, Milk, Camera, BookOpen, Star, Award,
  ChevronLeft, Play, Calendar, Dna, MapPin, Zap, ChevronDown
} from "lucide-react";

const CDN = {
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
};

function ProgressRing({ value, size = 80, strokeWidth = 6, color = "#1A3A2A" }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const [animValue, setAnimValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animValue / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimValue(value), 400);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

const diaryEntries = [
  { date: "13 марта 2026", mood: "😊", title: "Угостили морковкой!", text: "Сегодня хозяин приехал и принёс целую корзину морковки. Я так рада! Надой сегодня 1.8 л — рекорд недели.", tags: ["корм", "рекорд"] },
  { date: "12 марта 2026", mood: "✨", title: "SPA-день", text: "Провела SPA-процедуры: расчёсывание, ванна с травами, обрезка копыт. Шерсть блестит, настроение отличное!", tags: ["уход", "SPA"] },
  { date: "11 марта 2026", mood: "🌿", title: "Прогулка на лугу", text: "Гуляла на свежем воздухе 3 часа. Весна чувствуется — трава уже пробивается. Нашла особенно вкусный клевер.", tags: ["прогулка", "весна"] },
  { date: "8 марта 2026", mood: "🎉", title: "Праздник!", text: "Хозяева приехали всей семьёй с детьми. Дети кормили меня с руки — так весело! Сделали много фотографий.", tags: ["семья", "праздник"] },
];

const healthHistory = [
  { date: "10 марта", event: "Плановый осмотр ветеринара", status: "ok", note: "Всё в норме, вес 52 кг" },
  { date: "1 марта", event: "Вакцинация (ящур)", status: "ok", note: "Плановая вакцинация" },
  { date: "15 февраля", event: "Анализ молока", status: "ok", note: "Жирность 4.8%, белок 3.2%" },
  { date: "1 февраля", event: "Обрезка копыт", status: "ok", note: "Плановая процедура" },
];

export default function AnimalProfile() {
  const [activeTab, setActiveTab] = useState<"diary" | "health" | "milk">("diary");
  const [showFullBio, setShowFullBio] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        {/* Hero */}
        <div className="relative h-72 md:h-96 overflow-hidden">
          <img src={CDN.family} alt="Ферма" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
          <div className="absolute top-4 left-4">
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-3 py-2 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </motion.button>
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="container">
              <div className="flex items-end gap-4">
                <div className="relative">
                  <img
                    src={CDN.goat}
                    alt="Марта"
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-xl"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </div>
                <div className="text-white pb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pulse-dot" />
                    <span className="text-xs">Онлайн · Стойло №3</span>
                  </div>
                  <h1 className="text-3xl font-bold">Коза Марта</h1>
                  <p className="text-white/80">Англо-нубийская · 3 года · #МК-2023-047</p>
                </div>
                <div className="ml-auto flex items-center gap-2 pb-1">
                  <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    Элита
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mt-6">
          <div className="grid grid-cols-12 gap-5">

            {/* Left column */}
            <div className="col-span-12 md:col-span-4 space-y-4">

              {/* Vital stats */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground mb-4">Показатели здоровья</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Счастье", value: 87, color: "#e11d48", icon: Heart },
                    { label: "Здоровье", value: 94, color: "#1A3A2A", icon: Thermometer },
                    { label: "Активность", value: 78, color: "#F0A500", icon: Zap },
                    { label: "Питание", value: 91, color: "#5A7A4A", icon: Milk },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <div className="relative">
                          <ProgressRing value={stat.value} size={72} strokeWidth={5} color={stat.color} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Icon className="w-4 h-4" style={{ color: stat.color }} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                        <p className="font-mono-data text-sm font-semibold">{stat.value}%</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Passport */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-primary" />
                  Паспорт животного
                </h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Порода", value: "Англо-нубийская" },
                    { label: "Дата рождения", value: "14 апреля 2023" },
                    { label: "Вес", value: "52 кг" },
                    { label: "Жирность молока", value: "4.8%" },
                    { label: "Белок молока", value: "3.2%" },
                    { label: "Годовой надой", value: "~650 л" },
                    { label: "Стойло", value: "№3, Ферма Шерь Козу" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {showFullBio
                      ? "Англо-нубийская коза — одна из самых продуктивных молочных пород мира. Отличается высокой жирностью молока (до 5%), отсутствием специфического запаха и дружелюбным характером. Марта — дочь чемпиона выставки «АгроФерм 2022», обладатель золотой медали по надою."
                      : "Англо-нубийская коза — одна из самых продуктивных молочных пород мира..."}
                  </p>
                  <button
                    onClick={() => setShowFullBio(!showFullBio)}
                    className="text-xs text-primary mt-1 flex items-center gap-1 hover:underline"
                  >
                    {showFullBio ? "Свернуть" : "Читать полностью"}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showFullBio ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </motion.div>

              {/* Live cam */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <div className="relative h-40 group cursor-pointer">
                  <img src={CDN.liveCam} alt="Прямой эфир" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Веб-камера 24/7</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Стойло №3, Ферма Шерь Козу
                    </p>
                  </div>
                  <Camera className="w-5 h-5 text-muted-foreground" />
                </div>
              </motion.div>
            </div>

            {/* Right column */}
            <div className="col-span-12 md:col-span-8 space-y-4">

              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-4 gap-3"
              >
                {[
                  { emoji: "🥕", label: "Покормить", sub: "морковкой", color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
                  { emoji: "🛁", label: "SPA-уход", sub: "груминг", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
                  { emoji: "🚶", label: "Прогулка", sub: "1 час", color: "bg-green-50 border-green-200 hover:bg-green-100" },
                  { emoji: "🎂", label: "День рождения", sub: "через 32 дня", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex flex-col items-center p-3 rounded-xl border text-center transition-colors ${action.color}`}
                  >
                    <span className="text-2xl mb-1">{action.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.sub}</span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <div className="flex border-b border-border">
                  {(["diary", "health", "milk"] as const).map((tab) => {
                    const labels = { diary: "Дневник", health: "Здоровье", milk: "Надои" };
                    const icons = { diary: BookOpen, health: Award, milk: Milk };
                    const Icon = icons[tab];
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? "text-primary border-b-2 border-primary bg-primary/5"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5"
                  >
                    {activeTab === "diary" && (
                      <div className="space-y-4">
                        {diaryEntries.map((entry, i) => (
                          <div key={i} className="flex gap-4 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                            <div className="text-3xl">{entry.mood}</div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-foreground">{entry.title}</h4>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {entry.date}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{entry.text}</p>
                              <div className="flex gap-1.5 mt-2">
                                {entry.tags.map((tag) => (
                                  <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === "health" && (
                      <div className="space-y-3">
                        {healthHistory.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">{item.event}</p>
                                <span className="text-xs text-muted-foreground">{item.date}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
                          <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            Следующий плановый осмотр: 10 апреля 2026
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === "milk" && (
                      <div>
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          {[
                            { label: "Сегодня", value: "1.8 л", trend: "+12%" },
                            { label: "Эта неделя", value: "11.4 л", trend: "+8%" },
                            { label: "Этот месяц", value: "47.2 л", trend: "+5%" },
                          ].map((stat, i) => (
                            <div key={i} className="bg-muted/50 rounded-xl p-3 text-center">
                              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                              <p className="font-mono-data text-xl font-bold text-foreground">{stat.value}</p>
                              <p className="text-xs text-green-600 font-medium">{stat.trend}</p>
                            </div>
                          ))}
                        </div>
                        <div className="h-32 flex items-end gap-1.5">
                          {[1.4, 1.6, 1.5, 1.7, 1.8, 1.6, 1.8, 1.7, 1.9, 1.8, 1.6, 1.8, 1.7, 1.8].map((v, i) => (
                            <motion.div
                              key={i}
                              initial={{ height: 0 }}
                              animate={{ height: `${(v / 2.2) * 100}%` }}
                              transition={{ delay: i * 0.04, duration: 0.5 }}
                              className={`flex-1 rounded-t-sm ${i === 13 ? "bg-primary" : "bg-primary/30"}`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-2">Надой за последние 14 дней (л)</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* NFT Passport */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/60 mb-1">NFT-паспорт животного</p>
                    <h3 className="text-lg font-bold">Марта #МК-2023-047</h3>
                    <p className="text-sm text-white/70 mt-1">Цифровой токен с историей животного. Подтверждает право собственности и ликвидность.</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="font-mono-data text-xs bg-white/10 px-2 py-1 rounded">0x7f3a...c9b2</span>
                      <span className="text-xs text-white/60">Выдан: 14.02.2025</span>
                    </div>
                  </div>
                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/20 flex-shrink-0">
                    <img src={CDN.goat} alt="NFT" className="w-full h-full object-cover" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
