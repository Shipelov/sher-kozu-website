import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import {
  Users, Heart, MessageCircle, Share2, Calendar, MapPin,
  Star, Bell, ChevronRight, Bookmark, Award, Sparkles
} from "lucide-react";

const CDN = {
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/club_event_3bef2b1e.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/named_cheese_e69af325.jpg",
};

const posts = [
  {
    id: 1,
    author: "Ферма Шерь Козу",
    avatar: "🌿",
    role: "Официальный аккаунт",
    time: "2 часа назад",
    text: "Дорогие владельцы! Весна пришла на ферму — наши козы и овцы впервые вышли на луг после зимы. Смотрите, как радуется Марта! 🐐",
    image: CDN.family,
    likes: 47,
    comments: 12,
    isLiked: false,
    isPinned: true,
    tags: ["новости", "весна", "ферма"],
  },
  {
    id: 2,
    author: "Александр П.",
    avatar: "АП",
    role: "Владелец · Марта",
    time: "вчера",
    text: "Получил первую партию именного сыра «Марта Петровых». Упаковка просто шикарная, вкус — невероятный! Рекомендую попробовать с мёдом и грецкими орехами 🧀",
    image: CDN.cheese,
    likes: 31,
    comments: 8,
    isLiked: true,
    isPinned: false,
    tags: ["сыр", "отзыв"],
  },
  {
    id: 3,
    author: "Ферма Шерь Козу",
    avatar: "🌿",
    role: "Официальный аккаунт",
    time: "3 дня назад",
    text: "Анонс! 22 марта проводим закрытый ужин на ферме для владельцев. Длинный стол в поле, свечи, наши продукты и живая музыка. Места ограничены — только 20 семей.",
    image: CDN.club,
    likes: 89,
    comments: 34,
    isLiked: false,
    isPinned: false,
    tags: ["мероприятие", "ужин", "анонс"],
  },
];

const events = [
  {
    date: "22 марта",
    title: "Закрытый ужин на ферме",
    desc: "Длинный стол в поле, свечи, живая музыка",
    spots: "4 места",
    color: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-600",
  },
  {
    date: "5 апреля",
    title: "Мастер-класс по сыроварению",
    desc: "Научитесь делать сыр из молока вашей козы",
    spots: "8 мест",
    color: "bg-green-50 border-green-200",
    iconColor: "text-green-600",
  },
  {
    date: "14 апреля",
    title: "День рождения Марты",
    desc: "Персональное мероприятие для семьи Петровых",
    spots: "Только для вас",
    color: "bg-rose-50 border-rose-200",
    iconColor: "text-rose-600",
  },
  {
    date: "1 мая",
    title: "Детская академия фермерства",
    desc: "Уроки дойки, ухода и сыроварения для детей",
    spots: "12 мест",
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
  },
];

const members = [
  { name: "Семья Петровых", animal: "Коза Марта", avatar: "АП", since: "фев 2025" },
  { name: "Семья Ивановых", animal: "Овца Белла", avatar: "ЕИ", since: "янв 2025" },
  { name: "Семья Смирновых", animal: "Коза Роза", avatar: "МС", since: "мар 2025" },
  { name: "Семья Козловых", animal: "Коза Нора", avatar: "АК", since: "апр 2025" },
];

function PostCard({ post }: { post: typeof posts[0] }) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      {post.isPinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/5 border-b border-primary/10">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Закреплённое сообщение</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              {post.avatar}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{post.author}</p>
              <p className="text-xs text-muted-foreground">{post.role} · {post.time}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSaved(!saved)}
            className={`p-1.5 rounded-lg transition-colors ${saved ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Bookmark className="w-4 h-4" />
          </motion.button>
        </div>
        <p className="text-sm text-foreground leading-relaxed mb-3">{post.text}</p>
        {post.image && (
          <div className="rounded-xl overflow-hidden mb-3 h-52">
            <img src={post.image} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="flex gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLiked(!liked);
              setLikeCount(liked ? likeCount - 1 : likeCount + 1);
            }}
            className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-rose-500" : ""}`} />
            {likeCount}
          </motion.button>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <MessageCircle className="w-4 h-4" />
            {post.comments}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
            <Share2 className="w-4 h-4" />
            Поделиться
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ClubFeed() {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="container">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden mb-8 h-48"
          >
            <img src={CDN.club} alt="Клуб" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20" />
            <div className="absolute inset-0 flex items-center p-8">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Закрытый клуб</span>
                </div>
                <h1 className="text-3xl font-bold mb-1">Клуб Шерь Козу</h1>
                <p className="text-white/80 text-sm">Сообщество владельцев персональных животных</p>
              </div>
              <div className="ml-auto flex items-center gap-4 text-white">
                <div className="text-center">
                  <p className="text-2xl font-bold font-mono-data">47</p>
                  <p className="text-xs text-white/70">владельцев</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold font-mono-data">4</p>
                  <p className="text-xs text-white/70">события в апреле</p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-12 gap-5">

            {/* Feed */}
            <div className="col-span-12 md:col-span-7 space-y-4">
              {/* Filter */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["all", "news", "events", "members"].map((filter) => {
                  const labels: Record<string, string> = { all: "Все", news: "Новости", events: "События", members: "Участники" };
                  return (
                    <motion.button
                      key={filter}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        activeFilter === filter
                          ? "bg-primary text-white"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {labels[filter]}
                    </motion.button>
                  );
                })}
              </div>

              {posts.map((post, i) => (
                <motion.div key={post.id} transition={{ delay: i * 0.08 }}>
                  <PostCard post={post} />
                </motion.div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="col-span-12 md:col-span-5 space-y-4">

              {/* Events */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-primary" />
                  Ближайшие события
                </h3>
                <div className="space-y-3">
                  {events.map((event, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.01, x: 2 }}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${event.color}`}
                    >
                      <div className={`p-2 rounded-lg bg-white/60 ${event.iconColor}`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{event.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.desc}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs font-medium text-foreground">{event.spots}</span>
                          <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                            Записаться <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Members */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-primary" />
                  Участники клуба
                </h3>
                <div className="space-y-3">
                  {members.map((member, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                        {member.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.animal}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">с {member.since}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-3 text-sm text-primary font-medium flex items-center justify-center gap-1 py-2 hover:underline">
                  Все 47 участников <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Notification settings */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-5"
              >
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-primary" />
                  Уведомления клуба
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Новые посты", enabled: true },
                    { label: "Анонсы событий", enabled: true },
                    { label: "Упоминания", enabled: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <div className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${item.enabled ? "bg-primary" : "bg-muted"} relative`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
