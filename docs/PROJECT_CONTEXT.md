# Project Context

> **Draft.** Written from the initial project brief plus what now exists in the
> repo. `CLAUDE.md` requires this file be read before any change, so it shapes
> all future work — review and edit it to match your intent.

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

## Current state

Scaffolding only. `GET /api/health` is the sole route, and exists to prove the
server boots and the error middleware is wired. No models, no auth, no
features.

## Glossary

- **Item** — a single piece of clothing.
- **Outfit** — a named combination of items.
- **Collection** — a grouping of outfits or items, usually by occasion.
