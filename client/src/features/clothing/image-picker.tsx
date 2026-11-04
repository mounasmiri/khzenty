import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ImagePickerProps {
  /** The image already stored on the item, if any. */
  existingUrl: string | null;
  /** The newly picked file, held by the parent until the item is saved. */
  file: File | null;
  onSelect: (file: File | null) => void;
  /** Shown when there is neither a pick nor a stored image. */
  placeholder: string;
  disabled?: boolean;
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
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    onSelect(event.target.files?.[0] ?? null);
  }

  function clear() {
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
        <div className="bg-muted flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {shown ? (
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-muted-foreground px-1 text-center text-[10px] leading-tight">
              {placeholder}
            </span>
          )}
        </div>

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
              Remove
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
    </div>
  );
}
