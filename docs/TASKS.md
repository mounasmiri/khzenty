# Tasks

> Required reading per `CLAUDE.md`, alongside `PROJECT_CONTEXT.md` and
> `ROADMAP.md`.
>
> `ROADMAP.md` is the plan and carries the reasoning. This file is the short
> answer to "what is done, what is in flight, what is next" — derived from it,
> so if the two disagree the roadmap wins and this file needs updating.

## Done

| Phase | Outcome |
| --- | --- |
| 0 — Project setup | Express 5 + Prisma 7 backend, Vite 8 + React 19 client, Tailwind v4, shadcn/ui, oxlint, one `npm run dev` for both |
| 1 — Database schema | `User`, `ClothingItem`, `Outfit`, `OutfitItem`; categories and types as enums; seed script |
| 2 — Authentication | Register/login/logout/`me`, Argon2id, httpOnly cookie session, protected React routes |
| 3 — Clothing CRUD | Item CRUD with server-derived `category`, wardrobe grid, item detail, `userId` scoping throughout |
| 3b — Images | Signed direct Cloudinary upload with server-side confirmation, remove photo, delete-on-remove, mobile quick/bulk capture, quick sort, optional in-browser background removal |
| Laundry | Manual `CLEAN`/`IN_LAUNDRY`, toggle, basket with bulk wash, wardrobe filter |
| Cross-cutting | Vitest + Supertest on a separate test database (60 server tests), 38 client tests on pure logic, GitHub Actions CI |

## In progress

Nothing is mid-change. The tree is clean and every suite passes.

Two items are **finished in code but not usable end to end**, which is a
different thing from in progress:

- **Image upload** — the signature is correct, but the configured Cloudinary API
  key lacks the `create` action, so a correct signature returns
  `403 missing permissions (actions=["create"])`. Needs a key with upload
  permission; no code change.
- **Background removal** — wired and tested, but the model has never actually
  run in a real browser, so cutout quality is unverified.

## Next

In the order the roadmap proposes:

1. **Phase 4 — Outfit builder.** The largest gap between the schema and the
   product: `Outfit` and `OutfitItem` exist and the item response already
   carries an outfit count, but there are no outfit endpoints and no UI. This is
   also the feature the app is named for.
2. **Phase 5 — Search and filters.** Filter by category, colour and season;
   text search; empty states. The laundry filter is the only one that exists,
   and it filters client-side — this phase is where that moves server-side,
   alongside pagination.
3. **Phase 6 — Occasion collections.** Grouping outfits by occasion; depends on
   Phase 4.

Deliberately not next: Phase 8 (AI) needs real usage data first, and Phase 7
(packing) depends on outfits.

## Open decisions

Carried from the roadmap, each of which shapes work before it starts:

- **Resize/transform on delivery** — Cloudinary can serve derived sizes; the
  grid currently loads full uploads.
- **Deployment target.** A cross-origin deployment needs `sameSite: 'none'`,
  `secure: true` and a fresh look at CSRF — see `server/src/lib/cookies.ts`.
- **Error monitoring** and an **accessibility pass**, both unscheduled.
