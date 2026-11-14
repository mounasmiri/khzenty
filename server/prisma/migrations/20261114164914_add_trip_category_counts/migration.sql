-- CreateTable
CREATE TABLE "TripCategoryCount" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "category" "ClothingCategory" NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "TripCategoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripCategoryCount_tripId_category_key" ON "TripCategoryCount"("tripId", "category");

-- AddForeignKey
ALTER TABLE "TripCategoryCount" ADD CONSTRAINT "TripCategoryCount_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
