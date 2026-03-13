import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Leaf, Home, LayoutDashboard, Milk, Users, ChevronRight } from "lucide-react";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/dashboard", label: "Мой кабинет", icon: LayoutDashboard },
  { href: "/animal/marta", label: "Моя коза", icon: Leaf },
  { href: "/tracker", label: "Трекер продуктов", icon: Milk },
  { href: "/club", label: "Клуб", icon: Users },
];

export default function Navbar() {
  const [location] = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            Шерь <span className="text-primary">Козу</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="pulse-dot" />
            <span className="font-mono-data text-xs">Марта онлайн</span>
          </div>
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-full shadow hover:bg-primary/90 transition-colors"
            >
              Личный кабинет
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </div>
    </header>
  );
}
