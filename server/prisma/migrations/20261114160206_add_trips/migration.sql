-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripEntry" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "clothingItemId" TEXT,
    "outfitId" TEXT,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "TripEntry_clothingItemId_idx" ON "TripEntry"("clothingItemId");

-- CreateIndex
CREATE INDEX "TripEntry_outfitId_idx" ON "TripEntry"("outfitId");

-- CreateIndex
CREATE UNIQUE INDEX "TripEntry_tripId_clothingItemId_key" ON "TripEntry"("tripId", "clothingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TripEntry_tripId_outfitId_key" ON "TripEntry"("tripId", "outfitId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEntry" ADD CONSTRAINT "TripEntry_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEntry" ADD CONSTRAINT "TripEntry_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEntry" ADD CONSTRAINT "TripEntry_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An entry is a garment or an outfit, never both and never neither.
-- Prisma cannot express this, so it is added by hand.
ALTER TABLE "TripEntry" ADD CONSTRAINT "TripEntry_exactly_one_target"
  CHECK (("clothingItemId" IS NOT NULL) <> ("outfitId" IS NOT NULL));
