-- CreateEnum
CREATE TYPE "PriceTargetType" AS ENUM ('SERVICE', 'PRODUCT', 'TECHNOLOGY', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('STANDARD', 'BRANCH', 'MEMBER', 'VIP', 'CAMPAIGN', 'CUSTOM');

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "targetType" "PriceTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "priceType" "PriceType" NOT NULL DEFAULT 'STANDARD',
    "branch" TEXT,
    "price" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "campaign" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_rules_targetType_targetId_idx" ON "price_rules"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "price_rules_isActive_idx" ON "price_rules"("isActive");

