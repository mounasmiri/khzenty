import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { createDraftFromPhoto, retryDraftPhoto } from '@/features/clothing/drafts';
import type { DraftStage } from '@/features/clothing/drafts';

const STAGE_LABEL: Record<string, string> = {
  compressing: 'Resizing the photo…',
  signing: 'Preparing upload…',
  uploading: 'Uploading…',
  confirming: 'Finishing up…',
};

/**
 * Photo-only creation: one tap to the camera, and the garment exists.
 *
 * The type and colour are placeholders, set properly afterwards on the
 * quick-sort screen. The point is to make capture fast enough that cataloguing
 * a wardrobe is plausible.
 */
export function QuickAddPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<DraftStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Kept so a failed photo can be retried against the garment that was created. */
  const [pending, setPending] = useState<{ itemId: string; file: File } | null>(null);

  const busy = stage !== null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setPending(null);

    try {
      const result = await createDraftFromPhoto(file, setStage);

      if (result.imageError) {
        // The garment was created; only the photo failed. Say so rather than
        // implying nothing was saved.
        setPending({ itemId: result.item.id, file });
        setError(result.imageError);
        setStage(null);
        return;
      }

      void navigate(`/items/${result.item.id}/edit`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the photo.');
      setStage(null);
    }
  }

  async function retry() {
    if (!pending) return;

    setError(null);
    const message = await retryDraftPhoto(pending.itemId, pending.file, setStage);
    setStage(null);

    if (message) {
      setError(message);
      return;
    }

    void navigate(`/items/${pending.itemId}/edit`, { replace: true });
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quick add</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Take a photo now and set the details later.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4">
        {/* `capture="environment"` opens the rear camera on a phone and is
            ignored on desktop, where this stays an ordinary file picker. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(event) => void handleFile(event)}
          className="sr-only"
          id="quick-add-photo"
        />

        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-16 text-base"
        >
          {busy ? (STAGE_LABEL[stage] ?? 'Working…') : 'Take or choose a photo'}
        </Button>

        <p aria-live="polite" className="text-muted-foreground text-sm">
          {busy ? STAGE_LABEL[stage] : 'Photos are resized to 1200px before uploading.'}
        </p>

        {error ? (
          <div className="flex flex-col gap-2">
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
            {pending ? (
              <>
                <p className="text-sm">The garment was added, but the photo was not.</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void retry()}>
                    Try the photo again
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/items/${pending.itemId}/edit`}>Continue without it</Link>
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/items/bulk-add">Add several at once</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/">Back to wardrobe</Link>
        </Button>
      </div>
    </section>
  );
}
