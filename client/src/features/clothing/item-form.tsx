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
import { labelFor } from './labels';
import type { ClothingItem, ClothingItemInput } from './types';
import { SEASONS } from './types';
import { useTaxonomy } from './use-wardrobe';

interface ItemFormProps {
  /** Present when editing; absent when creating. */
  item?: ClothingItem;
  submitLabel: string;
  onSubmit: (input: ClothingItemInput) => Promise<void>;
  onCancel: () => void;
}

export function ItemForm({ item, submitLabel, onSubmit, onCancel }: ItemFormProps) {
  const taxonomy = useTaxonomy();

  const [type, setType] = useState(item?.type ?? '');
  const [color, setColor] = useState(item?.color ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [seasons, setSeasons] = useState<string[]>(item?.seasons ?? []);
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSeason(season: string) {
    setSeasons((current) =>
      current.includes(season) ? current.filter((s) => s !== season) : [...current, season],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!type) {
      setError('Pick a type.');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        type,
        color: color.trim(),
        // null clears an existing name; the server treats absent as unchanged.
        name: name.trim().length > 0 ? name.trim() : null,
        seasons,
        favorite,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the item.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={setType}>
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
          onChange={(event) => setColor(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          placeholder="Falls back to the type"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
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
        <p className="text-muted-foreground text-xs">
          Year-round means selecting all four.
        </p>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={favorite}
          onChange={(event) => setFavorite(event.target.checked)}
        />
        Favourite
      </label>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
