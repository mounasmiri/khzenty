import type { ReactNode } from 'react';

interface GarmentImageProps {
  /** The stored photo, or null when the garment has none. */
  src: string | null;
  alt: string;
  /** Shown instead of the image — the garment's type label. */
  placeholder: string;
  /** Sizing and shape come from the caller; the surface does not. */
  className?: string;
  /** For state the image itself should reflect, such as dimming in laundry. */
  imageClassName?: string;
  /** Overlays such as a status badge, positioned against this container. */
  children?: ReactNode;
  lazy?: boolean;
}

/**
 * The single place a garment photo is rendered.
 *
 * Two things are deliberately centralised here rather than repeated at each
 * call site:
 *
 * - **The surface.** Cutouts are stored with a transparent background and
 *   never have a colour baked into the file, so whatever shows through is
 *   decided entirely by the `--garment-surface` token. Keeping that in one
 *   component means the grid, detail view, form, laundry basket and any future
 *   outfit board cannot drift apart.
 * - **`object-contain`.** Garment photos arrive at every aspect ratio, and
 *   cropping to fill a tile cuts the toes off shoes and the hems off trousers.
 *
 * Callers supply the box; this supplies what is inside it.
 */
export function GarmentImage({
  src,
  alt,
  placeholder,
  className = '',
  imageClassName = '',
  children,
  lazy = false,
}: GarmentImageProps) {
  return (
    <div
      className={`bg-garment-surface relative flex items-center justify-center overflow-hidden ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          // max-* rather than size-full: with object-contain this keeps the
          // intrinsic aspect ratio and letterboxes against the surface.
          className={`max-h-full max-w-full object-contain ${imageClassName}`}
          {...(lazy ? { loading: 'lazy' as const } : {})}
        />
      ) : (
        <span className="text-muted-foreground px-2 text-center text-xs">{placeholder}</span>
      )}

      {children}
    </div>
  );
}
