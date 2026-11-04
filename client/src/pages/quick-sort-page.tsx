import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clothingApi } from '@/features/clothing/api';
import { DRAFT_TYPE } from '@/features/clothing/drafts';
import { labelFor } from '@/features/clothing/labels';
import type { ClothingItem } from '@/features/clothing/types';
import { UNSORTED_COLOR_LABEL } from '@/features/clothing/types';
import { useTaxonomy } from '@/features/clothing/use-wardrobe';
import { ApiError } from '@/lib/api';

interface SortState {
  ids?: string[];
}

/** One completed decision, kept so it can be undone. */
interface HistoryEntry {
  item: ClothingItem;
  previousType: string;
  previousColor: string | null;
}

/**
 * Sorts freshly captured drafts one at a time.
 *
 * Deliberately one garment per screen with large targets: this is the mobile
 * path, used right after a bulk capture, and a grid of tiny dropdowns is
 * unusable there.
 */
export function QuickSortPage() {
  const location = useLocation();
  const taxonomy = useTaxonomy();

  const requestedIds = (location.state as SortState | null)?.ids;

  const [queue, setQueue] = useState<ClothingItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  /**
   * Prefers the ids handed over by the bulk flow, so the queue is exactly that
   * batch in pick order. Falls back to every draft in the wardrobe, which makes
   * the screen usable on its own and survives a refresh that loses router
   * state.
   */
  useEffect(() => {
    let cancelled = false;

    clothingApi
      .list()
      .then((items) => {
        if (cancelled) return;

        const byId = new Map(items.map((item) => [item.id, item]));
        const chosen = requestedIds
          ? requestedIds.flatMap((id) => {
              const found = byId.get(id);
              return found ? [found] : [];
            })
          : items.filter((item) => item.type === DRAFT_TYPE);

        setQueue(chosen);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught.message : 'Could not load the drafts.');
        setQueue([]);
      });

    return () => {
      cancelled = true;
    };
    // requestedIds comes from immutable router state; re-running on identity
    // changes would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = queue?.[index];

  // Flat list of types for the big buttons: the grouped picker is too fiddly
  // for a thumb, so the common categories come first.
  const typeOptions = useMemo(() => (taxonomy ?? []).flatMap((group) => group.types), [taxonomy]);

  const advance = useCallback(() => {
    setColor('');
    setError(null);
    setIndex((i) => i + 1);
  }, []);

  async function choose(type: string) {
    if (!current || saving) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await clothingApi.update(current.id, {
        type,
        // Only send a colour when the user typed one; otherwise the draft
        // placeholder stays and remains visibly unfinished.
        ...(color.trim().length > 0 ? { color: color.trim() } : {}),
      });

      setHistory((h) => [
        ...h,
        { item: updated, previousType: current.type, previousColor: current.color },
      ]);
      advance();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that.');
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    const last = history[history.length - 1];

    if (!last || saving) return;

    setSaving(true);
    setError(null);

    try {
      // Put the draft values back, so the garment returns to the queue in the
      // same state it was in before the decision.
      await clothingApi.update(last.item.id, {
        type: last.previousType,
        color: last.previousColor,
      });

      setHistory((h) => h.slice(0, -1));
      setIndex((i) => Math.max(0, i - 1));
      setColor('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not undo that.');
    } finally {
      setSaving(false);
    }
  }

  if (queue === null) {
    return <p className="text-muted-foreground text-sm">Loading drafts…</p>;
  }

  if (queue.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing to sort</h1>
        <p className="text-muted-foreground text-sm">
          Drafts show up here after a bulk upload.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/items/bulk-add">Add photos</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Back to wardrobe</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">All sorted</h1>
        <p className="text-muted-foreground text-sm">
          {history.length} of {queue.length} garment{queue.length === 1 ? '' : 's'} given a type.
        </p>
        <div className="flex gap-2">
          {history.length > 0 ? (
            <Button variant="outline" disabled={saving} onClick={() => void undo()}>
              Undo the last one
            </Button>
          ) : null}
          <Button asChild>
            <Link to="/">See your wardrobe</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">What is this?</h1>
        <p className="text-muted-foreground text-sm">
          {index + 1} of {queue.length}
        </p>
      </div>

      {/* Same contain-on-neutral treatment as the grid, so the garment is fully
          visible while deciding what it is. */}
      <div className="flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border bg-neutral-50 dark:bg-neutral-900">
        {current.imageUrl ? (
          <img src={current.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-sm">No photo</span>
        )}
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="sort-color">Colour (optional)</Label>
          {current.color ? null : <Badge variant="outline">{UNSORTED_COLOR_LABEL}</Badge>}
        </div>
        <Input
          id="sort-color"
          placeholder={current.color ?? 'Navy'}
          value={color}
          disabled={saving}
          onChange={(event) => setColor(event.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Pick a type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {typeOptions.map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void choose(type)}
              className="h-14 justify-start text-left text-sm"
            >
              {labelFor(type)}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={advance}>
          Skip for now
        </Button>
        {history.length > 0 ? (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void undo()}>
            Undo
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link to="/">Finish later</Link>
        </Button>
      </div>
    </section>
  );
}
