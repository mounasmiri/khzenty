# Decision log

Built from the commit history. Each entry records what was chosen, what was
rejected, and why — the rejected option matters most, because it is the part
that is invisible in the finished code.

Ordered roughly chronologically. Commit hashes are the authority; where a later
decision reversed an earlier one, both are kept.

---

## 1. Two packages plus a thin root, not a monorepo

`57ca6e2`

**Chosen:** `server/` and `client/` installed independently, with a root
`package.json` holding only orchestration scripts.

**Rejected:** npm workspaces with hoisted dependencies, and a shared `types`
package.

**Why:** hoisting makes Prisma's generated client and native binaries harder to
reason about. A shared types package is the right answer once client/server
drift becomes painful; it was not yet.

---

## 2. ESM + NodeNext on the server

`57ca6e2`

**Chosen:** `"type": "module"` with `moduleResolution: NodeNext`.

**Rejected:** CommonJS.

**Why:** matches the frontend and modern Node. The cost is real and visible —
every relative import carries a `.js` extension even in TypeScript files — but
it is paid once.

---

## 3. `node --watch --import tsx`, not `tsx watch`

`57ca6e2`

**Chosen:** Node's built-in watcher with tsx as a loader.

**Rejected:** `tsx watch`.

**Why:** not a preference. `tsx watch` silently failed to start under
`concurrently` — no output, no error, no bound port — so `npm run dev` appeared
to work while the API never came up.

---

## 4. Sessions in an httpOnly cookie, not a token in `localStorage`

`2b4b8f2`

**Chosen:** JWT in an httpOnly, `SameSite=Lax` cookie. Cookie expiry derived
from the token's own `exp` claim.

**Rejected:** returning the token in the response body for the client to store;
and in-memory-only storage.

**Why:** JavaScript cannot read an httpOnly cookie, so XSS cannot steal the
session. The Vite proxy keeps development same-origin, which is what makes
`Lax` sufficient without separate CSRF tokens. In-memory storage would log the
user out on every refresh, and fixing that needs refresh tokens.

**Still open:** a cross-origin deployment needs `sameSite: 'none'` plus
`secure: true`, and CSRF has to be revisited at that point.

---

## 5. Argon2id via `@node-rs/argon2`

`2b4b8f2`

**Chosen:** `@node-rs/argon2` at OWASP parameters (19 MiB, t=2, p=1).

**Rejected:** `bcryptjs` (pure JS, slower, silently truncates past 72 bytes);
the node-gyp `argon2` and `bcrypt` packages.

**Why:** Argon2id is the current recommendation, and the Rust build ships
prebuilt binaries — no node-gyp, no Visual Studio Build Tools, which had
already been a friction point on this machine.

---

## 6. Identical 401 for unknown email and wrong password

`2b4b8f2`

**Chosen:** one message, and a verify against a dummy digest when no user
matches.

**Rejected:** distinguishing the two, which is friendlier.

**Why:** distinguishing them turns login into an account-enumeration oracle —
by message *and* by response time, hence the dummy hash.

---

## 7. `category` derived from `type`, never accepted from a client

`0fe98c6`

**Chosen:** writes take `type` only; the server looks `category` up in a total
`Record<ClothingType, ClothingCategory>`.

**Rejected:** accepting both and validating the pair; and a `ClothingType`
lookup table in the database.

**Why:** deriving makes a mismatched pair — `category: FOOTWEAR` with
`type: JEANS` — *unrepresentable* rather than merely rejected. Typing the map as
a total `Record` means adding a type without mapping it fails to compile. A
lookup table would be more normalised but needs seed data and a join for the
commonest read.

**Consequence:** exposed a gap — `ClothingType.OTHER` had no matching category,
making the map impossible to complete. `ClothingCategory.OTHER` was added in its
own migration.

---

## 8. 404, not 403, for another user's item

`0fe98c6`

**Chosen:** `updateMany`/`deleteMany` filtered on `{ id, userId }`; a count of
zero becomes 404.

**Rejected:** read-then-compare-then-write, and returning 403.

**Why:** a 403 confirms the id exists. The same 404 as a nonexistent id reveals
nothing. Putting the scope inside the write also removes the window between
checking and changing.

---

## 9. Separate test database, and tests outside `src/`

`a61cedc`

**Chosen:** a `khzenty_test` database created and migrated by the suite, which
refuses any database whose name does not end in `_test`. Tests live in
`server/tests/`.

**Rejected:** sharing the development database; a transaction-rollback strategy;
colocating tests in `src/`.

**Why:** the helpers truncate every table, so the guard is load-bearing.
Colocated tests would be compiled into `dist` by the build.

---

## 10. Signed direct-to-Cloudinary upload, not a server proxy

`037ab81`

**Chosen:** the browser asks for a signature, uploads straight to Cloudinary,
then posts back only the `publicId`, which the server verifies.

**Rejected:** proxying the upload through the API with multer.

**Why:** image bytes never touch the server — no multipart handling, no upload
bandwidth. The trade-off is that the client takes part, which is exactly why the
confirm step re-reads format and byte count from Cloudinary instead of trusting
anything reported.

**Limit discovered:** the upload API has no signable max-size parameter, so size
can only be enforced *after* upload, against the asset's real byte count.

---

## 11. Cloudinary credentials optional

`037ab81`

**Chosen:** the three credentials are optional; the endpoints return 503 while
unconfigured.

**Rejected:** requiring them in the env schema alongside `DATABASE_URL` and
`JWT_SECRET`.

**Why:** requiring them would stop the server booting for any clone without a
Cloudinary account — including CI. The wardrobe works without images.

**Side effect:** forced a fix to `HttpError`, which hardcoded `expose` to
`status < 500`, so a deliberate, client-safe 503 came back as "Internal Server
Error".

---

## 12. Delete the asset *after* the database write

`cebfbf5`, `f43f5db`

**Chosen:** clear the row or columns first, then destroy the Cloudinary asset
best-effort, swallowing failures.

**Rejected:** destroying first, or failing the request when Cloudinary does.

**Why:** the database is the source of truth. An outage should orphan an image,
not make a garment undeletable or leave a photo stuck on it.

---

## 13. `object-contain`, not `object-cover`

`41016df`

**Chosen:** letterbox the whole garment on a fixed 4:5 tile.

**Rejected:** `object-cover`, which fills the tile.

**Why:** filling crops — it was cutting the toes off shoes and the hems off
trousers. Garment photos arrive at every aspect ratio, so filling a fixed tile
always loses something.

---

## 14. Nullable `color`, replacing a sentinel string

`9cf12ed`

**Chosen:** `ClothingItem.color` nullable; an "Unsorted" badge in the UI.

**Rejected:** the previous approach — creating photo-only drafts with the
literal colour `"Unsorted"`.

**Why:** colour was required while `name` was optional, the same capture
friction. The sentinel put a non-colour into the colour column, which would have
polluted colour filtering later. The migration drops `NOT NULL` and converts the
sentinel to `NULL`.

---

## 15. `LaundryStatus` enum, not a boolean

`58d7ff9`

**Chosen:** an enum with `CLEAN` and `IN_LAUNDRY`, plus a nullable `laundryAt`.

**Rejected:** `inLaundry Boolean`.

**Why:** being in the wash is one of several ways a garment can be unavailable.
Adding `DRYING` or `NEEDS_REPAIR` is then a migration rather than a redesign.
`laundryAt` moves only when the status actually changes, so re-sending the same
status does not restart the clock.

---

## 16. Bulk wash skips foreign ids rather than rejecting

`58d7ff9`

**Chosen:** ownership enforced by the `userId` in the filter; ids belonging to
someone else are silently skipped and the response reports how many rows moved.

**Rejected:** 404ing the whole batch if any id is not yours.

**Why:** a bulk action should do what it legitimately can. Note this is the
*opposite* of decision 8 — deliberately, because the failure mode differs: a
single-item request has one answer, a batch has many.

---

## 17. Relicense to AGPL-3.0-or-later

`d671f3a`

**Chosen:** change the project licence to match its dependency.

**Rejected:** keeping MIT and documenting the conflict; dropping background
removal; a permissively licensed alternative.

**Why:** `@imgly/background-removal` is AGPL-3.0 and runs in the browser, so
shipping the app ships the library to every visitor. Declaring MIT while
depending on AGPL code is an inconsistency in a public repo. IMG.LY offer other
terms on request.

---

## 18. `isnet_quint8`, the 40 MB model

`4c79ede`

**Chosen:** the small quantised model.

**Rejected:** `isnet_fp16`, the library default at ~80 MB.

**Why:** halving the download matters most on the mobile capture path this
exists for. Its occasional edge artifacts are acceptable because the cutout is
optional and always previewed before being accepted.

---

## 19. Background removal opt-in, lazily imported, with consent

`4c79ede`, `a6eb10e`

**Chosen:** never automatic; a dynamic `import()`; a one-time confirmation
before the first download, remembered in `localStorage`.

**Rejected:** running it automatically on every photo; a static import; a toast
instead of a confirmation.

**Why:** a static import pulled the library and the ONNX Runtime into the main
bundle (486 kB), so every visitor paid for a feature most never use. A 40 MB
download on a phone should be agreed to, not discovered.

---

## 20. Transparent cutouts on one surface token

`b492f32`, `5a1f65f`, `a6eb10e`

**Chosen:** store cutouts with real alpha and never bake a background in. One
`--garment-surface` token behind a shared `GarmentImage`. WebP with a PNG
fallback.

**Rejected:** compositing the garment onto a background before upload; JPEG as
the fallback encoding.

**Why:** with no colour baked in, restyling every garment is a token change
rather than a re-upload. JPEG has no alpha, so that fallback would have
flattened the garment onto black — baking in exactly the background just
removed.

**Follow-up:** the surface then had to be softened from 0.985 to 0.965, with a
faint alpha-following drop shadow, because a white shirt on a near-white tile is
an invisible silhouette.

---

## 21. Sequential queue for removal, concurrency 3 for uploads

`4c79ede`

**Chosen:** one app-wide queue running background removal strictly one at a
time; uploads keep a concurrency limit of 3, dropping to 1 while removal is on.

**Rejected:** reusing the upload concurrency limiter for removal.

**Why:** the model saturates the CPU and holds a lot of memory, so two at once
is slower than two in sequence and risks exhausting memory on a phone. A wider
limit during removal would only queue uploads behind the model and muddle
per-row progress.

---

## 22. Adopt the `cn` package rather than patch generated components

`390d519`

**Chosen:** point `components.json`'s `utils` alias at the `cn` package.

**Rejected:** keeping `@/lib/utils` and rewriting the import in every
`shadcn add` output.

**Why:** shadcn's registry now emits `import { cn } from "cn"`. Keeping the old
alias meant hand-editing generated code after every component add — a recurring
tax, and generated code should not be hand-edited. Verified behaviour-identical
to `twMerge(clsx(...))` across seven cases, including conflict resolution.

---

## Rejected outright, and why

Options considered and dropped without a commit, recorded so they are not
re-proposed:

- **Social feed / following** — turns a personal tool into a comparison engine.
- **Marketplace or resale** — a different product.
- **Automatic outfit suggestions** — suggestions nobody asked for read as noise;
  this needs wear data first.
- **`lastWornAt` as a single timestamp** — cannot support a wear count, so "cost
  per wear" would be impossible. Needs a `WearEvent` model, which has not been
  designed.
- **`COOP`/`COEP` headers** for `SharedArrayBuffer` — `require-corp` would block
  cross-origin Cloudinary images. Background removal runs without them, just
  slower.
