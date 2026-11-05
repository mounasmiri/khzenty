const STORAGE_KEY = 'khzenty:bg-removal-model-ack';

/** Rounded figure for the isnet_quint8 model plus the WASM runtime. */
export const MODEL_DOWNLOAD_LABEL = 'about 40 MB';

/**
 * Whether the user has already agreed to the one-off model download.
 *
 * Every access is wrapped: `localStorage` throws outright in a private window
 * with site data blocked, and a crash there would take the whole picker with
 * it. Unreadable storage is treated as "not yet agreed" — the worst case is
 * being asked again, which is far better than silently starting a 40 MB
 * download on a phone.
 */
export function hasAcknowledgedModelDownload(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Remembers the choice. A failure to persist is deliberately ignored: the run
 * the user just confirmed should still proceed, they will simply be asked again
 * next time.
 */
export function acknowledgeModelDownload(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Storage unavailable; consent applies to this session only.
  }
}
