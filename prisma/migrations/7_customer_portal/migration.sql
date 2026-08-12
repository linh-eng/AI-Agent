-- AlterTable
ALTER TABLE "care_instruction_instances" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customer_portal_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_accounts_customerId_key" ON "customer_portal_accounts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_accounts_email_key" ON "customer_portal_accounts"("email");

-- AddForeignKey
ALTER TABLE "customer_portal_accounts" ADD CONSTRAINT "customer_portal_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

