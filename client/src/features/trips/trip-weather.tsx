import { CloudRain, Sun } from 'lucide-react';

import { formatWeatherDay } from './trip-format';
import type { TripWeather } from './types';

interface TripWeatherStripProps {
  /** Null while loading. */
  weather: TripWeather | null;
}

/** One card per day with min/max and a rain icon, or a plain explanation. */
export function TripWeatherStrip({ weather }: TripWeatherStripProps) {
  if (weather === null) {
    return <p className="text-muted-foreground text-sm">Loading the forecast…</p>;
  }

  if (!weather.forecastAvailable) {
    return (
      <div className="bg-card rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">Forecast not available</p>
        <p className="text-muted-foreground mt-0.5">{weather.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* -mx-4 px-4: the row bleeds to the screen edge on a phone, so the last
          card does not look cut off by the gutter. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {weather.days.map((day) => (
          <li
            key={day.date}
            className="bg-card flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center"
          >
            <span className="text-xs font-medium">{formatWeatherDay(day.date)}</span>
            {day.rainLikely ? (
              <CloudRain className="size-5" aria-label="Rain likely" />
            ) : (
              <Sun className="size-5" aria-label="Mostly dry" />
            )}
            <span className="text-sm font-medium">
              {Math.round(day.minC)}–{Math.round(day.maxC)}°C
            </span>
            {day.precipitationProbability !== null ? (
              <span className="text-muted-foreground text-xs">
                {day.precipitationProbability}% rain
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {weather.partial ? (
        <p className="text-muted-foreground text-xs">
          Only the days inside the forecast window are shown.
        </p>
      ) : null}
    </div>
  );
}
