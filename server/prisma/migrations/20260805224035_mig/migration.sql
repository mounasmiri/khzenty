-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORY', 'UNDERWEAR', 'ACTIVEWEAR', 'SLEEPWEAR', 'SWIMWEAR');

-- CreateEnum
CREATE TYPE "ClothingType" AS ENUM ('TSHIRT', 'SHIRT', 'BLOUSE', 'SWEATER', 'HOODIE', 'CARDIGAN', 'TANK_TOP', 'JEANS', 'TROUSERS', 'SHORTS', 'SKIRT', 'LEGGINGS', 'DRESS', 'JUMPSUIT', 'JACKET', 'COAT', 'BLAZER', 'VEST', 'SNEAKERS', 'BOOTS', 'SANDALS', 'HEELS', 'FLATS', 'HAT', 'SCARF', 'BELT', 'BAG', 'JEWELRY', 'SUNGLASSES', 'GLOVES', 'UNDERWEAR', 'BRA', 'SOCKS', 'SPORTS_TOP', 'SPORTS_BOTTOM', 'PAJAMAS', 'ROBE', 'SWIMSUIT', 'OTHER');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('CASUAL', 'WORK', 'FORMAL', 'SPORT', 'PARTY', 'TRAVEL', 'HOME');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "category" "ClothingCategory" NOT NULL,
    "type" "ClothingType" NOT NULL,
    "color" TEXT NOT NULL,
    "seasons" "Season"[],
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occasions" "Occasion"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ClothingItem_userId_idx" ON "ClothingItem"("userId");

-- CreateIndex
CREATE INDEX "ClothingItem_userId_category_idx" ON "ClothingItem"("userId", "category");

-- CreateIndex
CREATE INDEX "Outfit_userId_idx" ON "Outfit"("userId");

-- CreateIndex
CREATE INDEX "OutfitItem_clothingItemId_idx" ON "OutfitItem"("clothingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OutfitItem_outfitId_clothingItemId_key" ON "OutfitItem"("outfitId", "clothingItemId");

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
