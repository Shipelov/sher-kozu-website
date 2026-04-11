/**
 * Telegram Mini App — SKC Balance screen
 * Shows token balance and recent transactions.
 * API returns: { balanceSKC, walletId } for balance
 * Transactions: { direction: "credit"|"debit", amountMinor, memo, createdAt, transactionType }
 */

import { useState } from "react";
import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Gift,
  ShoppingCart,
  Star,
  Settings,
  RotateCcw,
  Timer,
} from "lucide-react";

const TX_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  topup: { label: "Пополнение", icon: ArrowDownLeft },
  spend: { label: "Покупка", icon: ShoppingCart },
  reward: { label: "Награда", icon: Star },
  admin_grant: { label: "Начисление", icon: Gift },
  admin_adjustment: { label: "Корректировка", icon: Settings },
  refund: { label: "Возврат", icon: RotateCcw },
  expiry: { label: "Истечение", icon: Timer },
};

export default function TgAppBalance() {
  const [showAll, setShowAll] = useState(false);

  const { data: balanceData, isLoading: balLoading } =
    trpc.gamification.wallet.balance.useQuery(undefined, { retry: 1 });

  const { data: txData, isLoading: txLoading } =
    trpc.gamification.wallet.transactions.useQuery(undefined, { retry: 1 });

  const isLoading = balLoading || txLoading;

  if (isLoading) {
    return (
      <TelegramMiniAppLayout title="Баланс SKC">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1a3a2a]" />
        </div>
      </TelegramMiniAppLayout>
    );
  }

  // Correct field: balanceSKC (not balance)
  const balance = (balanceData as any)?.balanceSKC ?? 0;
  const transactions = Array.isArray(txData) ? txData : [];
  const visibleTx = showAll ? transactions : transactions.slice(0, 10);

  return (
    <TelegramMiniAppLayout title="Баланс SKC">
      {/* Balance card */}
      <div className="bg-[#1a3a2a] px-5 pt-6 pb-8">
        <p className="text-xs text-white/50 uppercase tracking-wider">
          Ваш баланс
        </p>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-4xl font-bold text-white">
            {typeof balance === "number" ? balance.toLocaleString("ru-RU") : balance}
          </span>
          <span className="text-lg text-amber-400 font-semibold">SKC</span>
        </div>
        <p className="text-xs text-white/40 mt-2">
          Токены начисляются за покупки, визиты и активность в клубе
        </p>
      </div>

      {/* Transactions */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-[#1a3a2a]/80">
              История операций
            </h3>
          </div>

          {transactions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Coins className="h-10 w-10 text-[#1a3a2a]/15 mx-auto mb-2" />
              <p className="text-xs text-[#1a3a2a]/40">
                Операций пока нет
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a3a2a]/5">
              {visibleTx.map((tx: any, i: number) => {
                // Correct fields: direction (credit/debit), amountMinor, memo, transactionType
                const isCredit = tx.direction === "credit";
                const txTypeInfo = TX_TYPE_LABELS[tx.transactionType] || TX_TYPE_LABELS.topup;
                const TxIcon = txTypeInfo.icon;

                return (
                  <div
                    key={tx.id || i}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isCredit ? "bg-emerald-100" : "bg-rose-100"
                      }`}
                    >
                      <TxIcon className={`h-4 w-4 ${isCredit ? "text-emerald-500" : "text-rose-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1a3a2a] truncate">
                        {tx.memo || txTypeInfo.label}
                      </p>
                      {tx.createdAt && (
                        <p className="text-[10px] text-[#1a3a2a]/40 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        isCredit ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {isCredit ? "+" : "−"}
                      {Math.abs(tx.amountMinor ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {transactions.length > 10 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full flex items-center justify-center gap-1 py-3 text-xs font-medium text-[#1a3a2a]/50 border-t border-[#1a3a2a]/5"
            >
              Показать все ({transactions.length})
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </TelegramMiniAppLayout>
  );
}
