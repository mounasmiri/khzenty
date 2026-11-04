import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { clothingApi } from './api';
import { ImagePicker } from './image-picker';
import { labelFor } from './labels';
import type { ClothingItem, ClothingItemInput } from './types';
import { SEASONS } from './types';
import { UploadError, uploadItemImage } from './upload';
import type { UploadStage } from './upload';
import { useTaxonomy } from './use-wardrobe';

interface ItemFormProps {
  /** Present when editing; absent when creating. */
  item?: ClothingItem;
  submitLabel: string;
  /** Saves the item and resolves with it, so the photo can be attached to it. */
  onSubmit: (input: ClothingItemInput) => Promise<ClothingItem>;
  /** Called once the item — and its photo, if any — are stored. */
  onDone: (item: ClothingItem) => void;
  onCancel: () => void;
}

type Phase = 'editing' | 'saving' | UploadStage | 'photo-failed';

const PHASE_LABEL: Record<string, string> = {
  saving: 'Saving…',
  signing: 'Preparing upload…',
  uploading: 'Uploading photo…',
  confirming: 'Finishing up…',
};

export function ItemForm({ item, submitLabel, onSubmit, onDone, onCancel }: ItemFormProps) {
  const taxonomy = useTaxonomy();

  const [type, setType] = useState(item?.type ?? '');
  const [color, setColor] = useState(item?.color ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [seasons, setSeasons] = useState<string[]>(item?.seasons ?? []);
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [file, setFile] = useState<File | null>(null);
  /** Tracked locally so the placeholder returns the moment a photo is removed. */
  const [existingImageUrl, setExistingImageUrl] = useState(item?.imageUrl ?? null);

  const [phase, setPhase] = useState<Phase>('editing');
  const [error, setError] = useState<string | null>(null);
  /** Set once the item itself is stored, so a failed photo is not a lost item. */
  const [savedItem, setSavedItem] = useState<ClothingItem | null>(null);

  const busy = phase !== 'editing' && phase !== 'photo-failed';

  function toggleSeason(season: string) {
    setSeasons((current) =>
      current.includes(season) ? current.filter((s) => s !== season) : [...current, season],
    );
  }

  /** Shared by the initial submit and the "try the photo again" button. */
  async function attachPhoto(target: ClothingItem, chosen: File) {
    try {
      await uploadItemImage(target.id, chosen, (stage) => setPhase(stage));
      onDone(target);
    } catch (caught) {
      // The item is already saved at this point, so this is a partial success
      // and must not read like a lost garment.
      setPhase('photo-failed');
      setError(
        caught instanceof UploadError || caught instanceof ApiError
          ? caught.message
          : 'The photo could not be uploaded.',
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!type) {
      setError('Pick a type.');
      return;
    }

    setPhase('saving');

    let saved: ClothingItem;

    try {
      saved = await onSubmit({
        type,
        color: color.trim(),
        // null clears an existing name; the server treats absent as unchanged.
        name: name.trim().length > 0 ? name.trim() : null,
        seasons,
        favorite,
      });
    } catch (caught) {
      setPhase('editing');
      setError(caught instanceof ApiError ? caught.message : 'Could not save the item.');
      return;
    }

    setSavedItem(saved);

    if (!file) {
      onDone(saved);
      return;
    }

    await attachPhoto(saved, file);
  }

  // The item exists but its photo did not land. Offer a retry and a way out,
  // rather than stranding the user on a form whose data is already stored.
  if (phase === 'photo-failed' && savedItem) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">The item was saved, but the photo was not.</p>
          <p role="alert" className="text-destructive mt-1 text-sm">
            {error}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => {
              if (!file) return;
              setError(null);
              void attachPhoto(savedItem, file);
            }}
          >
            Try the photo again
          </Button>
          <Button type="button" variant="outline" onClick={() => onDone(savedItem)}>
            Continue without it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={setType} disabled={busy}>
          <SelectTrigger id="type">
            <SelectValue placeholder={taxonomy ? 'Choose a type' : 'Loading…'} />
          </SelectTrigger>
          <SelectContent>
            {/* Grouped by category, straight from the API, so every option is
                a value the server accepts. */}
            {(taxonomy ?? []).map((group) => (
              <SelectGroup key={group.category}>
                <SelectLabel>{labelFor(group.category)}</SelectLabel>
                {group.types.map((value) => (
                  <SelectItem key={value} value={value}>
                    {labelFor(value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          The category is set automatically from the type.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="color">Colour</Label>
        <Input
          id="color"
          required
          placeholder="Navy"
          value={color}
          disabled={busy}
          onChange={(event) => setColor(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          placeholder="Falls back to the type"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <ImagePicker
        existingUrl={existingImageUrl}
        file={file}
        onSelect={setFile}
        disabled={busy}
        placeholder={type ? labelFor(type) : 'No photo'}
        // Only offered while editing: there is nothing stored to remove during
        // creation.
        onRemoveExisting={
          item
            ? async () => {
                setError(null);

                try {
                  await clothingApi.removeImage(item.id);
                  setExistingImageUrl(null);
                } catch (caught) {
                  setError(
                    caught instanceof ApiError ? caught.message : 'Could not remove the photo.',
                  );
                  throw caught;
                }
              }
            : undefined
        }
      />

      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="mb-2 text-sm font-medium">Seasons</legend>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <Button
              key={season}
              type="button"
              size="sm"
              variant={seasons.includes(season) ? 'default' : 'outline'}
              aria-pressed={seasons.includes(season)}
              onClick={() => toggleSeason(season)}
            >
              {labelFor(season)}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Year-round means selecting all four.</p>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={favorite}
          disabled={busy}
          onChange={(event) => setFavorite(event.target.checked)}
        />
        Favourite
      </label>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? (PHASE_LABEL[phase] ?? 'Working…') : submitLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {/* aria-live so the stage change is announced, not just shown. */}
        <span aria-live="polite" className="text-muted-foreground text-xs">
          {busy ? PHASE_LABEL[phase] : ''}
        </span>
      </div>
    </form>
  );
}
