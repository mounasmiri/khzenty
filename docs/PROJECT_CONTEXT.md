# Project Context

> `CLAUDE.md` requires this file be read before any change, so it has to match
> reality or it misleads every change that follows. Keep **Current state** in
> step with the code; see `TASKS.md` for what is in flight.

## What Khzenty is

A wardrobe assistant. Users photograph and catalogue the clothes they own,
combine them into outfits, and get help deciding what to wear.

The problem it solves is not storage — it is **decision fatigue**. People own
more than they can recall, so they wear a fraction of it. Khzenty's value is
making an existing wardrobe visible and reusable.

## What it is not

- Not a shopping app. No storefront, no recommendations to buy.
- Not a social network. No feeds or following in the current scope.
- Not an inventory system. Precision matters less than speed of capture.

## Goals

1. **Portfolio quality.** The code is the deliverable as much as the product.
   Architecture, naming, and error handling are judged.
2. **Production practices at small scale.** Validated configuration, layered
   backend, typed end to end, no secrets in the repo.
3. **Shippable increments.** Every phase leaves the app running.

## Non-goals for v0.1

Deliberately deferred so scope stays honest:

- Multi-user sharing or collaboration
- Mobile apps (responsive web only)
- Offline support
- Real-time sync between devices

## Constraints

- **TypeScript everywhere.** No plain JavaScript source files.
- **Thin controllers.** Business logic belongs in services.
- **Reusable components.** UI built from composable pieces.
- **No speculative features.** Build what the current phase asks for.
- **Readability over cleverness.**

## Architecture decisions on record

| Decision | Choice | Why |
| --- | --- | --- |
| Repo shape | Two packages + thin root | Isolated `node_modules` keeps Prisma predictable; root script runs both |
| Backend modules | ESM + NodeNext | Matches frontend and modern Node; costs `.js` import extensions |
| Tailwind | v4, CSS-first | Current major; no `tailwind.config.js` |
| shadcn base | `radix` | Classic shadcn/ui, best documented |
| Prisma models | None until needed | Data model designed with the feature that uses it |
| Prisma driver | `@prisma/adapter-pg` | Required in v7 — the Rust query engine was removed |
| Server watch | `node --watch --import tsx` | `tsx watch` silently fails to start under `concurrently` |
| Garment photo surface | One `--garment-surface` token, via a shared `GarmentImage` | Cutouts are stored transparent with no colour baked in, so a single token decides what shows through everywhere |
| Sessions | httpOnly `SameSite=Lax` cookie, not a token in `localStorage` | JavaScript cannot read it, so XSS cannot steal a session |
| Password hashing | Argon2id via `@node-rs/argon2` | OWASP's current recommendation, with prebuilt binaries so no node-gyp on Windows |
| `category` | Derived server-side from `type`, never accepted from a client | Makes a mismatched pair unrepresentable rather than merely rejected |
| Image upload | Signed direct browser→Cloudinary, confirmed server-side | Image bytes never reach the API; the confirm step re-reads real format and size rather than trusting the client |
| Cloudinary credentials | Optional | Requiring them would stop the server booting for any clone without an account, including CI |
| Laundry status | Enum, set manually | The app cannot know a garment is in the wash; an enum leaves room for DRYING or NEEDS_REPAIR |
| Background removal | `@imgly/background-removal`, in-browser, opt-in, lazily imported | AGPL-3.0 — the reason this project is AGPL. A static import put it and ONNX Runtime in the main bundle for every visitor |
| Project licence | AGPL-3.0-or-later | Forced by the background-removal dependency; see README |
| Tests | Vitest + Supertest against a separate `khzenty_test` database | Lets the suite truncate freely; setup refuses any name not ending in `_test` |

## Current state

A working single-user wardrobe: sign in, catalogue garments with photos, mark
things as in the wash. Outfits — the feature the name promises — are **not**
built yet.

### Built

- **Auth.** Register, login, logout and `/me`. Argon2id hashing, session in an
  httpOnly cookie, `requireAuth` re-reading the user on every request so a
  deleted account stops working immediately. Protected routes in React.
- **Wardrobe CRUD.** Garments with a type, a derived category, optional name and
  colour, seasons and a favourite flag. Every query scoped by `userId`; a
  cross-user probe returns the same 404 as a nonexistent id.
- **Images.** Signed direct browser→Cloudinary upload, confirmed server-side
  against the asset's real format and byte count. Replacing or deleting a
  garment destroys the superseded asset best-effort, so an outage orphans an
  image rather than blocking the operation.
- **Mobile capture.** Quick add (rear camera), bulk add (three concurrent
  uploads, per-file progress and retry), and a quick-sort screen for assigning
  types afterwards. Photos resized to 1200px in the browser first.
- **Background removal.** Optional, in-browser, never automatic. Before/after
  preview, trim to the garment, centre on a square, export WebP with alpha.
  Falls back to the original photo on any failure.
- **Laundry.** Manual `CLEAN`/`IN_LAUNDRY` status, a toggle on the card and
  detail page, a basket page with bulk mark-as-washed, and a wardrobe filter.
- **Tests and CI.** 60 server tests (Vitest + Supertest, separate database) and
  38 client tests (pure logic only). GitHub Actions runs install, typecheck,
  test and build against a Postgres service container.

### Not built

- **Outfits.** `Outfit` and `OutfitItem` exist in the schema and the item
  response carries an outfit count, but there are **no outfit endpoints and no
  UI**. The mounted routers are `/health`, `/auth`, `/items`, `/taxonomy` and
  `/uploads`.
- Search and filtering beyond the laundry filter; occasion collections; packing
  assistant; anything AI.

### Known gaps worth knowing before changing things

- **Uploads are blocked in practice.** The signature is correct, but the
  configured Cloudinary key lacks the `create` action, so a correct signature
  returns `403 missing permissions`. No code change needed.
- No pagination: `listItems` returns the whole wardrobe.
- No refresh tokens, and nothing revokes a session before its 7-day expiry.
- Client tests cover pure logic only — no component or end-to-end tests.
- The cutout quality has never been verified in a real browser.

## Glossary

- **Item** — a single piece of clothing.
- **Outfit** — a named combination of items.
- **Collection** — a grouping of outfits or items, usually by occasion.
