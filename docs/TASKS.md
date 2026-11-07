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
| 4 — Outfit builder | `/api/outfits` CRUD scoped by `userId` (a client cannot attach another user's garment), auto-layout board, save with name and occasions, list/edit/delete, PNG export |
| Cross-cutting | Vitest + Supertest on a separate test database (114 server tests), 141 client tests on pure logic, GitHub Actions CI |

## In progress

Nothing is mid-change. The tree is clean and every suite passes.

One item is **finished in code but not verified**:

- **Background removal** — wired and tested, but the model has never actually
  run in a real browser, so cutout quality is unverified.

## Next

In the order the roadmap proposes:

1. **Phase 5 — Search and filters.** Filter by category, colour and season;
   text search; empty states. The laundry filter is the only one that exists,
   and it filters client-side — this phase is where that moves server-side,
   alongside pagination.
2. **Phase 6 — Occasion collections.** Grouping outfits by occasion; depends on
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
