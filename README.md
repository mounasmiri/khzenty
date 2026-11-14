# 👗 Khzenty

[![CI](https://github.com/mounasmiri/khzenty/actions/workflows/ci.yml/badge.svg)](https://github.com/mounasmiri/khzenty/actions/workflows/ci.yml)

> Organize less. Decide faster. Dress better.

Khzenty is a modern wardrobe assistant that helps users organize their clothes, create outfits, and simplify daily outfit decisions.

Built as a portfolio project using a modern full-stack architecture and developed with production-quality practices.

## 📌 Status

**MVP v1.0.** The core loop works end to end: add clothes with photos, turn them into uniform cutouts, build outfits on a board, wear them, and track what is in the laundry.

It runs locally. Deployment, packing lists and statistics are next (see the [Roadmap](#️-roadmap)).

## 📸 Screenshots

<!-- TODO: add three images to docs/screenshots/ with these names -->
<p align="center">
  <img src="docs/screenshots/wardrobe.png" alt="Wardrobe grid" width="31%" />
  <img src="docs/screenshots/outfit-board.png" alt="Outfit board" width="31%" />
  <img src="docs/screenshots/laundry.png" alt="Laundry basket" width="31%" />
</p>

## ✨ Features

**Built**

- Email and password accounts, with Argon2id hashing
- httpOnly cookie sessions and a protected-route wrapper
- Wardrobe data model: garments, outfits, wear log, and the joins between them
- Garment CRUD, scoped per user, with the category derived from the type
- Season tagging and favourites (which sort to the top of the grid)
- Delete confirmation that names how many outfits the garment will leave
- **Photos:** signed direct-to-Cloudinary uploads, replace, remove, and the stored asset is destroyed when a garment is deleted
- **Fast capture:** quick add (camera on mobile), bulk add with limited concurrency, and a quick-sort screen. Colour is optional, so photo-only drafts show an "Unsorted" badge
- **Background removal:** optional, in the browser, with a before/after preview, edge cleanup, and transparency preserved end to end
- **Laundry:** a Clean / In laundry toggle, a laundry basket, and filter counts
- **Outfit board:** pick garments by category, get an automatic layout (top, bottom, shoes, bag, accessories), save with occasions, and export the board as a PNG
- **Wear log:** "Worn today" with undo, and a Recently worn list
- **What should I wear today?** picks a saved outfit whose pieces are all clean
- Automated tests (server and client) and CI

**Planned, roughly in build order**

- Travel packing: trips with a packing checklist, weather and pack-for-N-days guidance
- Wear statistics
- Deployment
- Inspiration board
- AI outfit suggestions
- Weather integration

## 🛠️ Tech Stack

### Frontend

| Tool | Version |
|---|---|
| React | 19.2 |
| Vite | 8.2 |
| TypeScript | 6.0 |
| Tailwind CSS | 4.3 |
| shadcn/ui | radix base, nova preset |
| React Router | 8.5 |
| cn | 0.5 (class merging) |
| oxlint | 1.77 |
| @imgly/background-removal | in-browser cutouts (AGPL-3.0) |

### Backend

| Tool | Version |
|---|---|
| Express | 5.2 |
| TypeScript | 7.0 |
| Prisma | 7.10 |
| PostgreSQL | 17 (via compose.yaml) |
| Zod | 4.4 |
| Argon2id | @node-rs/argon2 2.2 |
| JWT | jsonwebtoken 9.0 |
| Vitest + Supertest | server tests |

### Services

- Cloudinary: signed direct uploads (optional, see below)
- GitHub Actions: typecheck, server and client tests, build

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (developed on 24)
- PostgreSQL 14+ running locally, or a hosted connection string

### 1. Install

```bash
git clone <repo-url>
cd khzenty
npm run setup
```

`npm run setup` installs the root, `server/`, and `client/` packages. Installing from the repo root alone is not enough.

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Then edit `server/.env`:

- point `DATABASE_URL` at your database — `compose.yaml` publishes Postgres on port **5433**, so `docker compose up -d` is enough to match the example
- set `JWT_SECRET` to a generated value of at least 32 characters:
  ```bash
  node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
  ```

**Demo sandbox (optional).** Set `DEMO_LOGIN_ENABLED=true` in `server/.env` and run `npm run db:seed` to show a "Try the demo" button on the login page. Each click gives the visitor a **private, temporary copy** of the seeded `demo@khzenty.test` account (garments, outfits, trips, wear log) and signs them into it, so one visitor's changes are never seen by another. Copies share the template's photos by reference, cannot upload new ones (`403`), and are deleted after 24 hours; at most `DEMO_MAX_USERS` (default 200) exist at once, after which sign-in answers `503`. The template itself is never signed into; `npm run db:seed` is how you refresh it. It defaults to `false`, in which case `POST /api/auth/demo` returns `404`. Enable it only on a demo deployment.

The server validates its environment at boot and exits immediately with a specific message if anything is missing. There is deliberately no fallback `JWT_SECRET`.

**Cloudinary (optional).** Create a free account and an API key that is allowed to upload, then add the three `CLOUDINARY_*` values to `server/.env`. Without them the server still boots and the two upload endpoints return `503`. Never commit `.env`.

### 3. Create the schema and seed data

```bash
npm run db:migrate
npm run db:seed
```

The seed is idempotent and only touches its own accounts, so it is safe to re-run. It creates two users with this password:

| Email | Password |
|---|---|
| `demo@khzenty.test` | `khzenty-dev-password` |
| `second@khzenty.test` | `khzenty-dev-password` |

The second account exists so queries that forget to scope by `userId` fail visibly in development.

### 4. Run

```bash
npm run dev
```

| Service | URL |
|---|---|
| API | http://localhost:4000 |
| Web | http://localhost:5173 |

Verify with:

```bash
curl http://localhost:5173/api/health
```

That request goes through the Vite dev proxy to the API, so a JSON response confirms both services and the proxy are working.

**Background removal.** The first cutout downloads about 40 MB of model files, and the app asks for confirmation before it does. The model and WASM assets are fetched from IMG.LY's CDN at runtime.

## 🔐 API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Liveness check |
| POST | `/api/auth/register` | — | Create an account, returns `201` and signs in |
| POST | `/api/auth/login` | — | Sign in, sets the session cookie |
| POST | `/api/auth/logout` | — | Clears the cookie, `204` |
| POST | `/api/auth/demo` | — | Create a private demo copy of the seeded account and sign in as it; no credentials sent. `404` unless `DEMO_LOGIN_ENABLED=true`, `503` when the cap is reached; rate limited with login |
| GET | `/api/auth/demo` | — | `200 { enabled: true }` when demo login is on, `404` when off — lets the login page decide whether to show "Try the demo" |
| GET | `/api/auth/me` | cookie | The signed-in user |
| GET | `/api/items` | cookie | The user's garments, favourites first |
| POST | `/api/items` | cookie | Create a garment |
| GET | `/api/items/:id` | cookie | One garment, with its outfit count |
| PATCH | `/api/items/:id` | cookie | Update a garment |
| DELETE | `/api/items/:id` | cookie | Delete a garment, `204` |
| GET | `/api/taxonomy` | cookie | Garment types grouped by category, plus the board zones |
| POST | `/api/uploads/signature` | cookie | Short-lived signature for a direct browser upload |
| PUT | `/api/items/:id/image` | cookie | Attach an already-uploaded image to an item |
| DELETE | `/api/items/:id/image` | cookie | Detach the photo and delete the asset |
| PATCH | `/api/items/:id/laundry` | cookie | Set one garment's laundry status |
| POST | `/api/items/laundry/washed` | cookie | Mark a list of garments as washed |
| — | `/api/outfits` and `/api/outfits/:id` | cookie | Outfit CRUD: list, create, read, update, delete |
| POST | `/api/outfits/:id/wear` | cookie | Mark an outfit as worn; its clean pieces move to the laundry |
| POST | `/api/wear-log/:id/undo` | cookie | Undo a wearing and restore exactly the pieces it changed |
| GET | `/api/wear-log` | cookie | The 20 most recent wearings, newest first |
| GET | `/api/trips` | cookie | The user's trips, soonest first, with day count and packed/total entries |
| POST | `/api/trips` | cookie | Create a trip: `name`, `destination`, `startDate`, `endDate` (`YYYY-MM-DD`, max 60 days); optional `latitude`/`longitude` from a destination search |
| GET | `/api/trips/destinations?q=` | cookie | City suggestions with coordinates (server-side Open-Meteo geocoding) |
| GET | `/api/trips/:id` | cookie | One trip: entries with garment/outfit details and laundry status, plus per-category packing guidance |
| PATCH | `/api/trips/:id` | cookie | Update a trip; the destination is re-geocoded only if it changed |
| DELETE | `/api/trips/:id` | cookie | Delete a trip and its entries, `204` |
| GET | `/api/trips/:id/weather` | cookie | Per-day forecast, or `forecastAvailable: false` with a `reason` |
| POST | `/api/trips/:id/entries` | cookie | Add a garment or an outfit: exactly one of `clothingItemId` / `outfitId`; `409` if already listed |
| PATCH | `/api/trips/:id/entries/:entryId` | cookie | Set `{ packed: boolean }` |
| DELETE | `/api/trips/:id/entries/:entryId` | cookie | Remove an entry, `204` |
| PUT | `/api/trips/:id/category-counts/:category` | cookie | Set how many items of a category are packed outside the app: `{ count }`, integer 0–50; `0` clears it |

**Laundry status is manual** — `CLEAN` or `IN_LAUNDRY`, never inferred, since the app has no way to know a garment is in the wash. `laundryAt` records when the status last changed and only moves when it actually changes, so re-sending the same status doesn't restart the clock on how long something has been in the basket.

The bulk endpoint skips ids that aren't yours rather than rejecting the batch, and returns how many garments actually moved. Filtering on `IN_LAUNDRY` makes it idempotent: a second call matches nothing.

**Outfits.** Every outfit query is scoped by `userId`. An outfit can only contain the caller's own garments: one foreign id refuses the whole request with a `404` and nothing is saved. `itemIds` replaces the whole membership set, and `layout` is a validated, nullable `Json` column.

**Trips.** Scoped by `userId` like everything else; a foreign trip, garment or outfit is a `404`. A trip entry is a garment *or* an outfit (a database `CHECK` enforces exactly one), and the same one cannot be listed twice. Garments in the laundry can always be added — the UI flags them, the API never blocks. An outfit's garments count toward their categories, once each even if also added on their own.

**Weather** comes from Open-Meteo, called only by the server (no API key; the browser never contacts it). Forecasts reach about 16 days ahead; outside that window the endpoint answers `forecastAvailable: false` with `TOO_FAR_AHEAD` or `IN_THE_PAST` rather than inventing data. Results are cached in memory for 45 minutes (failures for 1 minute) and every upstream failure degrades to `SERVICE_UNAVAILABLE`, so the trip page works without it. Geocoding failures are `502`.

**Pack-for-N-days guidance** is the pure `recommendPackingCounts` in `packing-guidance.service.ts`; every number is in its `PACKING_RULES` object. Tops ≈ 1/day (max 7); bottoms 1 per 2.5 days (1–4); footwear 2 up to 5 days, else 3; underwear 1/day + 1 spare (max 8). With a forecast: outerwear 1 below 15°C minimum, 2 below 5°C, +1 if rain is likely (max 3); one warm accessory below 5°C. It is guidance only — nothing enforces it.

**Wearing an outfit** sets every piece that is currently `CLEAN` to `IN_LAUNDRY` in one transaction and records which ones it changed, so undo restores exactly those. Deleting an outfit also deletes its wear entries.

**Image upload is signed and direct.** The browser asks for a signature, uploads straight to Cloudinary, then posts back only the `publicId`. Image bytes never pass through this server, so there is no multipart handling and no upload bandwidth cost.

The signature covers `folder` and `allowed_formats`, so changing either client-side invalidates it — that is what confines a user to `khzenty/users/<their id>` and to formats we accept. Cloudinary's upload API has no signable max-size parameter, so size is enforced afterwards: the confirm step reads the asset's real byte count and format from Cloudinary, deletes anything that violates the limits, and only then records the URL. Nothing the client reports about the file is trusted.

Credentials are optional — without them the server still boots and these two endpoints return `503`.

**The API key must have the `create` (upload) action enabled.** A read-only key passes `cloudinary.api.ping()` but uploads fail with `403 missing permissions (actions=["create"])`, which looks like a signature problem and is not one.

**Writes take `type`, not `category`.** The server derives the category from the type, so `category: FOOTWEAR` with `type: JEANS` cannot be expressed — a category in the request body is ignored rather than trusted. `GET /api/taxonomy` exists so the client's type picker can only offer values the API accepts, instead of duplicating the taxonomy and drifting from it.

**Item routes are scoped by `userId`.** Updates and deletes filter on `{ id, userId }` and report a count of zero as `404`, so probing another user's item id reveals nothing about whether it exists.

The session is an httpOnly `SameSite=Lax` cookie, so JavaScript cannot read it and XSS cannot steal it. Clients must send requests with `credentials: 'include'`; see `client/src/lib/api.ts`.

Login returns the same `401 Invalid email or password` whether the email is unknown or the password is wrong, and verifies against a dummy hash when no user matches, so neither the message nor the response time reveals which emails are registered.

## 📜 Scripts

Run from the repo root:

| Script | Description |
|---|---|
| `npm run dev` | Start API and web together |
| `npm run dev:server` | Start API only |
| `npm run dev:client` | Start web only |
| `npm run build` | Build both packages |
| `npm run typecheck` | Typecheck both packages |
| `npm test` | Run both test suites (Vitest; Supertest on the server) |
| `npm run lint` | Lint both packages (oxlint) |
| `npm run setup` | Install dependencies in all three packages |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Load development data (idempotent) |
| `npm run db:studio` | Open Prisma Studio |

## 📁 Project Structure

```
khzenty/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # shared components
│   │   │   └── ui/             # shadcn/ui primitives (generated)
│   │   ├── features/           # per-feature modules
│   │   ├── hooks/
│   │   ├── lib/                # api client (cn() comes from the `cn` package)
│   │   ├── pages/
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css           # Tailwind entry + theme tokens
│   ├── components.json         # shadcn/ui config
│   └── vite.config.ts          # alias, dev proxy
│
├── server/                     # Express API
│   ├── prisma/schema.prisma
│   ├── tests/                  # Vitest + Supertest, kept out of the build
│   └── src/
│       ├── config/             # env validation, Prisma client
│       ├── routes/             # HTTP surface
│       ├── controllers/        # thin: request → service → response
│       ├── services/           # business logic
│       ├── middlewares/        # error handling
│       ├── lib/
│       ├── app.ts              # app assembly (no port binding)
│       └── server.ts           # port binding, graceful shutdown
│
└── docs/
    ├── PROJECT_CONTEXT.md      # what this is, and the decisions on record
    ├── TASKS.md                # done / in progress / next
    ├── ROADMAP.md              # phases, with the reasoning
    ├── ARCHITECTURE.md         # ERD and sequence diagrams
    ├── DECISIONS.md            # decision log: chosen, rejected, why
    └── IDEAS.md                # parking lot
```

## 🏛️ Architecture Notes

**Layering.** Requests flow route → controller → service. Controllers stay thin — they read the request, delegate, and shape the response. Business logic lives in services, which have no knowledge of `req`/`res`.

**Errors.** Services throw `HttpError` for failures the client may see. One error middleware turns anything thrown into a consistent JSON shape. Unexpected errors never leak their message; they return a generic `500`.

**Ownership.** Every item query takes a `userId` and applies it. `update` and `delete` go through `updateMany`/`deleteMany` filtered on `{ id, userId }` rather than reading the row and comparing, so a missing row and someone else's row are indistinguishable from outside. The seeded `second@khzenty.test` account exists to make a missed scope visible in development.

**Derived state.** A garment's `type` determines its `category`, but the database stores both as independent enum columns and cannot enforce the dependency. `server/src/lib/clothing-taxonomy.ts` is the single place that relationship lives, and writes derive `category` rather than accepting it. Both columns stay populated, so category filtering remains index-backed.

**Board zones.** The outfit board lays garments out by *zone*, not by category, using a separate total map over every garment type (`BOARD_ZONE_BY_TYPE`, served by `/api/taxonomy`). A category alone can't say where a sports top, a pair of socks or a bag belongs, and an unzoned type would silently drop off the board, so the map has to be total. The layout is a pure function (garments in, positions out) with its own unit tests; `object-contain` does the rest.

**Cutouts.** Background removal runs in the browser and is loaded lazily, so visitors who never use it don't download it. After removal the mask is eroded to remove the dark fringe, then trimmed and centred on a square canvas and exported with alpha intact. Cutouts deliberately bypass the JPEG compression step, because JPEG has no alpha channel and would flatten the garment back onto black. Garment photos are shown on one shared background token, never baked into the file.

**Configuration.** `server/src/config/env.ts` is the only place that reads `process.env`. It validates with Zod at boot, so a misconfiguration fails immediately and loudly rather than at the first request that needs the value.

**Testability.** `app.ts` builds the Express app without binding a port; `server.ts` owns the port and graceful shutdown. Tests can import the app directly.

**Styling.** Tailwind v4 is configured in CSS, not JavaScript — see the `@theme inline` block in `client/src/index.css`. There is no `tailwind.config.js`.

**Tests.** Vitest drives the real Express app in-process through Supertest — no port binding, which is why `app.ts` and `server.ts` are separate. They run against a separate database (`khzenty_test`), created and migrated automatically on first run; the setup refuses any database whose name doesn't end in `_test`, because the helpers truncate every table. Tests live in `server/tests/` so `npm run build` never compiles them into `dist`, and are typechecked via `tsconfig.scripts.json`. The client has its own suite for the pure logic: the board layout, the cutout geometry and mask, and the upload queue.

The suite deliberately targets the invariants that manual testing misses: per-user ownership scoping, and the derived category. Both were verified by mutation — removing `userId` from the service's `where` clauses fails 6 tests, and mis-mapping a garment type fails 3.

**CI.** GitHub Actions runs install, typecheck, the server tests (against a Postgres service container), the client tests, and the build on every push.

The full decision log, with what was chosen, what was rejected and why, is in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## 🗺️ Roadmap

- [x] **v1.0 — MVP:** accounts, wardrobe, photos, bulk add, cutouts, laundry, outfit board and PNG export, wear log, daily suggestion, tests, CI
- [ ] **v1.1:** travel packing lists, wear statistics, a lint step in CI
- [ ] **v1.2:** deployment, and changes driven by user research (for example a French and Arabic interface)
- [ ] **Later, to validate with users:** inspiration board, size profile, drag-and-drop board, AI outfit suggestions, weather integration

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for detail, [`docs/TASKS.md`](docs/TASKS.md) for what is next, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) / [`docs/DECISIONS.md`](docs/DECISIONS.md) for how it is put together and why.

## 📄 License

**AGPL-3.0-or-later** — see [`LICENSE`](LICENSE).

This was MIT until background removal was added. `@imgly/background-removal` is AGPL-3.0, and because it runs in the browser, shipping this app ships that library to every visitor — so the combined work is distributed under copyleft terms. Relicensing the project keeps that internally consistent rather than leaving an MIT declaration that the dependency contradicts.

If you want this under a permissive licence instead, you would need to drop background removal or replace it with a permissively licensed alternative. IMG.LY also offer other licensing terms on request.

### Third-party notices

| Dependency | Licence | Note |
|---|---|---|
| `@imgly/background-removal` | AGPL-3.0 | The reason this project is AGPL. Model and WASM assets are fetched at runtime from IMG.LY's CDN |
