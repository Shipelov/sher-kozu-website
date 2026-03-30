import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft, Search } from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <>
      <Navbar />
      <div className="min-h-[80vh] w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
        <Card className="w-full max-w-lg shadow-lg border border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/10 rounded-full animate-pulse" />
                <AlertCircle className="relative h-16 w-16 text-destructive" />
              </div>
            </div>

            <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>

            <h2 className="text-xl font-semibold text-foreground/80 mb-4">
              Страница не найдена
            </h2>

            <p className="text-muted-foreground mb-8 leading-relaxed">
              К сожалению, запрашиваемая страница не существует.
              <br />
              Возможно, она была перемещена или удалена.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setLocation("/")}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                На главную
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/animals")}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                Каталог
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
