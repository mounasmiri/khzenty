# 👗 Khzenty

> Organize less. Decide faster. Dress better.

Khzenty is a modern wardrobe assistant that helps users organize their clothes, create outfits, and simplify daily outfit decisions.

Built as a portfolio project using a modern full-stack architecture and developed with production-quality practices.

---

## 📌 Status

**Authentication works end to end. The wardrobe itself is next.**

Toolchain, database schema, and auth are built and verified. Signing in gets you a placeholder home screen — no clothing features exist yet.

---

## ✨ Features

**Built**

- Email and password accounts, with Argon2id hashing
- httpOnly cookie sessions and a protected-route wrapper
- Wardrobe data model: garments, outfits, and the join between them

**Planned**, roughly in build order:

- Digital wardrobe
- Clothing management
- Outfit creation
- Image upload
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
│   │   ├── lib/                # utils, incl. cn()
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

**Configuration.** `server/src/config/env.ts` is the only place that reads `process.env`. It validates with Zod at boot, so a misconfiguration fails immediately and loudly rather than at the first request that needs the value.

**Testability.** `app.ts` builds the Express app without binding a port; `server.ts` owns the port and graceful shutdown. Tests can import the app directly.

**Styling.** Tailwind v4 is configured in CSS, not JavaScript — see the `@theme inline` block in `client/src/index.css`. There is no `tailwind.config.js`.

---

## 🗺️ Roadmap

- [x] Project setup
- [x] Database schema
- [x] Authentication
- [ ] Clothing CRUD
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
