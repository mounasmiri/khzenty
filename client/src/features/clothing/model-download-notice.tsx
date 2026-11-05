import { Button } from '@/components/ui/button';
import { MODEL_DOWNLOAD_LABEL } from './bg-removal-consent';

interface ModelDownloadNoticeProps {
  onConfirm: () => void;
  onCancel: () => void;
  /** Tailored per entry point; bulk add warns about the whole batch. */
  context?: string;
}

/**
 * Shown once, before the first cutout ever runs.
 *
 * Background removal happens entirely in the browser, which means a one-off
 * model download. On a phone that is a real cost the user should agree to
 * rather than discover — so this is a confirmation, not a toast.
 */
export function ModelDownloadNotice({ onConfirm, onCancel, context }: ModelDownloadNoticeProps) {
  return (
    <div role="dialog" aria-label="Background removal download" className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Background removal downloads {MODEL_DOWNLOAD_LABEL}</p>

      <p className="text-muted-foreground text-sm">
        It runs on your device, so nothing is sent anywhere — but the model has to be
        downloaded once. After that it is cached and later photos are much faster.
        {context ? ` ${context}` : ''}
      </p>

      <p className="text-muted-foreground text-sm">
        You will only be asked this once.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onConfirm}>
          Download and continue
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Not now
        </Button>
      </div>
    </div>
  );
}
