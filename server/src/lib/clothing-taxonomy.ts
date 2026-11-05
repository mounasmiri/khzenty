import { ClothingCategory, ClothingType } from '../generated/prisma/enums.js';

/**
 * The category each garment type belongs to.
 *
 * A type determines its category (JEANS is always a BOTTOM), but the database
 * cannot express that dependency — both are plain enum columns. This map is the
 * single place the relationship lives, and callers derive `category` from
 * `type` rather than accepting both, so a mismatched pair is unrepresentable.
 *
 * Typed as a total `Record`, so adding a `ClothingType` without mapping it is a
 * compile error rather than a runtime surprise.
 */
export const CATEGORY_BY_TYPE: Record<ClothingType, ClothingCategory> = {
  // TOP
  [ClothingType.TSHIRT]: ClothingCategory.TOP,
  [ClothingType.SHIRT]: ClothingCategory.TOP,
  [ClothingType.BLOUSE]: ClothingCategory.TOP,
  [ClothingType.SWEATER]: ClothingCategory.TOP,
  [ClothingType.HOODIE]: ClothingCategory.TOP,
  [ClothingType.CARDIGAN]: ClothingCategory.TOP,
  [ClothingType.TANK_TOP]: ClothingCategory.TOP,

  // BOTTOM
  [ClothingType.JEANS]: ClothingCategory.BOTTOM,
  [ClothingType.TROUSERS]: ClothingCategory.BOTTOM,
  [ClothingType.SHORTS]: ClothingCategory.BOTTOM,
  [ClothingType.SKIRT]: ClothingCategory.BOTTOM,
  [ClothingType.LEGGINGS]: ClothingCategory.BOTTOM,

  // DRESS
  [ClothingType.DRESS]: ClothingCategory.DRESS,
  [ClothingType.JUMPSUIT]: ClothingCategory.DRESS,

  // OUTERWEAR
  [ClothingType.JACKET]: ClothingCategory.OUTERWEAR,
  [ClothingType.COAT]: ClothingCategory.OUTERWEAR,
  [ClothingType.BLAZER]: ClothingCategory.OUTERWEAR,
  [ClothingType.VEST]: ClothingCategory.OUTERWEAR,

  // FOOTWEAR
  [ClothingType.SNEAKERS]: ClothingCategory.FOOTWEAR,
  [ClothingType.BOOTS]: ClothingCategory.FOOTWEAR,
  [ClothingType.SANDALS]: ClothingCategory.FOOTWEAR,
  [ClothingType.HEELS]: ClothingCategory.FOOTWEAR,
  [ClothingType.FLATS]: ClothingCategory.FOOTWEAR,

  // ACCESSORY
  [ClothingType.HAT]: ClothingCategory.ACCESSORY,
  [ClothingType.SCARF]: ClothingCategory.ACCESSORY,
  [ClothingType.BELT]: ClothingCategory.ACCESSORY,
  [ClothingType.BAG]: ClothingCategory.ACCESSORY,
  [ClothingType.JEWELRY]: ClothingCategory.ACCESSORY,
  [ClothingType.SUNGLASSES]: ClothingCategory.ACCESSORY,
  [ClothingType.GLOVES]: ClothingCategory.ACCESSORY,
  [ClothingType.WATCH]: ClothingCategory.ACCESSORY,

  // UNDERWEAR
  [ClothingType.UNDERWEAR]: ClothingCategory.UNDERWEAR,
  [ClothingType.BRA]: ClothingCategory.UNDERWEAR,
  [ClothingType.SOCKS]: ClothingCategory.UNDERWEAR,

  // ACTIVEWEAR
  [ClothingType.SPORTS_TOP]: ClothingCategory.ACTIVEWEAR,
  [ClothingType.SPORTS_BOTTOM]: ClothingCategory.ACTIVEWEAR,

  // SLEEPWEAR
  [ClothingType.PAJAMAS]: ClothingCategory.SLEEPWEAR,
  [ClothingType.ROBE]: ClothingCategory.SLEEPWEAR,

  // SWIMWEAR
  [ClothingType.SWIMSUIT]: ClothingCategory.SWIMWEAR,

  // OTHER
  [ClothingType.OTHER]: ClothingCategory.OTHER,
};

export function categoryForType(type: ClothingType): ClothingCategory {
  return CATEGORY_BY_TYPE[type];
}

/**
 * Category order used by the wardrobe UI. Declared explicitly rather than taken
 * from the enum, so display order can change without touching the schema.
 */
export const CATEGORY_ORDER: ClothingCategory[] = [
  ClothingCategory.TOP,
  ClothingCategory.BOTTOM,
  ClothingCategory.DRESS,
  ClothingCategory.OUTERWEAR,
  ClothingCategory.FOOTWEAR,
  ClothingCategory.ACCESSORY,
  ClothingCategory.ACTIVEWEAR,
  ClothingCategory.SLEEPWEAR,
  ClothingCategory.SWIMWEAR,
  ClothingCategory.UNDERWEAR,
  ClothingCategory.OTHER,
];

/**
 * Types grouped under their category, in `CATEGORY_ORDER`. Served to the client
 * so the type picker cannot offer a value the API would reject.
 */
export function buildTaxonomy(): { category: ClothingCategory; types: ClothingType[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    types: (Object.keys(CATEGORY_BY_TYPE) as ClothingType[]).filter(
      (type) => CATEGORY_BY_TYPE[type] === category,
    ),
  }));
}

// ---------------------------------------------------------------------------
// Board zones
// ---------------------------------------------------------------------------

/**
 * Where a garment sits on the outfit board.
 *
 * Deliberately **not** `ClothingCategory`. Category answers "how does the user
 * file this?", zone answers "where does it hang on the board?", and the two
 * disagree often enough that reusing one for the other would be wrong:
 *
 *   - SPORTS_TOP and SPORTS_BOTTOM share the ACTIVEWEAR category but belong in
 *     different halves of the board.
 *   - BAG and SUNGLASSES share the ACCESSORY category, but a bag earns its own
 *     slot while sunglasses join a cluster of small things.
 *   - SOCKS are UNDERWEAR but belong down with the shoes.
 *
 * Also not a Prisma enum: nothing is stored in this shape. It is a derived
 * presentation property, so making it a database type would mean a migration
 * every time the board's composition changes.
 */
export const BoardZone = {
  /** Upper body. Shown above the bottom in the main column. */
  TOP: 'TOP',
  /** Lower body. Shown below the top. */
  BOTTOM: 'BOTTOM',
  /** Covers both halves, so it replaces the top/bottom pair. */
  ONE_PIECE: 'ONE_PIECE',
  /** Worn over a top. Sits beside it rather than replacing it. */
  OUTERWEAR: 'OUTERWEAR',
  /** Shoes and socks, at the foot of the main column. */
  FOOTWEAR: 'FOOTWEAR',
  /** Large enough to deserve its own slot at the top of the side column. */
  BAG: 'BAG',
  /** Small items, grouped into a cluster below the bag. */
  ACCESSORY: 'ACCESSORY',
} as const;

export type BoardZone = (typeof BoardZone)[keyof typeof BoardZone];

/**
 * The zone each garment type occupies on the board.
 *
 * A total `Record`, like `CATEGORY_BY_TYPE`: adding a `ClothingType` without
 * giving it a zone fails to compile, so no garment can reach the board with
 * nowhere to go. That is the whole guarantee — a missing zone would otherwise
 * surface as an item silently vanishing from a saved outfit.
 */
export const BOARD_ZONE_BY_TYPE: Record<ClothingType, BoardZone> = {
  // TOP
  [ClothingType.TSHIRT]: BoardZone.TOP,
  [ClothingType.SHIRT]: BoardZone.TOP,
  [ClothingType.BLOUSE]: BoardZone.TOP,
  [ClothingType.SWEATER]: BoardZone.TOP,
  [ClothingType.HOODIE]: BoardZone.TOP,
  [ClothingType.CARDIGAN]: BoardZone.TOP,
  [ClothingType.TANK_TOP]: BoardZone.TOP,

  // BOTTOM
  [ClothingType.JEANS]: BoardZone.BOTTOM,
  [ClothingType.TROUSERS]: BoardZone.BOTTOM,
  [ClothingType.SHORTS]: BoardZone.BOTTOM,
  [ClothingType.SKIRT]: BoardZone.BOTTOM,
  [ClothingType.LEGGINGS]: BoardZone.BOTTOM,

  // One-piece: covers both halves, so it takes the top and bottom slots.
  [ClothingType.DRESS]: BoardZone.ONE_PIECE,
  [ClothingType.JUMPSUIT]: BoardZone.ONE_PIECE,
  [ClothingType.SWIMSUIT]: BoardZone.ONE_PIECE,
  [ClothingType.PAJAMAS]: BoardZone.ONE_PIECE,

  // OUTERWEAR. A robe hangs like a coat, whatever its category says.
  [ClothingType.JACKET]: BoardZone.OUTERWEAR,
  [ClothingType.COAT]: BoardZone.OUTERWEAR,
  [ClothingType.BLAZER]: BoardZone.OUTERWEAR,
  [ClothingType.VEST]: BoardZone.OUTERWEAR,
  [ClothingType.ROBE]: BoardZone.OUTERWEAR,

  // FOOTWEAR. Socks go with the shoes, not with the underwear.
  [ClothingType.SNEAKERS]: BoardZone.FOOTWEAR,
  [ClothingType.BOOTS]: BoardZone.FOOTWEAR,
  [ClothingType.SANDALS]: BoardZone.FOOTWEAR,
  [ClothingType.HEELS]: BoardZone.FOOTWEAR,
  [ClothingType.FLATS]: BoardZone.FOOTWEAR,
  [ClothingType.SOCKS]: BoardZone.FOOTWEAR,

  // A bag is the one accessory large enough to read at board scale.
  [ClothingType.BAG]: BoardZone.BAG,

  // The accessory cluster.
  [ClothingType.HAT]: BoardZone.ACCESSORY,
  [ClothingType.SCARF]: BoardZone.ACCESSORY,
  [ClothingType.BELT]: BoardZone.ACCESSORY,
  [ClothingType.JEWELRY]: BoardZone.ACCESSORY,
  [ClothingType.SUNGLASSES]: BoardZone.ACCESSORY,
  [ClothingType.GLOVES]: BoardZone.ACCESSORY,
  [ClothingType.WATCH]: BoardZone.ACCESSORY,

  // Activewear splits across the board by what it actually covers.
  [ClothingType.SPORTS_TOP]: BoardZone.TOP,
  [ClothingType.SPORTS_BOTTOM]: BoardZone.BOTTOM,

  // Underwear is not board-worthy on its own, but needs somewhere to go.
  [ClothingType.UNDERWEAR]: BoardZone.BOTTOM,
  [ClothingType.BRA]: BoardZone.TOP,

  // The escape hatch lands in the cluster: small, and never load-bearing.
  [ClothingType.OTHER]: BoardZone.ACCESSORY,
};

export function boardZoneForType(type: ClothingType): BoardZone {
  return BOARD_ZONE_BY_TYPE[type];
}
