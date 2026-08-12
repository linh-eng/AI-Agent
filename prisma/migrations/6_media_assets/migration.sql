-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'BEFORE_IMAGE', 'AFTER_IMAGE', 'VIDEO', 'FILE', 'SIGNATURE');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'FILE',
    "customerId" TEXT,
    "sessionId" TEXT,
    "protocolId" TEXT,
    "sharedWithCustomer" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_customerId_idx" ON "media_assets"("customerId");

-- CreateIndex
CREATE INDEX "media_assets_sessionId_idx" ON "media_assets"("sessionId");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

