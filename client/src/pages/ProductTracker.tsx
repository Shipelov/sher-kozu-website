import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import {
  Milk, Package, Truck, CheckCircle, Clock, ChevronRight,
  TrendingUp, BarChart2, Calendar, Star, Filter, Leaf
} from "lucide-react";

const CDN = {
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/milk_products_d3f8c13d.jpg",
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
      setDisplay(Math.round(current * 10) / 10);
      if (current >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span className="font-mono-data">{display}{suffix}</span>;
}

const deliveries = [
  {
    id: "ДСТ-2026-031",
    date: "15 марта 2026",
    status: "pending",
    items: [
      { name: "Молоко козье свежее", qty: "2 л", price: "480 ₽" },
      { name: "Сыр «Марта Петровых»", qty: "300 г", price: "890 ₽" },
      { name: "Йогурт натуральный", qty: "500 г", price: "320 ₽" },
    ],
    total: "1 690 ₽",
    progress: 45,
  },
  {
    id: "ДСТ-2026-028",
    date: "8 марта 2026",
    status: "delivered",
    items: [
      { name: "Молоко козье свежее", qty: "2 л", price: "480 ₽" },
      { name: "Творог мягкий", qty: "400 г", price: "380 ₽" },
    ],
    total: "860 ₽",
    progress: 100,
  },
  {
    id: "ДСТ-2026-021",
    date: "1 марта 2026",
    status: "delivered",
    items: [
      { name: "Молоко козье свежее", qty: "3 л", price: "720 ₽" },
      { name: "Сыр «Марта Петровых»", qty: "200 г", price: "593 ₽" },
      { name: "Масло сливочное", qty: "200 г", price: "450 ₽" },
    ],
    total: "1 763 ₽",
    progress: 100,
  },
];

const milkComposition = [
  { label: "Жирность", value: 4.8, max: 6, unit: "%" },
  { label: "Белок", value: 3.2, max: 5, unit: "%" },
  { label: "Лактоза", value: 4.1, max: 6, unit: "%" },
  { label: "Кальций", value: 134, max: 200, unit: "мг/100мл" },
];

const monthlyData = [
  { month: "Сен", liters: 38 },
  { month: "Окт", liters: 42 },
  { month: "Ноя", liters: 44 },
  { month: "Дек", liters: 40 },
  { month: "Янв", liters: 36 },
  { month: "Фев", liters: 43 },
  { month: "Мар", liters: 47 },
];

const maxLiters = Math.max(...monthlyData.map(d => d.liters));

export default function ProductTracker() {
  const [activeDelivery, setActiveDelivery] = useState(0);
  const [barWidths, setBarWidths] = useState<number[]>(new Array(milkComposition.length).fill(0));

  useEffect(() => {
    const t = setTimeout(() => {
      setBarWidths(milkComposition.map(c => (c.value / c.max) * 100));
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="container">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-foreground mb-1">Трекер продуктов</h1>
            <p className="text-muted-foreground">Надои, состав молока и история доставок от вашей козы Марты</p>
          </motion.div>

          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Всего молока", value: 47.2, suffix: " л", icon: Milk, color: "text-primary", bg: "bg-primary/10" },
              { label: "Доставок", value: 12, suffix: "", icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Сыров произведено", value: 8, suffix: " шт", icon: Star, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Сэкономлено", value: 4200, suffix: " ₽", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-card rounded-2xl border border-border shadow-sm p-4 card-hover"
                >
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-12 gap-5">

            {/* Milk composition */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-12 md:col-span-5 bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <div className="relative h-44 overflow-hidden">
                <img src={CDN.milk} alt="Молочные продукты" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <p className="text-xs opacity-80">Анализ молока</p>
                  <p className="font-bold text-lg">Состав от 10 марта 2026</p>
                </div>
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Leaf className="w-3 h-3" />
                  Органик
                </div>
              </div>
              <div className="p-5 space-y-4">
                {milkComposition.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono-data font-semibold text-foreground">{item.value} {item.unit}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full progress-bar-fill"
                        style={{ width: `${barWidths[i]}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Молоко прошло лабораторный анализ. Сертификат качества №СК-2026-0310
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Monthly chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="col-span-12 md:col-span-7 bg-card rounded-2xl border border-border shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Надои по месяцам
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Сентябрь 2025 — Март 2026</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={47.2} suffix=" л" />
                  </p>
                  <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                    <TrendingUp className="w-3 h-3" />
                    +9% к прошлому месяцу
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-3 h-40">
                {monthlyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="font-mono-data text-xs text-muted-foreground">{d.liters}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.liters / maxLiters) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                      className={`w-full rounded-t-lg ${i === monthlyData.length - 1 ? "bg-primary" : "bg-primary/30"}`}
                    />
                    <span className="text-xs text-muted-foreground">{d.month}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Deliveries */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  История доставок
                </h3>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Filter className="w-4 h-4" />
                  Фильтр
                </button>
              </div>

              <div className="divide-y divide-border">
                {deliveries.map((delivery, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.08 }}
                    className="p-5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setActiveDelivery(activeDelivery === i ? -1 : i)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${delivery.status === "delivered" ? "bg-green-50" : "bg-amber-50"}`}>
                          {delivery.status === "delivered"
                            ? <CheckCircle className="w-5 h-5 text-green-600" />
                            : <Clock className="w-5 h-5 text-amber-600" />
                          }
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{delivery.id}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {delivery.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          delivery.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {delivery.status === "delivered" ? "Доставлено" : "В обработке"}
                        </span>
                        <span className="font-semibold text-foreground">{delivery.total}</span>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${activeDelivery === i ? "rotate-90" : ""}`} />
                      </div>
                    </div>

                    {delivery.status === "pending" && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Собирается на ферме</span>
                          <span>В пути</span>
                          <span>Доставлено</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${delivery.progress}%` }}
                            transition={{ delay: 0.6, duration: 1 }}
                            className="h-full bg-accent rounded-full"
                          />
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {activeDelivery === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 border-t border-border mt-3 space-y-2">
                            {delivery.items.map((item, j) => (
                              <div key={j} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{item.name} · {item.qty}</span>
                                <span className="font-medium text-foreground">{item.price}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Cheese tracker */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="col-span-12 md:col-span-5 bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <div className="relative h-48 overflow-hidden">
                <img src={CDN.cheese} alt="Именной сыр" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <p className="text-xs opacity-80">Именной продукт</p>
                  <p className="font-bold text-xl">Сыр «Марта Петровых»</p>
                </div>
                <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  Созрел!
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Выдержка", value: "21 день" },
                    { label: "Жирность", value: "45%" },
                    { label: "Вес", value: "300 г" },
                  ].map((stat, i) => (
                    <div key={i} className="text-center p-2 bg-muted/50 rounded-xl">
                      <p className="font-mono-data text-sm font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Сыр произведён из молока вашей козы Марты 20 февраля 2026. На этикетке — ваше имя.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Добавить в следующую доставку
                </motion.button>
              </div>
            </motion.div>

            {/* Subscribe box */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="col-span-12 md:col-span-7 bg-gradient-to-br from-primary/90 to-primary rounded-2xl p-6 text-white"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/70 text-sm mb-1">Ваша подписка</p>
                  <h3 className="text-2xl font-bold">«Персональный фермер»</h3>
                  <p className="text-white/80 text-sm mt-1">Тариф Премиум · Активен до 14.02.2027</p>
                </div>
                <div className="bg-white/20 rounded-xl px-3 py-1.5 text-sm font-semibold">
                  Активна
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: "Молоко в месяц", value: "до 50 л" },
                  { label: "Доставок", value: "4 в месяц" },
                  { label: "Именных сыров", value: "2 в месяц" },
                  { label: "Доступ к камере", value: "24/7" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-3">
                    <p className="font-semibold text-sm">{item.value}</p>
                    <p className="text-xs text-white/70">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  className="flex-1 bg-white text-primary font-semibold py-2.5 rounded-xl text-sm hover:bg-white/90 transition-colors"
                >
                  Управление подпиской
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  className="flex-1 bg-white/20 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-white/30 transition-colors"
                >
                  Подарить другу
                </motion.button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
