import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

/**
 * Whether the server has demo login switched on.
 *
 * The server answers 404 when it is off, so any failure — 404, network error —
 * reads as "not available" and the button stays hidden rather than appearing
 * and then failing when clicked.
 */
export function useDemoAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<{ enabled: boolean }>('/auth/demo')
      .then(({ enabled }) => {
        if (!cancelled) setAvailable(enabled);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
