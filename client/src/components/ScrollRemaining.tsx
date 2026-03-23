import { useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type ScrollRemainingProps = {
  /** Total number of items in the list */
  totalItems: number;
  /** Approximate height of one item in px (used to estimate visible count) */
  itemHeight?: number;
  /** CSS classes for the outer scroll wrapper */
  className?: string;
  children: ReactNode;
};

/**
 * Wraps a scrollable list and shows a floating "ещё N" indicator
 * at the bottom when there are items below the fold.
 */
export default function ScrollRemaining({
  totalItems,
  itemHeight = 60,
  className = "",
  children,
}: ScrollRemainingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(0);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 8;
      setAtBottom(isAtBottom);

      // Estimate how many items are hidden below
      const hiddenPx = scrollHeight - scrollTop - clientHeight;
      const hiddenCount = Math.max(0, Math.ceil(hiddenPx / itemHeight));
      setRemaining(Math.min(hiddenCount, totalItems));
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [totalItems, itemHeight]);

  const scrollDown = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.7, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} className={className}>
        {children}
      </div>

      {/* Gradient fade + remaining indicator */}
      {remaining > 0 && !atBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <div className="h-10 w-full bg-gradient-to-t from-white/90 to-transparent" />
          <button
            onClick={scrollDown}
            className="pointer-events-auto -mt-3 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-stone-500 shadow-sm backdrop-blur transition hover:bg-stone-50 hover:text-stone-700"
          >
            <ChevronDown className="h-3 w-3" />
            ещё {remaining}
          </button>
        </div>
      )}
    </div>
  );
}
