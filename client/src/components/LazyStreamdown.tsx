/**
 * LazyStreamdown — a wrapper that dynamically imports `streamdown`
 * so that its heavy transitive dependencies (shiki ~9MB, mermaid ~1.5MB,
 * cytoscape ~645KB, markdown ~764KB) are NOT included in the initial bundle.
 *
 * Usage: replace `<Streamdown>{content}</Streamdown>`
 *   with `<LazyStreamdown>{content}</LazyStreamdown>`
 */

import { lazy, Suspense } from "react";

const StreamdownLazy = lazy(() =>
  import("streamdown").then((mod) => ({ default: mod.Streamdown }))
);

export default function LazyStreamdown({ children }: { children: string }) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse text-muted-foreground text-sm">
          {/* Show raw text while markdown renderer loads */}
          <span className="whitespace-pre-wrap">{children.slice(0, 200)}{children.length > 200 ? "…" : ""}</span>
        </div>
      }
    >
      <StreamdownLazy>{children}</StreamdownLazy>
    </Suspense>
  );
}
