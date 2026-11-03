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

## Phase 1 — Database schema ✅

The first real data model, and the thing every later phase builds on.

- [x] Design `User`, `ClothingItem`, `Outfit`, and the `OutfitItem` join
- [x] Decide category and colour representation — `ClothingCategory` and
      `ClothingType` are enums; `color` is a human-readable string
- [x] First migration
- [x] Seed script with sample data for development

**Settled:** categories are a fixed enum, not user-definable.

**Carried forward:** a garment's `type` implies its `category`, but the database
cannot enforce the pairing. The service layer needs a validation map when item
creation is built in Phase 3.

---

## Phase 2 — Authentication ✅

- [x] Registration and login endpoints
- [x] Password hashing — Argon2id via `@node-rs/argon2`
- [x] JWT issuing and verification middleware
- [x] Token storage strategy on the client
- [x] Protected route wrapper in React

**Settled:** the session is an httpOnly, `SameSite=Lax` cookie, not a token in
`localStorage`. JavaScript cannot read it, so XSS cannot steal a session. The
Vite proxy keeps dev requests same-origin, which is what makes `Lax` sufficient
without separate CSRF tokens.

**Carried forward:**

- No refresh tokens. The session is a single 7-day access token, so there is no
  silent renewal — when it expires the user signs in again.
- A cross-origin production deployment would need `sameSite: 'none'` plus
  `secure: true`, and at that point CSRF needs revisiting. See
  `server/src/lib/cookies.ts`.
- Nothing revokes a token before it expires. Logout clears the cookie, but the
  token stays valid until `exp`. `requireAuth` re-reads the user on every
  request, so deleted accounts stop working immediately.

---

## Phase 3 — Clothing CRUD ✅

- [x] Create, read, update, delete items
- [x] Wardrobe grid UI
- [x] Item detail view

**Settled:** the write API accepts `type` only and the server derives
`category` from it via `CATEGORY_BY_TYPE` in
`server/src/lib/clothing-taxonomy.ts`. A mismatched pair — `category: FOOTWEAR`
with `type: JEANS` — is therefore unrepresentable rather than merely rejected,
and a `category` sent by a client is ignored. The map is typed as a total
`Record<ClothingType, ClothingCategory>`, so adding a type without mapping it
fails to compile.

This also exposed a Phase 1 gap: `ClothingType.OTHER` had no matching category,
which made the map impossible to complete. `ClothingCategory.OTHER` was added
in its own migration.

**Ownership:** every item query is scoped by `userId`. `update` and `delete` use
`updateMany`/`deleteMany` filtered on `{ id, userId }`, and a count of zero
becomes a 404 — so probing another user's item id reveals nothing about whether
it exists.

**Carried forward:**

- No pagination. `listItems` returns the user's whole wardrobe, which is fine at
  current scale; revisit alongside Phase 5 filters.
- The grid and detail view render without images, since none exist yet — tiles
  fall back to a type label.

---

## Phase 3b — Images

Split out of Phase 3: it needs Cloudinary credentials and is a self-contained
pipeline, so bundling it would have blocked the wardrobe on an external account.

- [ ] Cloudinary upload pipeline
- [ ] Image handling: resize, format, delete-on-remove

The columns already exist and are nullable: `ClothingItem.imageUrl` and
`imagePublicId`. `imagePublicId` is the handle Cloudinary needs to delete an
asset — without writing it, removing a garment leaks its image.

**Open question:** signed direct-to-Cloudinary upload (no image bytes touch our
server, but more moving parts) versus a server-side proxy upload (simpler, all
validation server-side, but every image flows through the API).

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
