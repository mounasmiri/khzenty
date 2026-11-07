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
      `ClothingType` are enums; `color` is a nullable human-readable string
      (made nullable later, so a photo-only capture need not supply one)
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

---

## Phase 3b — Images

Split out of Phase 3: it needs Cloudinary credentials and is a self-contained
pipeline, so bundling it would have blocked the wardrobe on an external account.

- [x] Cloudinary upload pipeline — signed direct-to-Cloudinary
- [x] Format enforcement — `allowed_formats` is part of the signed payload
- [x] Size enforcement — checked after upload against the asset's real byte
      count, since the upload API has no signable max-size parameter
- [x] Delete on **replace** — superseded assets are destroyed
- [x] Delete on **item removal** — the asset is destroyed after the row is
      gone, best-effort: a Cloudinary outage orphans an image rather than
      blocking the delete
- [ ] Resize / transformation on delivery

**Settled:** signed direct upload, not a server-side proxy. Image bytes never
reach the API, so there is no multipart handling and no upload bandwidth cost.
The trade-off is that the client is involved in the flow, which is why the
confirm step re-reads format and size from Cloudinary rather than trusting
anything the client reports.

**Credentials are optional.** Requiring them would stop the server booting for
any clone without a Cloudinary account, including CI, so the endpoints return
503 while unconfigured and the rest of the wardrobe keeps working.

- [x] Upload UI — pick a photo in the add/edit form, with a local preview,
      staged progress, and error messages. The grid and detail view show the
      image, falling back to the type label.
- [x] Remove photo — `DELETE /api/items/:id/image`, offered in the edit form
      and on the detail page behind a confirmation
- [x] Mobile-first capture — quick add (camera on mobile), bulk add (3
      concurrent uploads, per-file progress and retry), and a quick-sort screen
      for assigning types afterwards. Photos are resized to 1200px in the
      browser first.

**Drafts have no colour at all.** `ClothingItem.color` is nullable, so a
photo-only garment simply omits it and the UI shows an Unsorted badge. This
replaced an earlier sentinel string that wrote a non-colour into the colour
column.

- [x] Background removal — optional and in-browser via
      `@imgly/background-removal` (`isnet_quint8`), with a before/after
      preview, trim-to-garment, centring on a square and a WebP export with
      alpha. Opt-in in bulk add, processed one photo at a time. Any failure
      keeps the original photo
- [x] One shared `--garment-surface` token behind a `GarmentImage` component,
      so no background is ever baked into a file

**Background removal is AGPL-3.0**, which is why the project relicensed. The
library is imported dynamically: a static import pulled it and the ONNX Runtime
into the main bundle, making every visitor pay for a feature most never use.
`dist` grows to ~25 MB (the ONNX Runtime wasm), all of it fetched only on first
use, and the ~40 MB model comes from IMG.LY's CDN on top of that.

**Create saves before uploading.** The confirm endpoint addresses an item by id,
which does not exist until the item is created, so the form saves first and then
attaches the photo. That makes "saved, but the photo failed" a real state, and
the form reports it as such with a retry rather than pretending the garment was
lost.

---

## Phase 4 — Outfit builder ✅

- [x] Create an outfit from selected items (clean garments only)
- [x] Outfit list, open and edit
- [x] Delete
- [x] Selection UI with an auto-layout board (`computeBoardLayout`)
- [x] Export the board as a PNG
- [x] `WATCH` type and a board-zone map for every garment type
- [ ] Drag-and-drop repositioning (layouts are auto-computed and stored)

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

- [x] Testing strategy — Vitest + Supertest against a separate `khzenty_test`
      database, covering ownership scoping and category derivation. Verified by
      mutation, not just by passing.
- [x] CI pipeline — GitHub Actions: install, typecheck, test, build, with a
      Postgres service container
- [ ] Extend coverage beyond the current suites: auth endpoints, outfits, and
      the client beyond pure logic — there are 38 client tests, but they cover
      geometry and queueing only, with no component or end-to-end tests
- [ ] Deployment target and process

  **Before any public deploy:** resolve the AGPL / source-availability question
  for the background-removal library, and self-host the model files.

  Both are consequences of `@imgly/background-removal` being AGPL-3.0. The
  project relicensed to match (`d671f3a`), but AGPL §13 attaches obligations to
  *conveying* the work over a network, so a public deploy needs a decided
  answer on offering corresponding source — not just a matching licence file.
  The model and WASM currently come from IMG.LY's CDN at runtime, which makes a
  third party a hard dependency of the feature; self-hosting them removes that
  and is what IMG.LY themselves advise for production.

- [ ] Error monitoring
- [ ] Accessibility pass
