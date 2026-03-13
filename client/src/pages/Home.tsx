import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  ChevronRight, Leaf, Heart, Camera, Milk, Package, Users,
  Star, Award, ArrowDown, Play, Shield, Zap, Gift
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/milk_products_d3f8c13d.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/club_event_3bef2b1e.jpg",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/named_cheese_e69af325.jpg",
};

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const step = target / 50;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref} className="font-mono-data">{count}{suffix}</span>;
}

const features = [
  {
    icon: Heart,
    title: "Профиль животного",
    desc: "Имя, порода, родословная, уровень счастья и здоровья в реальном времени.",
    color: "bg-rose-50",
    iconColor: "text-rose-500",
  },
  {
    icon: Camera,
    title: "Прямой эфир 24/7",
    desc: "Доступ к веб-камере в стойле вашего животного эксклюзивно для владельца.",
    color: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    icon: Milk,
    title: "Продуктовый трекер",
    desc: "Информация о текущем надое, составе молока и статусе доставки.",
    color: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    icon: Package,
    title: "Управление уходом",
    desc: "Заказ особых кормов, груминга и прогулок через микротранзакции.",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Users,
    title: "Клубная лента",
    desc: "Новости сообщества, анонсы закрытых мероприятий и общение владельцев.",
    color: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    icon: Leaf,
    title: "Дневник животного",
    desc: "Регулярные обновления от имени животного с фото и видео-историями.",
    color: "bg-teal-50",
    iconColor: "text-teal-600",
  },
];

const wowFactors = [
  { emoji: "🎂", title: "День рождения козы", desc: "Ежегодное персональное мероприятие на ферме для семьи владельца. Торт и фотосессия." },
  { emoji: "🧀", title: "Именной сыр", desc: "Сыр из молока конкретного животного с именем владельца на этикетке. Статусный подарок." },
  { emoji: "🎓", title: "Детская академия", desc: "Уроки дойки, сыроварения и ухода. Формирует связь нового поколения с фермой." },
  { emoji: "🔐", title: "NFT-паспорт", desc: "Цифровой токен с историей животного. Подтверждает право собственности и ликвидность." },
  { emoji: "🎁", title: "Подарочный абонемент", desc: "Возможность подарить подписку «от моей козы» другу или партнёру." },
];

const plans = [
  {
    name: "Старт",
    price: "4 900",
    period: "мес",
    animal: "Коза или овца",
    features: ["Профиль животного", "Дневник 2× в неделю", "Молоко 20 л/мес", "2 доставки в месяц"],
    color: "border-border",
    badge: null,
  },
  {
    name: "Персональный фермер",
    price: "9 900",
    period: "мес",
    animal: "Коза или овца",
    features: ["Всё из «Старт»", "Прямой эфир 24/7", "Молоко 50 л/мес", "4 доставки в месяц", "1 именной сыр/мес", "Управление уходом"],
    color: "border-primary",
    badge: "Популярный",
  },
  {
    name: "Семейная ферма",
    price: "19 900",
    period: "мес",
    animal: "2 животных на выбор",
    features: ["Всё из «Персональный»", "2 животных", "Молоко 100 л/мес", "Еженедельные доставки", "2 именных сыра/мес", "Приоритет на мероприятия"],
    color: "border-border",
    badge: null,
  },
];

export default function Home() {
  const [videoPlaying, setVideoPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={CDN.hero} alt="Ферма Шерь Козу" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
        </div>

        <div className="relative container">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="pulse-dot" />
              <span className="text-white/80 text-sm font-medium">Первый в России клуб персонального фермерства</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6"
            >
              Ваша коза.
              <br />
              <span className="text-amber-400">Ваше молоко.</span>
              <br />
              Ваша история.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-white/80 text-lg leading-relaxed mb-8 max-w-lg"
            >
              Шерь Козу превращает фермерство в персональный lifestyle-сервис. Усыновите козу или овцу элитной породы и получайте свежие продукты прямо с фермы.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-3"
            >
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 bg-white text-primary font-bold px-7 py-3.5 rounded-full shadow-lg hover:bg-white/95 transition-colors"
                >
                  Выбрать животное
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setVideoPlaying(true)}
                className="flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white font-semibold px-7 py-3.5 rounded-full border border-white/30 hover:bg-white/25 transition-colors"
              >
                <Play className="w-4 h-4" />
                Смотреть видео
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center gap-6 mt-10"
            >
              {[
                { value: "47", label: "владельцев" },
                { value: "94", label: "животных" },
                { value: "4.9", label: "рейтинг" },
              ].map((stat, i) => (
                <div key={i} className="text-white">
                  <p className="text-2xl font-bold font-mono-data">{stat.value}</p>
                  <p className="text-xs text-white/60">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50"
        >
          <ArrowDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="bg-primary py-8">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white text-center">
            {[
              { value: 47, suffix: "+", label: "Счастливых владельцев" },
              { value: 94, suffix: "", label: "Животных на ферме" },
              { value: 650, suffix: " л", label: "Молока в год с козы" },
              { value: 100, suffix: "%", label: "Натуральный продукт" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl font-bold">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-white/70 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Цифровая экосистема</p>
            <h2 className="text-4xl font-bold text-foreground mb-4">Сердце продукта</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Приложение превращает фермерство в персональный lifestyle-сервис с живыми данными, прямым эфиром и управлением уходом.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="bg-card rounded-2xl border border-border shadow-sm p-6 cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Animal showcase */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-12 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="col-span-12 md:col-span-5"
            >
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Элитные породы</p>
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Познакомьтесь с<br />
                <span className="font-display italic text-primary">Козой Мартой</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Англо-нубийская коза — «королевская» порода. Жирность молока до 5%, исключительный сливочный вкус без специфического запаха. Марта — дочь чемпиона выставки «АгроФерм 2022».
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Жирность молока", value: "до 5%" },
                  { label: "Годовой надой", value: "~650 л" },
                  { label: "Возраст", value: "3 года" },
                  { label: "Порода", value: "Элита" },
                ].map((stat, i) => (
                  <div key={i} className="bg-card rounded-xl p-3 border border-border">
                    <p className="font-mono-data font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <Link href="/animal/marta">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  className="flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-primary/90 transition-colors"
                >
                  Посмотреть профиль
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="col-span-12 md:col-span-7 relative"
            >
              <div className="relative rounded-2xl overflow-hidden h-96">
                <img src={CDN.goat} alt="Коза Марта" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-foreground">Коза Марта</p>
                        <p className="text-xs text-muted-foreground">Англо-нубийская · Стойло №3</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="pulse-dot" />
                        <span className="text-xs text-muted-foreground">Онлайн</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500" /> Счастье</span>
                          <span className="font-mono-data font-semibold">87%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: "87%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Здоровье</span>
                          <span className="font-mono-data font-semibold">94%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: "94%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Wow factors */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Вау-факторы</p>
            <h2 className="text-4xl font-bold text-foreground mb-4">Создание вирусности и лояльности</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Пять уникальных фишек, которые превращают клиентов в евангелистов бренда.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {wowFactors.map((factor, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5 text-center cursor-pointer"
              >
                <span className="text-4xl block mb-3">{factor.emoji}</span>
                <h3 className="font-bold text-foreground text-sm mb-2">{factor.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{factor.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-4xl font-bold text-foreground mb-3">Жизнь на ферме</h2>
            <p className="text-muted-foreground">Реальные моменты из жизни наших животных и владельцев</p>
          </motion.div>

          <div className="grid grid-cols-12 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="col-span-12 md:col-span-8 rounded-2xl overflow-hidden h-72"
            >
              <img src={CDN.family} alt="Семья на ферме" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="col-span-12 md:col-span-4 rounded-2xl overflow-hidden h-72"
            >
              <img src={CDN.milk} alt="Молочные продукты" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="col-span-12 md:col-span-4 rounded-2xl overflow-hidden h-56"
            >
              <img src={CDN.cheese} alt="Именной сыр" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="col-span-12 md:col-span-8 rounded-2xl overflow-hidden h-56"
            >
              <img src={CDN.club} alt="Клубное мероприятие" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Тарифы</p>
            <h2 className="text-4xl font-bold text-foreground mb-4">Выберите свой уровень</h2>
            <p className="text-muted-foreground">Начните с любого тарифа и повышайте по мере роста вашей фермерской жизни</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`relative bg-card rounded-2xl border-2 ${plan.color} shadow-sm p-6 ${i === 1 ? "shadow-lg" : ""}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mb-1">{plan.animal}</p>
                <h3 className="font-bold text-foreground text-lg mb-3">{plan.name}</h3>
                <div className="mb-5">
                  <span className="text-4xl font-bold font-mono-data text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">₽/{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    i === 1
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  Выбрать тариф
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "Гарантия качества", desc: "Лабораторный анализ каждой партии молока" },
              { icon: Zap, title: "Прямая доставка", desc: "От фермы до вашего стола без посредников" },
              { icon: Award, title: "Элитные породы", desc: "Англо-нубийские козы и Лакон овцы" },
              { icon: Gift, title: "Персональный подход", desc: "Каждое животное — уникальная история" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <img src={CDN.club} alt="Ужин на ферме" className="w-full h-72 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
            <div className="absolute inset-0 flex items-center p-10">
              <div className="text-white max-w-lg">
                <h2 className="text-4xl font-bold mb-3">Станьте частью клуба</h2>
                <p className="text-white/80 mb-6">Присоединяйтесь к 47 семьям, которые уже живут в гармонии с природой и получают самые свежие продукты прямо с фермы.</p>
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 bg-white text-primary font-bold px-8 py-4 rounded-full shadow-lg hover:bg-white/95 transition-colors"
                  >
                    Начать сейчас
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">Шерь Козу</span>
            </div>
            <p className="text-white/50 text-sm">© 2026 Шерь Козу. Первый в России клуб персонального фермерства.</p>
            <div className="flex items-center gap-4 text-sm text-white/50">
              <a href="#" className="hover:text-white transition-colors">О ферме</a>
              <a href="#" className="hover:text-white transition-colors">Контакты</a>
              <a href="#" className="hover:text-white transition-colors">Политика</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
