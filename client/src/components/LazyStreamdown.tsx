/**
 * LazyStreamdown — a wrapper that dynamically imports `streamdown`
 * so that its heavy transitive dependencies (shiki ~9MB, mermaid ~1.5MB,
 * cytoscape ~645KB, markdown ~764KB) are NOT included in the initial bundle.
 *
 * Usage: replace `<Streamdown>{content}</Streamdown>`
 *   with `<LazyStreamdown>{content}</LazyStreamdown>`
 */

import { lazy, Suspense } from "react";
import type { StreamdownProps } from "streamdown";

type RehypePlugins = NonNullable<StreamdownProps["rehypePlugins"]>;

/**
 * Встроенный rehype-harden в streamdown не знает origin страницы: относительные
 * ссылки (/animals, /nutritionist) он не может разобрать и рендерит как
 * «текст [blocked]». Передаём defaultOrigin — свои ссылки становятся ссылками.
 */
function buildRehypePlugins(defaults: Record<string, unknown>): RehypePlugins {
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  return Object.entries(defaults).map(([key, value]) => {
    if (key !== "harden") return value;
    const plugin = Array.isArray(value) ? value[0] : value;
    return [plugin, { allowedImagePrefixes: ["*"], allowedLinkPrefixes: ["*"], defaultOrigin: origin, allowDataImages: true }];
  }) as unknown as RehypePlugins;
}

const StreamdownLazy = lazy(() =>
  import("streamdown").then((mod) => {
    const rehypePlugins = buildRehypePlugins(mod.defaultRehypePlugins);
    const Hardened = ({ children }: { children: string }) => (
      <mod.Streamdown rehypePlugins={rehypePlugins}>{children}</mod.Streamdown>
    );
    return { default: Hardened };
  })
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
