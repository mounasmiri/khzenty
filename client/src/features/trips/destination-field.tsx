import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { tripsApi } from './api';
import type { Destination } from './types';

/** Wait for a pause in typing, so each keystroke is not a geocoding request. */
const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface DestinationFieldProps {
  id: string;
  value: string;
  /** Called on every edit; `picked` is set only when a suggestion was chosen. */
  onChange: (value: string, picked: Destination | null) => void;
}

/**
 * City input with suggestions from the server's geocoding endpoint.
 *
 * Choosing a suggestion hands its coordinates to the form, so the trip is saved
 * with the exact place picked. Typing without choosing is still valid — the
 * server geocodes the text — so a failing search never blocks saving.
 */
export function DestinationField({ id, value, onChange }: DestinationFieldProps) {
  const [results, setResults] = useState<Destination[]>([]);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  /** The text a suggestion was just chosen for; no search needed for it. */
  const [settled, setSettled] = useState<string | null>(null);

  useEffect(() => {
    const query = value.trim();

    if (query.length < MIN_QUERY_LENGTH || query === settled) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      tripsApi
        .searchDestinations(query)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setUnavailable(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setUnavailable(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, settled]);

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        placeholder="e.g. Lisbon"
        onChange={(event) => {
          setSettled(null);
          onChange(event.target.value, null);
        }}
      />

      {searching ? <p className="text-muted-foreground text-xs">Searching…</p> : null}

      {unavailable && !searching ? (
        <p className="text-muted-foreground text-xs">
          Suggestions are unavailable right now. You can still type a city and save.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul
          aria-label="Destination suggestions"
          className="bg-popover divide-y overflow-hidden rounded-lg border"
        >
          {results.map((result) => (
            <li key={`${result.label}-${String(result.latitude)}`}>
              <button
                type="button"
                className="hover:bg-accent focus-visible:bg-accent w-full px-3 py-2 text-left text-sm outline-none"
                onClick={() => {
                  setSettled(result.label);
                  setResults([]);
                  onChange(result.label, result);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
