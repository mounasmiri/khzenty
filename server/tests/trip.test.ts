import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { addDays, formatCalendarDate, todayUtc } from '../src/lib/calendar-date.js';
import { clearWeatherCache } from '../src/services/weather.service.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

const PARIS = { latitude: 48.85, longitude: 2.35 };

/** Dates relative to today, so the forecast window is tested rather than the calendar. */
const inDays = (offset: number) => formatCalendarDate(addDays(todayUtc(), offset));

/** Stands in for Open-Meteo. Supertest talks over `http`, so stubbing `fetch` only affects the server's own calls. */
function stubOpenMeteo(mode: 'ok' | 'down' = 'ok') {
  const fetchMock = vi.fn((input: URL | string) => {
    const url = new URL(input.toString());

    if (mode === 'down') {
      return Promise.reject(new Error('network blocked'));
    }

    if (url.hostname.startsWith('geocoding')) {
      const name = url.searchParams.get('name') ?? '';

      return Promise.resolve(
        Response.json(
          name === 'Nowhereville'
            ? {}
            : { results: [{ name, country: 'France', ...PARIS }] },
        ),
      );
    }

    const start = new Date(`${url.searchParams.get('start_date') ?? ''}T00:00:00Z`);
    const end = new Date(`${url.searchParams.get('end_date') ?? ''}T00:00:00Z`);
    const time: string[] = [];

    for (let day = start; day <= end; day = addDays(day, 1)) {
      time.push(formatCalendarDate(day));
    }

    return Promise.resolve(
      Response.json({
        daily: {
          time,
          temperature_2m_min: time.map(() => 8),
          temperature_2m_max: time.map(() => 14),
          precipitation_probability_max: time.map(() => 70),
        },
      }),
    );
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

describe('trips', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let intruder: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('packer@khzenty.test');
    await createUser('snoop@khzenty.test');

    agent = await signIn('packer@khzenty.test');
    intruder = await signIn('snoop@khzenty.test');
  });

  beforeEach(async () => {
    await prisma.trip.deleteMany({});
    await prisma.clothingItem.deleteMany({});
    await prisma.outfit.deleteMany({});
    clearWeatherCache();
    stubOpenMeteo();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTrip(overrides: Record<string, unknown> = {}, who = agent) {
    return who.post('/api/trips').send({
      name: 'Paris weekend',
      destination: 'Paris',
      startDate: inDays(2),
      endDate: inDays(5),
      ...overrides,
    });
  }

  async function createItem(type = 'TSHIRT', who = agent): Promise<string> {
    const res = await who.post('/api/items').send({ type, color: 'White' }).expect(201);

    return res.body.item.id as string;
  }

  describe('create and validate', () => {
    it('geocodes the destination and reports the day count', async () => {
      const res = await createTrip().then((r) => {
        expect(r.status).toBe(201);
        return r;
      });

      expect(res.body.trip).toMatchObject({
        name: 'Paris weekend',
        destinationName: 'Paris, France',
        latitude: PARIS.latitude,
        days: 4,
        entryCount: 0,
      });
    });

    it('uses coordinates from a destination search without geocoding again', async () => {
      const fetchMock = stubOpenMeteo();

      const res = await createTrip({ destination: 'Lyon, France', latitude: 45.76, longitude: 4.83 });

      expect(res.status).toBe(201);
      expect(res.body.trip.destinationName).toBe('Lyon, France');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an unknown destination', async () => {
      const res = await createTrip({ destination: 'Nowhereville' });

      expect(res.status).toBe(400);
    });

    it('rejects an end date before the start date', async () => {
      expect((await createTrip({ startDate: inDays(5), endDate: inDays(2) })).status).toBe(400);
    });

    it('rejects a trip longer than 60 days', async () => {
      expect((await createTrip({ startDate: inDays(1), endDate: inDays(70) })).status).toBe(400);
    });

    it('accepts a trip of exactly 60 days', async () => {
      expect((await createTrip({ startDate: inDays(1), endDate: inDays(60) })).status).toBe(201);
    });

    it('rejects an impossible date', async () => {
      expect((await createTrip({ startDate: '2026-02-31' })).status).toBe(400);
    });

    it('rejects half a coordinate pair', async () => {
      expect((await createTrip({ latitude: 10 })).status).toBe(400);
    });

    it('answers 502, not 500, when geocoding is down', async () => {
      stubOpenMeteo('down');

      expect((await createTrip()).status).toBe(502);
    });

    it('requires a session', async () => {
      const { default: request } = await import('supertest');
      const { app } = await import('./helpers.js');

      await request(app).get('/api/trips').expect(401);
    });
  });

  describe('update, list and delete', () => {
    it('validates the merged date range when only one date is sent', async () => {
      const id = (await createTrip()).body.trip.id as string;

      await agent.patch(`/api/trips/${id}`).send({ endDate: inDays(0) }).expect(400);
      await agent.patch(`/api/trips/${id}`).send({ endDate: inDays(8) }).expect(200);
    });

    it('re-geocodes only when the destination changes', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const fetchMock = stubOpenMeteo();

      await agent.patch(`/api/trips/${id}`).send({ name: 'Renamed' }).expect(200);
      expect(fetchMock).not.toHaveBeenCalled();

      await agent.patch(`/api/trips/${id}`).send({ destination: 'Rome' }).expect(200);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('lists only the caller\'s trips with packing counts', async () => {
      const id = (await createTrip()).body.trip.id as string;
      await createTrip({ name: 'Not yours' }, intruder);
      const itemId = await createItem();

      const added = await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: itemId });
      const entryId = added.body.trip.entries[0].id as string;
      await agent.patch(`/api/trips/${id}/entries/${entryId}`).send({ packed: true }).expect(200);

      const res = await agent.get('/api/trips').expect(200);

      expect(res.body.trips).toHaveLength(1);
      expect(res.body.trips[0]).toMatchObject({ entryCount: 1, packedCount: 1 });
    });

    it('deletes a trip and its entries but not the garments', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const itemId = await createItem();
      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: itemId }).expect(201);

      await agent.delete(`/api/trips/${id}`).expect(204);

      expect(await prisma.tripEntry.count()).toBe(0);
      expect(await prisma.clothingItem.count()).toBe(1);
      await agent.get(`/api/trips/${id}`).expect(404);
    });
  });

  describe('entries', () => {
    it('adds and removes a garment and an outfit', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const itemId = await createItem();
      const outfit = await agent.post('/api/outfits').send({ name: 'Day', itemIds: [itemId] }).expect(201);

      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: itemId }).expect(201);
      const res = await agent
        .post(`/api/trips/${id}/entries`)
        .send({ outfitId: outfit.body.outfit.id })
        .expect(201);

      expect(res.body.trip.entries).toHaveLength(2);

      const entry = res.body.trip.entries[0].id as string;
      await agent.delete(`/api/trips/${id}/entries/${entry}`).expect(204);
      await agent.delete(`/api/trips/${id}/entries/${entry}`).expect(404);
    });

    it('rejects a duplicate garment or outfit with 409', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const itemId = await createItem();

      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: itemId }).expect(201);
      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: itemId }).expect(409);
    });

    it('needs exactly one target', async () => {
      const id = (await createTrip()).body.trip.id as string;

      await agent.post(`/api/trips/${id}/entries`).send({}).expect(400);
      await agent
        .post(`/api/trips/${id}/entries`)
        .send({ clothingItemId: 'a', outfitId: 'b' })
        .expect(400);
    });

    it('the database refuses an entry with no target', async () => {
      const id = (await createTrip()).body.trip.id as string;

      await expect(prisma.tripEntry.create({ data: { tripId: id } })).rejects.toThrow();
    });

    it('allows a garment that is in the laundry and flags it', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const itemId = await createItem();
      await prisma.clothingItem.update({ where: { id: itemId }, data: { laundryStatus: 'IN_LAUNDRY' } });

      const res = await agent
        .post(`/api/trips/${id}/entries`)
        .send({ clothingItemId: itemId })
        .expect(201);

      expect(res.body.trip.entries[0].item.laundryStatus).toBe('IN_LAUNDRY');
    });

    it('treats another user\'s garment, outfit and trip as not found', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const theirItem = await createItem('TSHIRT', intruder);
      const theirOutfit = await intruder.post('/api/outfits').send({ name: 'Theirs' }).expect(201);
      const theirTrip = (await createTrip({ name: 'Theirs' }, intruder)).body.trip.id as string;

      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: theirItem }).expect(404);
      await agent
        .post(`/api/trips/${id}/entries`)
        .send({ outfitId: theirOutfit.body.outfit.id })
        .expect(404);

      await agent.get(`/api/trips/${theirTrip}`).expect(404);
      await agent.patch(`/api/trips/${theirTrip}`).send({ name: 'x' }).expect(404);
      await agent.delete(`/api/trips/${theirTrip}`).expect(404);
      await agent.get(`/api/trips/${theirTrip}/weather`).expect(404);
      const myItem = await createItem();
      await agent
        .post(`/api/trips/${theirTrip}/entries`)
        .send({ clothingItemId: myItem })
        .expect(404);
    });

    it('cannot toggle or remove an entry through someone else\'s trip', async () => {
      const mine = (await createTrip()).body.trip.id as string;
      const other = (await createTrip({}, intruder)).body.trip.id as string;
      const itemId = await createItem('TSHIRT', intruder);
      const added = await intruder.post(`/api/trips/${other}/entries`).send({ clothingItemId: itemId });
      const entryId = added.body.trip.entries[0].id as string;

      await agent.patch(`/api/trips/${mine}/entries/${entryId}`).send({ packed: true }).expect(404);
      await agent.delete(`/api/trips/${other}/entries/${entryId}`).expect(404);
    });
  });

  describe('packing progress', () => {
    it('counts an outfit\'s garments by category without double-counting', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const shirt = await createItem('TSHIRT');
      const jeans = await createItem('JEANS');
      const outfit = await agent
        .post('/api/outfits')
        .send({ name: 'Day', itemIds: [shirt, jeans] })
        .expect(201);

      await agent.post(`/api/trips/${id}/entries`).send({ clothingItemId: shirt }).expect(201);
      await agent.post(`/api/trips/${id}/entries`).send({ outfitId: outfit.body.outfit.id }).expect(201);

      const res = await agent.get(`/api/trips/${id}`).expect(200);
      const byCategory = Object.fromEntries(
        res.body.trip.packing.categories.map((c: { category: string; planned: number }) => [
          c.category,
          c,
        ]),
      );

      expect(byCategory['TOP'].planned).toBe(1);
      expect(byCategory['BOTTOM'].planned).toBe(1);
      expect(byCategory['TOP'].recommended).toBe(4);
      expect(res.body.trip.packing.total).toBe(2);
    });

    it('uses the forecast for outerwear when there is one', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const res = await agent.get(`/api/trips/${id}`).expect(200);
      const outerwear = res.body.trip.packing.categories.find(
        (c: { category: string }) => c.category === 'OUTERWEAR',
      );

      // 8°C minimum (one layer) plus likely rain.
      expect(outerwear.recommended).toBe(2);
    });
  });

  describe('weather', () => {
    it('returns per-day figures and a summary line inside the window', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const res = await agent.get(`/api/trips/${id}/weather`).expect(200);

      expect(res.body.weather.forecastAvailable).toBe(true);
      expect(res.body.weather.days).toHaveLength(4);
      expect(res.body.weather.days[0]).toMatchObject({
        minC: 8,
        maxC: 14,
        precipitationProbability: 70,
        summary: '8–14°C, rain likely',
      });
    });

    it('says so, rather than inventing data, beyond the forecast window', async () => {
      const id = (await createTrip({ startDate: inDays(40), endDate: inDays(43) })).body.trip
        .id as string;
      const fetchMock = stubOpenMeteo();

      const res = await agent.get(`/api/trips/${id}/weather`).expect(200);

      expect(res.body.weather).toMatchObject({
        forecastAvailable: false,
        reason: 'TOO_FAR_AHEAD',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a finished trip as in the past', async () => {
      const id = (await createTrip({ startDate: inDays(-9), endDate: inDays(-6) })).body.trip
        .id as string;

      const res = await agent.get(`/api/trips/${id}/weather`).expect(200);

      expect(res.body.weather.reason).toBe('IN_THE_PAST');
    });

    it('caches a forecast between requests', async () => {
      const id = (await createTrip()).body.trip.id as string;
      const fetchMock = stubOpenMeteo();

      await agent.get(`/api/trips/${id}/weather`).expect(200);
      await agent.get(`/api/trips/${id}/weather`).expect(200);

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('keeps the trip page working when the weather service is down', async () => {
      const id = (await createTrip()).body.trip.id as string;
      stubOpenMeteo('down');
      clearWeatherCache();

      const weather = await agent.get(`/api/trips/${id}/weather`).expect(200);
      const trip = await agent.get(`/api/trips/${id}`).expect(200);

      expect(weather.body.weather).toMatchObject({
        forecastAvailable: false,
        reason: 'SERVICE_UNAVAILABLE',
      });
      expect(trip.body.trip.id).toBe(id);
    });
  });

  describe('destination search', () => {
    it('returns labelled candidates with coordinates', async () => {
      const res = await agent.get('/api/trips/destinations?q=Paris').expect(200);

      expect(res.body.destinations[0]).toMatchObject({ label: 'Paris, France', ...PARIS });
    });

    it('rejects a query that is too short', async () => {
      await agent.get('/api/trips/destinations?q=P').expect(400);
    });
  });
});
