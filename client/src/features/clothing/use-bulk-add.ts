import { useCallback, useRef, useState } from 'react';

import { runWithConcurrency } from './concurrency';
import { createDraftFromPhoto, retryDraftPhoto } from './drafts';
import type { DraftStage } from './drafts';

/** Three at a time: enough to keep the connection busy, few enough that each finishes promptly. */
export const UPLOAD_CONCURRENCY = 3;

export type EntryStatus = 'queued' | DraftStage | 'done' | 'failed';

export interface BulkEntry {
  /** Stable key: File objects are not reliable React keys across renders. */
  id: string;
  file: File;
  status: EntryStatus;
  error?: string;
  /** Set once the garment exists, even if its photo later failed. */
  itemId?: string;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: 'Waiting',
  'removing-background': 'Removing background',
  compressing: 'Resizing',
  signing: 'Preparing',
  uploading: 'Uploading',
  confirming: 'Finishing',
  done: 'Added',
  failed: 'Failed',
};

let nextId = 0;

export function useBulkAdd() {
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [running, setRunning] = useState(false);
  /** Opt-in: background removal is slow and downloads a large model. */
  const [removeBackgrounds, setRemoveBackgrounds] = useState(false);
  // Read inside async tasks, where the state value would be a stale closure.
  const removeBackgroundsRef = useRef(false);
  // Read inside async tasks, where the state value would be a stale closure.
  const entriesRef = useRef<BulkEntry[]>([]);

  const setRemoveBackgroundsSynced = useCallback((value: boolean) => {
    removeBackgroundsRef.current = value;
    setRemoveBackgrounds(value);
  }, []);

  const sync = useCallback((next: BulkEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<BulkEntry>) => {
      sync(entriesRef.current.map((e) => (e.id === id ? { ...e, ...changes } : e)));
    },
    [sync],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const added: BulkEntry[] = files.map((file) => {
        nextId += 1;
        return { id: `f${String(nextId)}`, file, status: 'queued' };
      });

      sync([...entriesRef.current, ...added]);
    },
    [sync],
  );

  const reset = useCallback(() => {
    sync([]);
  }, [sync]);

  /** Processes one entry, recording a partial success distinctly from a failure. */
  const processEntry = useCallback(
    async (entry: BulkEntry) => {
      try {
        if (entry.itemId) {
          // The garment already exists; only the photo needs another attempt.
          const error = await retryDraftPhoto(
            entry.itemId,
            entry.file,
            (stage) => patch(entry.id, { status: stage }),
            { removeBackground: removeBackgroundsRef.current },
          );

          patch(entry.id, {
            status: error ? 'failed' : 'done',
            ...(error ? { error } : { error: undefined }),
          });
          return;
        }

        const result = await createDraftFromPhoto(
          entry.file,
          (stage) => patch(entry.id, { status: stage }),
          { removeBackground: removeBackgroundsRef.current },
        );

        patch(entry.id, {
          itemId: result.item.id,
          status: result.imageError ? 'failed' : 'done',
          ...(result.imageError ? { error: result.imageError } : { error: undefined }),
        });
      } catch (error) {
        // Creating the garment itself failed, so there is nothing to keep.
        patch(entry.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Could not add this photo.',
        });
      }
    },
    [patch],
  );

  const run = useCallback(
    async (only?: readonly string[]) => {
      const targets = entriesRef.current.filter((e) =>
        only ? only.includes(e.id) : e.status === 'queued',
      );

      if (targets.length === 0) {
        return;
      }

      setRunning(true);

      try {
        // One at a time while removing backgrounds: the model is the
        // bottleneck and already serialises on its own queue, so a wider
        // limit would only queue uploads behind it and muddle the progress
        // each row reports.
        await runWithConcurrency(
          targets.map((entry) => () => processEntry(entry)),
          removeBackgroundsRef.current ? 1 : UPLOAD_CONCURRENCY,
        );
      } finally {
        setRunning(false);
      }
    },
    [processEntry],
  );

  const retryFailed = useCallback(async () => {
    const failed = entriesRef.current.filter((e) => e.status === 'failed').map((e) => e.id);
    await run(failed);
  }, [run]);

  /** Ids of every garment created, in picked order — the quick-sort queue. */
  const createdIds = entries.flatMap((e) => (e.itemId ? [e.itemId] : []));

  return {
    entries,
    running,
    addFiles,
    run,
    retryFailed,
    reset,
    createdIds,
    removeBackgrounds,
    setRemoveBackgrounds: setRemoveBackgroundsSynced,
  };
}
