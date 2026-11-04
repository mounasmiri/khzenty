# 👗 Khzenty

> Organize less. Decide faster. Dress better.

Khzenty is a modern wardrobe assistant that helps users organize their clothes, create outfits, and simplify daily outfit decisions.

Built as a portfolio project using a modern full-stack architecture and developed with production-quality practices.

---

## 📌 Status

**The wardrobe works end to end. Photos are next.**

Sign in and you can catalogue garments, browse them in a grid, and edit or delete them. Images are the one deliberate gap — the columns exist and are nullable, but nothing uploads yet, so tiles fall back to a type label.

---

## ✨ Features

**Built**

- Email and password accounts, with Argon2id hashing
- httpOnly cookie sessions and a protected-route wrapper
- Wardrobe data model: garments, outfits, and the join between them
- Garment CRUD, scoped per user, with the category derived from the type
- Season tagging, favourites (which sort to the top of the grid)
- Delete confirmation that names how many outfits the garment will leave

**Planned**, roughly in build order:

- Image upload
- Outfit creation
- Occasion collections
- Recently worn
- Packing assistant
- Inspiration board
- AI outfit suggestions
- Weather integration

---

## 🛠️ Tech Stack

### Frontend

| Tool | Version |
| --- | --- |
| React | 19.2 |
| Vite | 8.2 |
| TypeScript | 6.0 |
| Tailwind CSS | 4.3 |
| shadcn/ui | radix base, `nova` preset |
| React Router | 8.5 |
| `cn` | 0.5 (class merging) |
| oxlint | 1.77 |

### Backend

| Tool | Version |
| --- | --- |
| Express | 5.2 |
| TypeScript | 7.0 |
| Prisma | 7.10 |
| PostgreSQL | 17 (via `compose.yaml`) |
| Zod | 4.4 |
| Argon2id | `@node-rs/argon2` 2.2 |
| JWT | `jsonwebtoken` 9.0 |

### Services

- Cloudinary *(not yet configured)*

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** (developed on 24)
- **PostgreSQL 14+** running locally, or a hosted connection string

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

- point `DATABASE_URL` at your database — `compose.yaml` publishes Postgres on **port 5433**, so `docker compose up -d` is enough to match the example
- set `JWT_SECRET` to a generated value of at least 32 characters:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

The server validates its environment at boot and **exits immediately** with a specific message if anything is missing. There is deliberately no fallback `JWT_SECRET`.

### 3. Create the schema and seed data

```bash
npm run db:migrate
npm run db:seed
```

The seed is idempotent and only touches its own accounts, so it is safe to re-run. It creates two users with this password:

| Email | Password |
| --- | --- |
| `demo@khzenty.test` | `khzenty-dev-password` |
| `second@khzenty.test` | `khzenty-dev-password` |

The second account exists so queries that forget to scope by `userId` fail visibly in development.

### 4. Run

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| API | http://localhost:4000 |
| Web | http://localhost:5173 |

Verify with:

```bash
curl http://localhost:5173/api/health
```

That request goes through the Vite dev proxy to the API, so a JSON response confirms both services and the proxy are working.

---

## 🔐 API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Liveness check |
| `POST` | `/api/auth/register` | — | Create an account, returns `201` and signs in |
| `POST` | `/api/auth/login` | — | Sign in, sets the session cookie |
| `POST` | `/api/auth/logout` | — | Clears the cookie, `204` |
| `GET` | `/api/auth/me` | cookie | The signed-in user |
| `GET` | `/api/items` | cookie | The user's garments, favourites first |
| `POST` | `/api/items` | cookie | Create a garment |
| `GET` | `/api/items/:id` | cookie | One garment, with its outfit count |
| `PATCH` | `/api/items/:id` | cookie | Update a garment |
| `DELETE` | `/api/items/:id` | cookie | Delete a garment, `204` |
| `GET` | `/api/taxonomy` | cookie | Garment types grouped by category |
| `POST` | `/api/uploads/signature` | cookie | Short-lived signature for a direct browser upload |
| `PUT` | `/api/items/:id/image` | cookie | Attach an already-uploaded image to an item |

**Image upload is signed and direct.** The browser asks for a signature, uploads straight to Cloudinary, then posts back only the `publicId`. Image bytes never pass through this server, so there is no multipart handling and no upload bandwidth cost.

The signature covers `folder` and `allowed_formats`, so changing either client-side invalidates it — that is what confines a user to `khzenty/users/<their id>` and to formats we accept. Cloudinary's upload API has **no signable max-size parameter**, so size is enforced afterwards: the confirm step reads the asset's real byte count and format from Cloudinary, deletes anything that violates the limits, and only then records the URL. Nothing the client reports about the file is trusted.

Credentials are optional — without them the server still boots and these two endpoints return `503`.

The API key must have the **create (upload)** action enabled. A read-only key passes `cloudinary.api.ping()` but uploads fail with `403 missing permissions (actions=["create"])`, which looks like a signature problem and is not one.

**Writes take `type`, not `category`.** The server derives the category from the type, so `category: FOOTWEAR` with `type: JEANS` cannot be expressed — a `category` in the request body is ignored rather than trusted. `GET /api/taxonomy` exists so the client's type picker can only offer values the API accepts, instead of duplicating the taxonomy and drifting from it.

Item routes are scoped by `userId`. Updates and deletes filter on `{ id, userId }` and report a count of zero as `404`, so probing another user's item id reveals nothing about whether it exists.

The session is an **httpOnly `SameSite=Lax` cookie**, so JavaScript cannot read it and XSS cannot steal it. Clients must send requests with `credentials: 'include'`; see `client/src/lib/api.ts`.

Login returns the same `401 Invalid email or password` whether the email is unknown or the password is wrong, and verifies against a dummy hash when no user matches, so neither the message nor the response time reveals which emails are registered.

---

## 📜 Scripts

Run from the repo root:

| Script | Description |
| --- | --- |
| `npm run dev` | Start API and web together |
| `npm run dev:server` | Start API only |
| `npm run dev:client` | Start web only |
| `npm run build` | Build both packages |
| `npm run typecheck` | Typecheck both packages |
| `npm test` | Run the server test suite (Vitest + Supertest) |
| `npm run lint` | Lint both packages (oxlint) |
| `npm run setup` | Install dependencies in all three packages |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Load development data (idempotent) |
| `npm run db:studio` | Open Prisma Studio |

---

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
└── docs/                       # project context, roadmap, ideas
```

---

## 🏛️ Architecture Notes

**Layering.** Requests flow `route → controller → service`. Controllers stay thin — they read the request, delegate, and shape the response. Business logic lives in services, which have no knowledge of `req`/`res`.

**Errors.** Services throw `HttpError` for failures the client may see. One error middleware turns anything thrown into a consistent JSON shape. Unexpected errors never leak their message; they return a generic 500.

**Ownership.** Every item query takes a `userId` and applies it. `update` and `delete` go through `updateMany`/`deleteMany` filtered on `{ id, userId }` rather than reading the row and comparing, so a missing row and someone else's row are indistinguishable from outside. The seeded `second@khzenty.test` account exists to make a missed scope visible in development.

**Derived state.** A garment's `type` determines its `category`, but the database stores both as independent enum columns and cannot enforce the dependency. `server/src/lib/clothing-taxonomy.ts` is the single place that relationship lives, and writes derive `category` rather than accepting it. Both columns stay populated, so category filtering remains index-backed.

**Configuration.** `server/src/config/env.ts` is the only place that reads `process.env`. It validates with Zod at boot, so a misconfiguration fails immediately and loudly rather than at the first request that needs the value.

**Testability.** `app.ts` builds the Express app without binding a port; `server.ts` owns the port and graceful shutdown. Tests can import the app directly.

**Styling.** Tailwind v4 is configured in CSS, not JavaScript — see the `@theme inline` block in `client/src/index.css`. There is no `tailwind.config.js`.

**Tests.** Vitest drives the real Express app in-process through Supertest — no port binding, which is why `app.ts` and `server.ts` are separate. They run against a **separate database** (`khzenty_test`), created and migrated automatically on first run; the setup refuses any database whose name doesn't end in `_test`, because the helpers truncate every table. Tests live in `server/tests/` so `npm run build` never compiles them into `dist`, and are typechecked via `tsconfig.scripts.json`.

The suite deliberately targets the invariants that manual testing misses: per-user ownership scoping, and the derived `category`. Both were verified by mutation — removing `userId` from the service's where clauses fails 6 tests, and mis-mapping a garment type fails 3.

---

## 🗺️ Roadmap

- [x] Project setup
- [x] Database schema
- [x] Authentication
- [x] Clothing CRUD
- [ ] Image upload
- [ ] Outfit Builder
- [ ] Search & Filters
- [ ] Occasion Collections
- [ ] Packing Assistant
- [ ] AI Features

See [docs/ROADMAP.md](docs/ROADMAP.md) for detail.

---

## 📸 Screenshots

Coming soon.

---

## 📄 License

MIT
