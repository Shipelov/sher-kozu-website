/**
 * ZoyaFloatingChat — Floating AI Nutritionist chat widget.
 *
 * Positioned bottom-left to complement Masha's bottom-right position.
 * Hidden on /nutritionist page (which has its own embedded chat).
 */

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { X, ChevronDown, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import ZoyaChat from "./ZoyaChat";
import AuthModal from "./AuthModal";

const ZOYA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_128_9c34a1ee.webp";

export default function ZoyaFloatingChat() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("register");

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleAuthRequired = useCallback(() => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  }, []);

  // Hide on /nutritionist page (has its own embedded chat)
  if (location === "/nutritionist") return null;

  return (
    <>
      {/* Floating Button — bottom-left */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-6 z-50 group cursor-pointer"
            aria-label="Открыть чат с Зоей"
          >
            <div className="relative">
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
              {/* Avatar */}
              <div className="relative h-14 w-14 rounded-full ring-2 ring-emerald-400/40 shadow-lg overflow-hidden transition-transform group-hover:scale-110">
                <img
                  src={ZOYA_AVATAR}
                  alt="Зоя"
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background" />
              {/* Leaf badge */}
              <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center shadow-md">
                <Leaf className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-lg bg-card border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Спросите Зою — нутрициолога
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed z-50 flex flex-col bg-card shadow-2xl overflow-hidden",
              // Mobile: full-screen
              "inset-0 rounded-none",
              // Desktop: bottom-left panel
              "sm:inset-auto sm:bottom-6 sm:left-6 sm:w-[400px] sm:h-[560px] sm:rounded-2xl sm:border sm:border-border/60"
            )}
          >
            {/* Close button overlay */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Закрыть чат"
            >
              <X className="h-4 w-4 hidden sm:block" />
              <ChevronDown className="h-5 w-5 sm:hidden" />
            </button>

            <ZoyaChat
              mode="compact"
              onAuthRequired={handleAuthRequired}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultView={authModalView}
      />
    </>
  );
}
