import React from "react";
import { Link } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type PageBreadcrumbsProps = {
  /** Array of breadcrumb segments. Last segment is treated as current page. */
  items: BreadcrumbSegment[];
  /** Whether to show home icon for the first "Главная" segment. Default true. */
  showHomeIcon?: boolean;
  /** Extra CSS class for the outer nav */
  className?: string;
};

/**
 * Build Schema.org BreadcrumbList JSON-LD from breadcrumb segments.
 * Uses window.location.origin to construct absolute URLs.
 */
function buildBreadcrumbJsonLd(items: BreadcrumbSegment[]): object {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${origin}${item.href}` } : {}),
    })),
  };
}

/** Export for testing */
export { buildBreadcrumbJsonLd };

/**
 * Render a single breadcrumb item (link or current page).
 * Does NOT include separator — caller is responsible for that.
 */
function renderItem(
  item: BreadcrumbSegment,
  index: number,
  isLastItem: boolean,
  showHomeIcon: boolean,
  truncateClass?: string,
) {
  const isHome = index === 0 && showHomeIcon && item.label === "Главная";

  if (isLastItem) {
    return (
      <BreadcrumbItem>
        <BreadcrumbPage>
          {truncateClass ? (
            <span className={`${truncateClass} truncate inline-block align-bottom`}>
              {item.label}
            </span>
          ) : (
            item.label
          )}
        </BreadcrumbPage>
      </BreadcrumbItem>
    );
  }

  if (item.href) {
    return (
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href={item.href} className="inline-flex items-center gap-1">
            {isHome && <Home className="h-3.5 w-3.5" />}
            {truncateClass ? (
              <span className={`${truncateClass} truncate inline-block align-bottom`}>
                {isHome ? <span className="sr-only">{item.label}</span> : item.label}
              </span>
            ) : (
              <>
                {isHome && <span className="sr-only">{item.label}</span>}
                {!isHome && <span>{item.label}</span>}
              </>
            )}
          </Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
    );
  }

  return (
    <BreadcrumbItem>
      <span className="inline-flex items-center gap-1">
        {isHome && <Home className="h-3.5 w-3.5" />}
        {truncateClass ? (
          <span className={`${truncateClass} truncate inline-block align-bottom`}>
            {item.label}
          </span>
        ) : (
          <span>{item.label}</span>
        )}
      </span>
    </BreadcrumbItem>
  );
}

/**
 * Reusable breadcrumbs with mobile-responsive truncation
 * and Schema.org BreadcrumbList JSON-LD structured data.
 *
 * On mobile (< sm), if there are more than 3 segments,
 * middle segments collapse into an ellipsis: Home > ... > Prev > Current
 *
 * On desktop, all segments are shown.
 *
 * BreadcrumbSeparator renders <li>, so it must be a sibling of BreadcrumbItem,
 * never nested inside it.
 */
export default function PageBreadcrumbs({
  items,
  showHomeIcon = true,
  className = "",
}: PageBreadcrumbsProps) {
  if (items.length === 0) return null;

  const isLast = (i: number) => i === items.length - 1;
  const needsTruncation = items.length > 3;
  const jsonLd = buildBreadcrumbJsonLd(items);

  return (
    <>
      {/* Schema.org BreadcrumbList structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumb className={className}>
        {/* Desktop: full breadcrumbs */}
        <BreadcrumbList className="hidden sm:flex">
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              {renderItem(item, i, isLast(i), showHomeIcon)}
            </React.Fragment>
          ))}
        </BreadcrumbList>

        {/* Mobile: truncated breadcrumbs */}
        <BreadcrumbList className="flex sm:hidden">
          {needsTruncation ? (
            <>
              {/* First item (Главная) */}
              {renderItem(items[0], 0, false, showHomeIcon)}

              {/* Separator + Ellipsis */}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis className="size-6" />
              </BreadcrumbItem>

              {/* Second-to-last item */}
              <BreadcrumbSeparator />
              {renderItem(
                items[items.length - 2],
                items.length - 2,
                false,
                showHomeIcon,
                "max-w-[120px]",
              )}

              {/* Last item (current page) */}
              <BreadcrumbSeparator />
              {renderItem(
                items[items.length - 1],
                items.length - 1,
                true,
                showHomeIcon,
                "max-w-[120px]",
              )}
            </>
          ) : (
            /* 3 or fewer items: show all, but truncate long labels */
            items.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                {renderItem(
                  item,
                  i,
                  isLast(i),
                  showHomeIcon,
                  isLast(i) ? "max-w-[140px]" : "max-w-[100px]",
                )}
              </React.Fragment>
            ))
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
