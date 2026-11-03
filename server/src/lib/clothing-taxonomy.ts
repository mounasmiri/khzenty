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
