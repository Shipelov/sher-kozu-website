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
 * Reusable breadcrumbs with mobile-responsive truncation
 * and Schema.org BreadcrumbList JSON-LD structured data.
 *
 * On mobile (< sm), if there are more than 3 segments,
 * middle segments collapse into an ellipsis: Home > ... > Current
 *
 * On desktop, all segments are shown.
 */
export default function PageBreadcrumbs({
  items,
  showHomeIcon = true,
  className = "",
}: PageBreadcrumbsProps) {
  if (items.length === 0) return null;

  const isLast = (i: number) => i === items.length - 1;

  // For mobile: show first, ellipsis, last two (if > 3 items)
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
            <BreadcrumbItem key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              {isLast(i) ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="inline-flex items-center gap-1">
                    {i === 0 && showHomeIcon && item.label === "Главная" && (
                      <Home className="h-3.5 w-3.5" />
                    )}
                    <span>{item.label}</span>
                  </Link>
                </BreadcrumbLink>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {i === 0 && showHomeIcon && item.label === "Главная" && (
                    <Home className="h-3.5 w-3.5" />
                  )}
                  <span>{item.label}</span>
                </span>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>

        {/* Mobile: truncated breadcrumbs */}
        <BreadcrumbList className="flex sm:hidden">
          {needsTruncation ? (
            <>
              {/* First item (Главная) */}
              <BreadcrumbItem>
                {items[0].href ? (
                  <BreadcrumbLink asChild>
                    <Link href={items[0].href} className="inline-flex items-center gap-1">
                      {showHomeIcon && items[0].label === "Главная" && (
                        <Home className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">{items[0].label}</span>
                      {!(showHomeIcon && items[0].label === "Главная") && (
                        <span>{items[0].label}</span>
                      )}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{items[0].label}</span>
                )}
              </BreadcrumbItem>

              {/* Ellipsis */}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis className="size-6" />
              </BreadcrumbItem>

              {/* Second-to-last item */}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {items[items.length - 2].href ? (
                  <BreadcrumbLink asChild>
                    <Link href={items[items.length - 2].href!}>
                      <span className="max-w-[120px] truncate inline-block align-bottom">
                        {items[items.length - 2].label}
                      </span>
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="max-w-[120px] truncate inline-block align-bottom">
                    {items[items.length - 2].label}
                  </span>
                )}
              </BreadcrumbItem>

              {/* Last item (current page) */}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span className="max-w-[120px] truncate inline-block align-bottom">
                    {items[items.length - 1].label}
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            /* 3 or fewer items: show all, but truncate long labels */
            items.map((item, i) => (
              <BreadcrumbItem key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                {isLast(i) ? (
                  <BreadcrumbPage>
                    <span className="max-w-[140px] truncate inline-block align-bottom">
                      {item.label}
                    </span>
                  </BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="inline-flex items-center gap-1">
                      {i === 0 && showHomeIcon && item.label === "Главная" && (
                        <Home className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-[100px] truncate inline-block align-bottom">
                        {item.label}
                      </span>
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="max-w-[100px] truncate inline-block align-bottom">
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>
            ))
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
