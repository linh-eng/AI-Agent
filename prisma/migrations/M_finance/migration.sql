-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('ACTIVE', 'ALLOCATED', 'REFUNDED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProposalStatus" ADD VALUE 'VIEWING';
ALTER TYPE "ProposalStatus" ADD VALUE 'CONVERTED';
ALTER TYPE "ProposalStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "code" TEXT,
ADD COLUMN     "txnRef" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedBy" TEXT;

-- AlterTable
ALTER TABLE "treatment_proposals" ADD COLUMN     "priceAdjustReason" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "proposalOptionId" TEXT;

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "txnRef" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'ACTIVE',
    "receivedBy" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedAt" TIMESTAMP(3),
    "allocatedBy" TEXT,
    "note" TEXT,
    "refundedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposits_code_key" ON "deposits"("code");

-- CreateIndex
CREATE INDEX "deposits_customerId_idx" ON "deposits"("customerId");

-- CreateIndex
CREATE INDEX "deposits_invoiceId_idx" ON "deposits"("invoiceId");

-- CreateIndex
CREATE INDEX "deposits_status_idx" ON "deposits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

