import { useState, useRef, useEffect, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * LazyImage — progressive image loader with blur-up placeholder.
 *
 * 1. Shows a blurred low-res placeholder (tiny inline SVG or CSS gradient)
 *    while the full image loads.
 * 2. Uses native `loading="lazy"` for viewport-aware deferred loading.
 * 3. Fades in the full image once loaded, removing the blur overlay.
 *
 * Optional `placeholderColor` sets the background tint while loading.
 */

type LazyImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "onLoad" | "onError"> & {
  /** CSS color for the placeholder background (default: neutral stone) */
  placeholderColor?: string;
  /** Extra classes for the wrapper div */
  wrapperClassName?: string;
  /** Whether to skip the blur animation (e.g. when image is cached) */
  skipTransition?: boolean;
};

export default function LazyImage({
  src,
  alt,
  className,
  wrapperClassName,
  placeholderColor = "rgb(231 229 224)", // stone-200 equivalent
  skipTransition = false,
  ...rest
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image is already cached by the browser, mark as loaded immediately
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const showPlaceholder = !loaded && !error;
  const instant = skipTransition || loaded;

  return (
    <div
      className={cn("relative overflow-hidden", wrapperClassName)}
      style={{ backgroundColor: placeholderColor }}
    >
      {/* Blur placeholder overlay */}
      <div
        className={cn(
          "absolute inset-0 z-10 transition-opacity",
          instant ? "duration-0" : "duration-500 ease-out",
          showPlaceholder ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Animated shimmer */}
        <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: placeholderColor }} />
        {/* Blurred tiny preview — a soft radial gradient mimicking a photo */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, ${placeholderColor}, rgba(0,0,0,0.05))`,
            filter: "blur(20px)",
          }}
        />
      </div>

      {/* Actual image */}
      {src && !error ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "transition-opacity",
            instant ? "duration-0" : "duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...rest}
        />
      ) : error ? (
        <div className={cn("flex items-center justify-center text-muted-foreground text-sm", className)}>
          Фото скоро появится
        </div>
      ) : (
        <div className={cn("animate-pulse", className)} style={{ backgroundColor: placeholderColor }} />
      )}
    </div>
  );
}
