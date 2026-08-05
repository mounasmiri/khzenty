# Roadmap

> **Draft.** Sequence and scope are proposals — reorder to taste.

Each phase must leave the app in a running, demonstrable state.

---

## Phase 0 — Project setup ✅

Toolchain, folder structure, database layer, styling pipeline.

- [x] Backend scaffold (Express 5, TypeScript, layered structure)
- [x] Environment validation with Zod, fails at boot
- [x] Error handling middleware and `HttpError`
- [x] Graceful shutdown
- [x] Prisma 7 configured with the `pg` driver adapter
- [x] Frontend scaffold (Vite 8, React 19, TypeScript)
- [x] Path alias `@/*` in TypeScript and Vite
- [x] Dev proxy `/api` → API
- [x] Tailwind v4 + shadcn/ui
- [x] Root `npm run dev` runs both services
- [x] oxlint in both packages, `npm run lint` at the root
- [x] README and docs

---

## Phase 1 — Database schema

The first real data model. Nothing exists yet, so this unblocks everything.

- [ ] Design `User`, `Item`, `Outfit`, and the outfit↔item relation
- [ ] Decide category and colour representation (enum vs lookup table)
- [ ] First migration
- [ ] Seed script with sample data for development

**Open question:** are categories a fixed enum, or user-definable? This affects
every later query and filter.

---

## Phase 2 — Authentication

- [ ] Registration and login endpoints
- [ ] Password hashing (argon2 or bcrypt)
- [ ] JWT issuing and verification middleware
- [ ] Token storage strategy on the client
- [ ] Protected route wrapper in React

**Open question:** JWT in `localStorage` is simple but XSS-exposed; httpOnly
cookies are safer but need CSRF handling. Decide before building.

---

## Phase 3 — Clothing CRUD

- [ ] Create, read, update, delete items
- [ ] Cloudinary upload pipeline
- [ ] Image handling: resize, format, delete-on-remove
- [ ] Wardrobe grid UI
- [ ] Item detail view

---

## Phase 4 — Outfit builder

- [ ] Create an outfit from selected items
- [ ] Outfit list and detail views
- [ ] Edit and delete
- [ ] Drag-and-drop or selection UI

---

## Phase 5 — Search and filters

- [ ] Filter by category, colour, season
- [ ] Text search
- [ ] Sensible empty states

---

## Phase 6 — Occasion collections

- [ ] Group outfits by occasion
- [ ] Collection CRUD

---

## Phase 7 — Packing assistant

- [ ] Build a packing list from outfits
- [ ] Trip length and destination inputs

---

## Phase 8 — AI features

- [ ] Outfit suggestions
- [ ] Weather integration

**Note:** this phase needs its own design pass. Defer until real usage data
exists — suggestions built on assumptions tend to be wrong.

---

## Cross-cutting, not yet scheduled

These are real work with no natural home in the sequence above:

- [ ] Testing strategy — none configured yet
- [ ] CI pipeline
- [ ] Deployment target and process
- [ ] Error monitoring
- [ ] Accessibility pass
