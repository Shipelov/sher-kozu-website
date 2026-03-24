import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook to fetch CMS content blocks for a page.
 * Returns a helper function `get(blockKey, fallback)` that resolves
 * the content from DB or falls back to the hardcoded default.
 */
export function useCmsContent(page: string) {
  const { data: blocks, isLoading } = trpc.cms.getPageBlocks.useQuery(
    { page },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const blockMap = useMemo(() => {
    const map = new Map<string, { content: string | null; imageUrl: string | null; contentType: string; visible: boolean }>();
    if (blocks) {
      for (const b of blocks) {
        map.set(b.blockKey, {
          content: b.content,
          imageUrl: b.imageUrl,
          contentType: b.contentType,
          visible: b.visible,
        });
      }
    }
    return map;
  }, [blocks]);

  /**
   * Get text content for a block key, with fallback.
   */
  function getText(blockKey: string, fallback: string): string {
    const block = blockMap.get(blockKey);
    if (!block) return fallback;
    if (!block.visible) return fallback;
    return block.content ?? fallback;
  }

  /**
   * Get image URL for a block key, with fallback.
   */
  function getImage(blockKey: string, fallback: string): string {
    const block = blockMap.get(blockKey);
    if (!block) return fallback;
    if (!block.visible) return fallback;
    return block.imageUrl ?? fallback;
  }

  /**
   * Get JSON content for a block key, with fallback.
   * Parses the stored JSON string and returns the parsed value,
   * or the fallback if parsing fails or block doesn't exist.
   */
  function getJson<T>(blockKey: string, fallback: T): T {
    const block = blockMap.get(blockKey);
    if (!block) return fallback;
    if (!block.visible) return fallback;
    if (!block.content) return fallback;
    try {
      return JSON.parse(block.content) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Check if a block is visible (defaults to true if not in DB).
   */
  function isVisible(blockKey: string): boolean {
    const block = blockMap.get(blockKey);
    if (!block) return true;
    return block.visible;
  }

  return {
    getText,
    getImage,
    getJson,
    isVisible,
    isLoading,
    hasBlocks: (blocks?.length ?? 0) > 0,
  };
}
