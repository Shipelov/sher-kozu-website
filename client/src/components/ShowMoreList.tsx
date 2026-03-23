import { useState, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

type ShowMoreListProps<T> = {
  items: T[];
  /** Number of items to show initially and per "show more" click */
  pageSize?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** CSS classes for the items container */
  className?: string;
  /** Key extractor */
  getKey: (item: T, index: number) => string | number;
  /** Label for the button — defaults to "Показать ещё" */
  buttonLabel?: string;
  /** Show remaining count badge */
  showRemaining?: boolean;
};

export default function ShowMoreList<T>({
  items,
  pageSize = 6,
  renderItem,
  className = "",
  getKey,
  buttonLabel = "Показать ещё",
  showRemaining = true,
}: ShowMoreListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const remaining = items.length - visibleCount;
  const hasMore = remaining > 0;

  return (
    <div className="space-y-4">
      <div className={className}>
        {visibleItems.map((item, idx) => (
          <div key={getKey(item, idx)}>{renderItem(item, idx)}</div>
        ))}
      </div>

      {hasMore && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="rounded-full border-stone-300 bg-white px-6 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-all hover:bg-stone-50 hover:shadow-md"
            onClick={() => setVisibleCount((prev) => prev + pageSize)}
          >
            <ChevronDown className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
          {showRemaining && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
              ещё {remaining}
            </span>
          )}
        </div>
      )}

      {!hasMore && items.length > pageSize && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount(pageSize)}
            className="text-xs text-stone-400 transition hover:text-stone-600"
          >
            Свернуть до {pageSize}
          </button>
        </div>
      )}
    </div>
  );
}
