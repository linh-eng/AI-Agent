-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('ROOM', 'BED', 'MACHINE');

-- CreateTable
CREATE TABLE "booking_resources" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_resources_code_key" ON "booking_resources"("code");

-- CreateIndex
CREATE INDEX "booking_resources_type_idx" ON "booking_resources"("type");

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "booking_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

