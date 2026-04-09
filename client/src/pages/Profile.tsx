import { useAuth } from "@/_core/hooks/useAuth";
import { formatDisplayName, getInitials } from "@shared/formatName";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import ProfileContactForm from "@/components/ProfileContactForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import {
  Heart,
  LogIn,
  Loader2,
  ShieldCheck,
  User,
} from "lucide-react";

export default function Profile() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pb-14 pt-24 md:pt-28">
          <div className="container max-w-2xl">
            <Card className="rounded-[2rem] border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка профиля…
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pb-14 pt-24 md:pt-28">
          <div className="container max-w-lg text-center">
            <Card className="rounded-[2rem] border-border/70 shadow-sm">
              <CardContent className="p-8 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Войдите, чтобы открыть профиль</h2>
                <p className="text-sm text-muted-foreground">
                  Для редактирования контактных данных необходимо авторизоваться.
                </p>
                <Button asChild className="rounded-full">
                  <a href={getLoginUrl("/profile")}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Войти
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = (user as any).role === "admin";
  const userInitials = getInitials(user.name);
  const displayName = formatDisplayName(user.name);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pb-14 pt-24 md:pt-28">
        <div className="container max-w-2xl space-y-5">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Профиль" },
            ]}
          />
          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="rounded-[2rem] border-border/70 bg-white/95 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-xs ${
                          isAdmin
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {isAdmin ? (
                          <>
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Администратор
                          </>
                        ) : (
                          <>
                            <Heart className="mr-1 h-3 w-3" />
                            Владелец
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact form */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <ProfileContactForm />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
