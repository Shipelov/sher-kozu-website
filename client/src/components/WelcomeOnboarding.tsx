import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import {
  Heart,
  PawPrint,
  Package,
  ArrowRight,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: PawPrint,
    title: "Выберите животное",
    description:
      "Откройте каталог и познакомьтесь с козами и овцами фермы. У каждого животного — своя история, характер и продуктовый профиль.",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: Heart,
    title: "Приобретите долю",
    description:
      "Выберите долю владения — от 10% до 100%. Это определит ваш молочный бюджет и набор продуктов, которые вы будете получать.",
    color: "bg-amber-100 text-amber-700",
  },
  {
    icon: Package,
    title: "Получайте продукты",
    description:
      "После подтверждения фермой вы настроите продуктовый план и будете получать именную продукцию — молоко, сыры, йогурты.",
    color: "bg-sky-100 text-sky-700",
  },
];

interface WelcomeOnboardingProps {
  userName: string;
  onComplete: () => void;
}

export default function WelcomeOnboarding({ userName, onComplete }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const completeOnboarding = trpc.auth.completeOnboarding.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding.mutate();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mx-4 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-emerald-50 to-amber-50 px-8 pt-8 pb-6">
          <div className="flex items-center gap-2 text-sm text-primary font-medium mb-2">
            <Sparkles className="h-4 w-4" />
            Добро пожаловать в Шерь Козу
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Привет, {userName.split(" ")[0]}!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Вот как работает персональное фермерство
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-8 pt-5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${steps[currentStep].color}`}
                >
                  {(() => {
                    const Icon = steps[currentStep].icon;
                    return <Icon className="h-6 w-6" />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {String(currentStep + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg font-semibold text-foreground">
                      {steps[currentStep].title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {steps[currentStep].description}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border px-8 py-5">
          <button
            type="button"
            onClick={handleSkip}
            disabled={completeOnboarding.isPending}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Пропустить
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                Назад
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              disabled={completeOnboarding.isPending}
              className="gap-1.5"
            >
              {completeOnboarding.isPending ? (
                "Загрузка..."
              ) : isLastStep ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Начать
                </>
              ) : (
                <>
                  Далее
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick link on last step */}
        {isLastStep && (
          <div className="border-t border-border bg-muted/30 px-8 py-4">
            <Link href="/animals">
              <button
                type="button"
                onClick={() => completeOnboarding.mutate()}
                className="flex w-full items-center justify-between rounded-xl bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-primary">
                  <PawPrint className="h-4 w-4" />
                  Перейти к каталогу животных
                </span>
                <ArrowRight className="h-4 w-4 text-primary" />
              </button>
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
