import { labelFor } from '@/features/clothing/labels';
import {
  type PixelSize,
  boardExportSize,
  containWithin,
  placementPixels,
} from './board-geometry';
import type { BoardLayout } from './board-layout';
import { layoutForGarments, layoutMatchesGarments } from './garment-layout';
import type { BoardZoneMap, OutfitGarment } from './types';

/** Carries a message safe to show the user. */
export class BoardExportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BoardExportError';
  }
}

/**
 * Fallback surface colour, used only if the CSS variable cannot be read or the
 * canvas rejects its value. Matches `--garment-surface` in light mode.
 */
export const FALLBACK_SURFACE = '#ffffff';

/**
 * Reads the shared surface token out of the document.
 *
 * Read rather than hardcoded so an export matches whatever the user is looking
 * at, dark mode included — the token is the single source of the board's
 * background and this keeps it that way across the canvas boundary.
 */
export function readSurfaceColor(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--garment-surface')
      .trim();

    return value.length > 0 ? value : FALLBACK_SURFACE;
  } catch {
    return FALLBACK_SURFACE;
  }
}

/**
 * Loads an image in a form a canvas will accept.
 *
 * `crossOrigin` is the whole point of this function. Garment photos live on
 * Cloudinary, and drawing a cross-origin image onto a canvas taints it unless
 * it was fetched with CORS — a tainted canvas then throws on `toBlob`, after
 * all the work is done. Requesting CORS up front means the failure happens
 * here, where it can be reported properly.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      reject(
        new BoardExportError(
          'Could not load one of the garment photos — the image host did not allow this page to read it.',
        ),
      );
    });

    image.src = src;
  });
}

/**
 * A muted card with the garment's label, drawn where a photo is missing or
 * could not be loaded, so the export never has a silent hole in it.
 */
function drawPlaceholder(
  context: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; width: number; height: number },
): void {
  const inset = Math.min(box.width, box.height) * 0.06;
  const x = box.x + inset;
  const y = box.y + inset;
  const width = box.width - inset * 2;
  const height = box.height - inset * 2;

  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.06)';
  context.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(width, height) * 0.08);
  context.fill();
  context.stroke();

  context.fillStyle = 'rgba(90, 90, 90, 0.95)';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${String(Math.max(12, Math.round(width * 0.1)))}px system-ui, sans-serif`;
  context.fillText(text, x + width / 2, y + height / 2, width * 0.85);
  context.restore();
}

export interface ExportBoardOptions {
  garments: readonly OutfitGarment[];
  zones: BoardZoneMap;
  /** Saved positions, used when they still describe exactly these garments. */
  layout?: BoardLayout | null;
  /** Defaults to the document's `--garment-surface`. */
  surfaceColor?: string;
  /** Width in pixels; height follows from the board's aspect ratio. */
  width?: number;
}

/**
 * Renders a board to a PNG.
 *
 * Drawn onto a canvas directly rather than by rasterising the DOM. A
 * DOM-to-image library would pull in a dependency, would have to be taught
 * about the CSS variables and the drop shadow anyway, and would still hit the
 * same cross-origin wall. Drawing it is less code and the geometry is already
 * in hand: `computeBoardLayout` produced unit-space boxes, `placementPixels`
 * scales them, and `containWithin` does what `object-contain` does on screen.
 * All three are pure and tested, so only the drawing itself is unverified.
 *
 * PNG, not JPEG: the surface is a flat neutral that JPEG would band, and
 * lossless is the right default for something a user may re-share.
 *
 * Garments load in parallel but draw in placement order, so the result does
 * not depend on which photo arrived first.
 */
export interface ExportBoardResult {
  blob: Blob;
  /** Labels of garments whose photo could not be loaded and were drawn as cards. */
  failedLabels: string[];
}

export async function exportBoardPng(options: ExportBoardOptions): Promise<ExportBoardResult> {
  const { garments, zones, layout } = options;

  const placements =
    layout && layoutMatchesGarments(layout, garments)
      ? layout.placements
      : layoutForGarments(garments, zones).placements;

  if (placements.length === 0) {
    throw new BoardExportError('There is nothing on the board to export yet.');
  }

  const size: PixelSize = boardExportSize(options.width);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new BoardExportError('This browser could not provide a canvas to draw on.');
  }

  const surface = options.surfaceColor ?? readSurfaceColor();
  context.fillStyle = surface;

  // `fillStyle` silently ignores a value it cannot parse, leaving the previous
  // one in place. Reading it back is the only way to tell — and the token is an
  // `oklch()` colour, which older engines will refuse.
  if (context.fillStyle === '#000000' && surface !== '#000000') {
    context.fillStyle = FALLBACK_SURFACE;
  }

  context.fillRect(0, 0, size.width, size.height);

  const byId = new Map(garments.map((garment) => [garment.id, garment]));

  // Loaded together, drawn in order below.
  const images = new Map<string, HTMLImageElement>();
  const failedLabels: string[] = [];

  await Promise.all(
    placements.map(async (placement) => {
      const garment = byId.get(placement.itemId);

      if (!garment?.imageUrl) return;

      try {
        images.set(placement.itemId, await loadImage(garment.imageUrl));
      } catch {
        // One unreadable photo (CORS or network) must not sink the export: it
        // is drawn as a labelled card instead and reported to the caller.
        failedLabels.push(garment.name ?? labelFor(garment.type));
      }
    }),
  );

  for (const placement of placements) {
    const garment = byId.get(placement.itemId);

    if (!garment) continue;

    const box = placementPixels(placement, size);
    const image = images.get(placement.itemId);

    if (!image) {
      drawPlaceholder(context, garment.name ?? labelFor(garment.type), box);
      continue;
    }

    const fitted = containWithin(
      { width: image.naturalWidth, height: image.naturalHeight },
      box,
    );

    context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
  }

  const blob = await new Promise<Blob | null>((resolve, reject) => {
    try {
      canvas.toBlob(resolve, 'image/png');
    } catch (caught) {
      // A tainted canvas throws here, after every image has already loaded.
      reject(
        new BoardExportError(
          'The board could not be exported because the image host did not allow this page to read the photos.',
          { cause: caught },
        ),
      );
    }
  });

  if (!blob) {
    throw new BoardExportError('The board could not be turned into an image.');
  }

  return { blob, failedLabels };
}

/**
 * `outfit-name.png`, safe on every filesystem.
 *
 * Exported so it can be tested: a name is free text, and a slash or a colon in
 * it would otherwise produce a download the OS silently refuses or renames.
 */
export function exportFileName(outfitName: string): string {
  const slug = outfitName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${slug.length > 0 ? slug : 'outfit'}.png`;
}

/** Hands a blob to the browser as a download, then releases the object URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    // Revoked on the next tick, not immediately: the click starts the download
    // asynchronously, and revoking first cancels it in some browsers.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }
}
