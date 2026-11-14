import { Check, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { labelFor } from '@/features/clothing/labels';
import { categoryProgress, isTargetMet, percent } from './trip-format';
import type { CategoryGuidance } from './types';
import { MAX_MANUAL_COUNT } from './types';

interface CategoryProgressProps {
  rows: CategoryGuidance[];
  days: number;
  /** Sets the by-hand count for a category to an absolute value. */
  onChangeManual: (category: string, count: number) => void;
}

/** Categories whose name is already a collective noun ("Footwear", not "Footwears"). */
const COLLECTIVE = new Set([
  'FOOTWEAR',
  'OUTERWEAR',
  'UNDERWEAR',
  'ACTIVEWEAR',
  'SLEEPWEAR',
  'SWIMWEAR',
  'OTHER',
]);

/** Heading text for a category, e.g. "Tops", "Accessories", "Underwear". */
function categoryLabel(category: string): string {
  const label = labelFor(category);

  if (COLLECTIVE.has(category)) return label;
  if (category === 'ACCESSORY') return 'Accessories';
  if (category === 'DRESS') return 'Dresses';

  return `${label}s`;
}

/**
 * Planned count against the suggested count, per category.
 *
 * Guidance, not a rule: meeting the target shows a quiet check, exceeding it
 * looks exactly the same, and nothing here is ever styled as an error.
 */
export function CategoryProgress({ rows, days, onChangeManual }: CategoryProgressProps) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What to pack</h2>
        <p className="text-muted-foreground text-sm">
          A suggestion for {days === 1 ? '1 day' : `${String(days)} days`}. Pack more or less as you
          like.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const met = isTargetMet(row);
          const progress = categoryProgress(row);
          const label = categoryLabel(row.category);

          return (
            <li key={row.category} className="bg-card space-y-1.5 rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{label}</span>
                <span
                  className="flex items-center gap-1"
                  title={`${String(row.planned)} from your wardrobe, ${String(row.manual)} counted by hand`}
                >
                  {met ? <Check className="size-4" aria-label="Target met" /> : null}
                  {row.recommended === null
                    ? `${String(progress)} planned`
                    : `${String(progress)}/${String(row.recommended)}`}

                  {/* Only where there is a suggestion: that is where "I packed
                      these without photos" has a target to count toward. */}
                  {row.recommended !== null ? (
                    <span className="ml-1 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 sm:size-8"
                        disabled={row.manual <= 0}
                        aria-label={`One fewer ${label.toLowerCase()} packed outside the app`}
                        onClick={() => onChangeManual(row.category, row.manual - 1)}
                      >
                        <Minus />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 sm:size-8"
                        disabled={row.manual >= MAX_MANUAL_COUNT}
                        aria-label={`One more ${label.toLowerCase()} packed outside the app`}
                        onClick={() => onChangeManual(row.category, row.manual + 1)}
                      >
                        <Plus />
                      </Button>
                    </span>
                  ) : null}
                </span>
              </div>

              {row.recommended !== null ? (
                <div
                  className="bg-muted h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={row.recommended}
                  aria-valuenow={Math.min(progress, row.recommended)}
                  aria-label={`${label} planned`}
                >
                  <div
                    className="bg-foreground h-full rounded-full"
                    style={{ width: `${String(percent(progress, row.recommended))}%` }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
