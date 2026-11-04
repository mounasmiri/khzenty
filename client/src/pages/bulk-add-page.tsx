import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_LABEL, UPLOAD_CONCURRENCY, useBulkAdd } from '@/features/clothing/use-bulk-add';

/**
 * Bulk capture: pick a batch of photos, each becoming a draft garment.
 *
 * Uploads run a few at a time rather than all at once, so per-file progress is
 * meaningful and a large batch does not starve the connection.
 */
export function BulkAddPage() {
  const navigate = useNavigate();
  const { entries, running, addFiles, run, retryFailed, reset, createdIds } = useBulkAdd();

  const queued = entries.filter((e) => e.status === 'queued').length;
  const failed = entries.filter((e) => e.status === 'failed').length;
  const done = entries.filter((e) => e.status === 'done').length;

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    // Reset the input so re-picking the same files fires another change event.
    event.target.value = '';
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add several photos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Each photo becomes a draft garment. Sort them straight after.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <label
          htmlFor="bulk-photos"
          className="hover:bg-accent flex h-16 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm font-medium"
        >
          Choose photos
        </label>
        <input
          id="bulk-photos"
          type="file"
          accept="image/*"
          multiple
          disabled={running}
          onChange={handleFiles}
          className="sr-only"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={running || queued === 0} onClick={() => void run()}>
            {running ? 'Uploading…' : `Upload ${String(queued)} photo${queued === 1 ? '' : 's'}`}
          </Button>

          {failed > 0 && !running ? (
            <Button type="button" variant="outline" onClick={() => void retryFailed()}>
              Retry {failed} failed
            </Button>
          ) : null}

          {entries.length > 0 && !running ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear list
            </Button>
          ) : null}
        </div>

        <p aria-live="polite" className="text-muted-foreground text-xs">
          {running
            ? `Uploading ${String(UPLOAD_CONCURRENCY)} at a time — ${String(done)} of ${String(entries.length)} done.`
            : `Resized to 1200px before upload. ${String(UPLOAD_CONCURRENCY)} upload at a time.`}
        </p>
      </div>

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.file.name}</p>
                {entry.error ? (
                  <p role="alert" className="text-destructive text-xs">
                    {entry.error}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
              </div>

              <Badge
                variant={
                  entry.status === 'done'
                    ? 'secondary'
                    : entry.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                }
              >
                {STATUS_LABEL[entry.status] ?? entry.status}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {createdIds.length > 0 && !running ? (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {createdIds.length} garment{createdIds.length === 1 ? '' : 's'} added as drafts.
          </p>
          <p className="text-muted-foreground text-sm">
            They need a type before they are useful in outfits.
          </p>
          <Button
            type="button"
            className="self-start"
            // The ids travel in router state so the sort queue is exactly this
            // batch, in the order they were picked.
            onClick={() => void navigate('/items/sort', { state: { ids: createdIds } })}
          >
            Sort them now
          </Button>
        </div>
      ) : null}

      <Button asChild variant="ghost" className="self-start">
        <Link to="/">Back to wardrobe</Link>
      </Button>
    </section>
  );
}
