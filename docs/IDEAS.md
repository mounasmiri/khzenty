# Ideas

> **Draft.** A parking lot — nothing here is committed work. Items graduate to
> `ROADMAP.md` when they are actually scoped.

## Product

- **Recently worn** — track wear dates to surface neglected clothes. Probably
  the highest-value idea here: it directly attacks "I forgot I owned this".
- **Inspiration board** — save reference images alongside owned items.
- **Cost per wear** — divide purchase price by wear count. Cheap to build once
  wear tracking exists, and unusually motivating.
- **Capsule wardrobe mode** — pick N items, see how many outfits they yield.
- **Laundry state** — mark items unavailable so suggestions skip them.
- **Seasonal archive** — hide off-season clothes without deleting them.

## Technical

- **Background removal on upload** — makes the wardrobe grid look consistent.
  Cloudinary can do this server-side.
- **Colour extraction** — derive a palette from the image instead of asking the
  user to tag colours by hand.
- **Optimistic UI** for item creation, so capture feels instant.
- **Offline capture** — queue uploads taken without signal.
- **Shared types package** — if client/server type drift becomes painful, a
  `shared/` package is the fix. Not worth it yet.

## Deliberately rejected

Kept here so they don't get re-proposed:

- **Social feed / following.** Turns a personal tool into a comparison engine.
- **Marketplace / resale.** Different product entirely.
- **Automatic outfit generation without user input.** Suggestions people did
  not ask for read as noise. Needs wear data first.
