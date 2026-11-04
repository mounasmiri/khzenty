import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { LAUNDRY_LABEL } from './types';
import type { LaundryStatus } from './types';

interface LaundryToggleProps {
  status: LaundryStatus;
  /** Performs the change; rejections are surfaced by the caller. */
  onChange: (next: LaundryStatus) => Promise<void>;
  size?: 'sm' | 'default';
  disabled?: boolean;
}

const OPTIONS: LaundryStatus[] = ['CLEAN', 'IN_LAUNDRY'];

/**
 * Both states are shown rather than a single action button, so the current
 * status is readable without inferring it from what the button offers to do.
 */
export function LaundryToggle({
  status,
  onChange,
  size = 'sm',
  disabled = false,
}: LaundryToggleProps) {
  const [pending, setPending] = useState(false);

  async function select(next: LaundryStatus) {
    // Re-selecting the current state is a no-op here; the server would accept
    // it, but there is nothing to show for it.
    if (next === status || pending || disabled) {
      return;
    }

    setPending(true);

    try {
      await onChange(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div role="group" aria-label="Laundry status" className="inline-flex gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          size={size}
          variant={option === status ? 'default' : 'outline'}
          aria-pressed={option === status}
          disabled={disabled || pending}
          onClick={() => void select(option)}
        >
          {LAUNDRY_LABEL[option]}
        </Button>
      ))}
    </div>
  );
}
