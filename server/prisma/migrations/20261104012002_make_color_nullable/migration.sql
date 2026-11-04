-- Additive: widening the column, so existing rows stay valid and this is
-- reversible by data (re-tightening would require backfilling the nulls).
-- AlterTable
ALTER TABLE "ClothingItem" ALTER COLUMN "color" DROP NOT NULL;

-- Convert the sentinel into a real absence.
--
-- Photo-only drafts used to be created with the literal colour "Unsorted"
-- because the column was NOT NULL. That put a non-colour into the colour
-- column, which would have polluted colour filtering later. Now that NULL is
-- allowed it expresses "not set yet" properly.
--
-- Scoped to the exact sentinel: a garment a user genuinely named "Unsorted"
-- is vanishingly unlikely, and no other value is touched.
UPDATE "ClothingItem" SET "color" = NULL WHERE "color" = 'Unsorted';
