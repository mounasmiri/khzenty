-- CreateEnum
CREATE TYPE "LaundryStatus" AS ENUM ('CLEAN', 'IN_LAUNDRY');

-- AlterTable
ALTER TABLE "ClothingItem" ADD COLUMN     "laundryAt" TIMESTAMP(3),
ADD COLUMN     "laundryStatus" "LaundryStatus" NOT NULL DEFAULT 'CLEAN';
