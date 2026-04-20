import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook to fetch CMS content blocks for a page.
 * Returns helper functions to resolve content from DB or fall back to hardcoded defaults.
 */
export function useCmsContent(page: string) {
  const { data: blocks, isLoading } = trpc.cms.getPageBlocks.useQuery(
    { page },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const blockMap = useMemo(() => {
    const map = new Map<
      string,
      {
        content: string | null;
        imageUrl: string | null;
        mobileImageUrl: string | null;
        contentType: string;
        visible: boolean;
        focalX: number;
        focalY: number;
      }
    >();
    if (blocks) {
      for (const b of blocks) {
        map.set(b.blockKey, {
          content: b.content,
          imageUrl: b.imageUrl,
          mobileImageUrl: (b as any).mobileImageUrl ?? null,
          contentType: b.contentType,
          visible: b.visible,
          focalX: (b as any).focalX ?? 50,
          focalY: (b as any).focalY ?? 50,
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
    // Use || instead of ?? so empty strings also fall back
    return block.content || fallback;
  }

  /**
   * Get image URL for a block key, with fallback.
   */
  function getImage(blockKey: string, fallback: string): string {
    const block = blockMap.get(blockKey);
    if (!block) return fallback;
    if (!block.visible) return fallback;
    // Use || instead of ?? so empty strings also fall back
    return block.imageUrl || fallback;
  }

  /**
   * Get image URL + focal point object-position for a block key.
   * Returns { url, mobileUrl, objectPosition } where objectPosition is a CSS value
   * like "30% 20%" that can be applied to object-position.
   * mobileUrl is the 800px-wide WebP variant (null if not available).
   */
  function getImageWithFocus(
    blockKey: string,
    fallback: string
  ): { url: string; mobileUrl: string | null; objectPosition: string } {
    const block = blockMap.get(blockKey);
    if (!block || !block.visible) {
      return { url: fallback, mobileUrl: null, objectPosition: "50% 50%" };
    }
    const url = block.imageUrl || fallback;
    const mobileUrl = block.mobileImageUrl || null;
    const fx = block.focalX ?? 50;
    const fy = block.focalY ?? 50;
    return {
      url,
      mobileUrl,
      objectPosition: `${fx}% ${fy}%`,
    };
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
    getImageWithFocus,
    getJson,
    isVisible,
    isLoading,
    hasBlocks: (blocks?.length ?? 0) > 0,
  };
}
