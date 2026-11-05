import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BackgroundRemovalError, removeGarmentBackground } from './background-removal';
import { acknowledgeModelDownload, hasAcknowledgedModelDownload } from './bg-removal-consent';
import { ModelDownloadNotice } from './model-download-notice';
import { GarmentImage } from './garment-image';

interface ImagePickerProps {
  /** The image already stored on the item, if any. */
  existingUrl: string | null;
  /** The newly picked file, held by the parent until the item is saved. */
  file: File | null;
  onSelect: (file: File | null) => void;
  /** Shown when there is neither a pick nor a stored image. */
  placeholder: string;
  disabled?: boolean;
  /**
   * Deletes the stored photo. Only offered when one exists, and only on edit —
   * there is nothing stored to remove while creating.
   */
  onRemoveExisting?: () => Promise<void>;
}

/**
 * Picks a photo and previews it locally. It does not upload: the item has to
 * exist first, so the parent form uploads after saving.
 */
export function ImagePicker({
  existingUrl,
  file,
  onSelect,
  placeholder,
  disabled = false,
  onRemoveExisting,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);

  /**
   * A finished cutout awaiting a decision. Held here rather than handed
   * straight to the parent, so the original stays available for the
   * side-by-side and for "Keep original".
   */
  const [cutout, setCutout] = useState<{ file: File; url: string } | null>(null);
  const [cuttingOut, setCuttingOut] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [cutoutError, setCutoutError] = useState<string | null>(null);
  /** Shown instead of running, until the one-off download is agreed to. */
  const [askingConsent, setAskingConsent] = useState(false);

  // The cutout's object URL outlives the effect above, so it is revoked by
  // hand when replaced, accepted or discarded.
  function discardCutout() {
    setCutout((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  /** Entry point for the button: ask once, then run. */
  function requestBackgroundRemoval() {
    if (!file || cuttingOut) return;

    if (!hasAcknowledgedModelDownload()) {
      setAskingConsent(true);
      return;
    }

    void runBackgroundRemoval();
  }

  async function runBackgroundRemoval() {
    if (!file || cuttingOut) return;

    setCutoutError(null);
    setCuttingOut(true);
    discardCutout();
    setProgressLabel('Starting…');

    try {
      const result = await removeGarmentBackground(file, ({ key, current, total }) => {
        // The first run downloads ~40 MB, so silence here reads as a hang.
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        setProgressLabel(`Loading ${key} ${String(percent)}%`);
      });

      setProgressLabel('Finishing…');
      setCutout({ file: result.file, url: URL.createObjectURL(result.file) });
    } catch (error) {
      // Never destructive: the picked photo is untouched and still uploads.
      setCutoutError(
        error instanceof BackgroundRemovalError
          ? error.message
          : 'Background removal failed. The original photo will be used.',
      );
    } finally {
      setCuttingOut(false);
      setProgressLabel(null);
    }
  }

  function useCutout() {
    if (!cutout) return;

    // Hand the cutout to the parent; from here it is the file that uploads.
    onSelect(cutout.file);
    URL.revokeObjectURL(cutout.url);
    setCutout(null);
  }

  /**
   * Object URLs hold the file in memory until revoked, so each one is cleaned
   * up when the selection changes or the component unmounts.
   */
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // A local pick wins over the stored image, so the preview shows what will be
  // saved rather than what is currently saved.
  const shown = previewUrl ?? existingUrl;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // A new pick invalidates any pending cutout of the previous photo.
    discardCutout();
    setCutoutError(null);
    onSelect(event.target.files?.[0] ?? null);
  }

  function clear() {
    discardCutout();
    setCutoutError(null);
    onSelect(null);

    // Reset the input's value too, otherwise re-picking the same file fires no
    // change event.
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="photo">Photo (optional)</Label>

      <div className="flex items-start gap-3">
        {/* The same surface as the grid and detail tiles, so the preview shows
            the garment exactly as it will appear once stored. */}
        <GarmentImage
          src={shown}
          alt=""
          placeholder={placeholder}
          className="size-24 shrink-0 rounded-md border"
        />

        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            id="photo"
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={handleChange}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />

          {file ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
              Discard pick
            </Button>
          ) : null}

          {/* Only when a photo is actually stored: nothing to delete otherwise. */}
          {!file && existingUrl && onRemoveExisting ? (
            confirmingRemoval ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Remove this photo?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={removing || disabled}
                    onClick={() => {
                      setRemoving(true);
                      void onRemoveExisting()
                        .catch(() => undefined)
                        .finally(() => {
                          setRemoving(false);
                          setConfirmingRemoval(false);
                        });
                    }}
                  >
                    {removing ? 'Removing…' : 'Yes, remove'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removing}
                    onClick={() => setConfirmingRemoval(false)}
                  >
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setConfirmingRemoval(true)}
              >
                Remove photo
              </Button>
            )
          ) : null}

          {/* Only offered once a photo is staged, and never run automatically:
              it is a slow, large download the user should opt into. */}
          {file && !cutout ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || cuttingOut}
              onClick={requestBackgroundRemoval}
            >
              {cuttingOut ? 'Removing background…' : 'Remove background'}
            </Button>
          ) : null}

          <p className="text-muted-foreground text-xs">
            {file
              ? 'Uploads after the item is saved.'
              : existingUrl
                ? 'Pick a new file to replace this photo.'
                : 'JPG, PNG, WebP or AVIF.'}
          </p>
        </div>
      </div>

      {askingConsent ? (
        <ModelDownloadNotice
          onConfirm={() => {
            acknowledgeModelDownload();
            setAskingConsent(false);
            void runBackgroundRemoval();
          }}
          onCancel={() => setAskingConsent(false)}
        />
      ) : null}

      {cuttingOut ? (
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {progressLabel ?? 'Working…'} — the model downloads once, then is cached.
        </p>
      ) : null}

      {cutoutError ? (
        <p role="alert" className="text-destructive text-sm">
          {cutoutError}
        </p>
      ) : null}

      {/* Before and after, side by side on the same surface the wardrobe uses,
          so the comparison reflects how each will actually look. */}
      {cutout && previewUrl ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Keep the cutout?</p>

          <div className="flex gap-3">
            <figure className="flex flex-col gap-1">
              <GarmentImage
                src={previewUrl}
                alt="Original photo"
                placeholder=""
                className="size-28 rounded-md border"
              />
              <figcaption className="text-muted-foreground text-xs">Original</figcaption>
            </figure>

            <figure className="flex flex-col gap-1">
              <GarmentImage
                src={cutout.url}
                alt="Background removed"
                placeholder=""
                className="size-28 rounded-md border"
              />
              <figcaption className="text-muted-foreground text-xs">Cutout</figcaption>
            </figure>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={disabled} onClick={useCutout}>
              Use cutout
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={discardCutout}
            >
              Keep original
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
