-- CreateEnum
CREATE TYPE "FormInstanceStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProposalOptionKind" AS ENUM ('ESSENTIAL', 'RECOMMENDED', 'PREMIUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProposalItemType" AS ENUM ('SERVICE', 'TECHNOLOGY', 'BRAND_PROTOCOL', 'PRODUCT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CareKind" AS ENUM ('PRE_CARE', 'POST_CARE', 'GENERAL', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_PERSON', 'PORTAL', 'EMAIL', 'ZALO', 'WHATSAPP', 'SMS');

-- AlterTable
ALTER TABLE "form_instances" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "status" "FormInstanceStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "treatment_proposals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdBy" TEXT,
    "acceptedOptionId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "agreedPrice" DECIMAL(18,2),
    "appliedDiscount" DECIMAL(18,2),
    "acceptedSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_proposal_options" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "kind" "ProposalOptionKind" NOT NULL DEFAULT 'RECOMMENDED',
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER,
    "estimatedDurationDays" INTEGER,
    "discount" DECIMAL(18,2),
    "totalPrice" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_proposal_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "itemType" "ProposalItemType" NOT NULL DEFAULT 'SERVICE',
    "refId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sessions" INTEGER,
    "unitPrice" DECIMAL(18,2),
    "unitCost" DECIMAL(18,2),
    "isHomeCare" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_instructions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "CareKind" NOT NULL DEFAULT 'PRE_CARE',
    "category" TEXT,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "LibraryStatus" NOT NULL DEFAULT 'DRAFT',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceId" TEXT,
    "technologyId" TEXT,
    "brandProtocolId" TEXT,
    "spaProductId" TEXT,
    "condition" TEXT,
    "changeLog" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_instruction_instances" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "kind" "CareKind" NOT NULL DEFAULT 'PRE_CARE',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "templateVersion" INTEGER,
    "customerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "bookingId" TEXT,
    "deliveredVia" "DeliveryChannel" NOT NULL DEFAULT 'IN_PERSON',
    "deliveredAt" TIMESTAMP(3),
    "providedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_instruction_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treatment_proposals_code_key" ON "treatment_proposals"("code");

-- CreateIndex
CREATE INDEX "treatment_proposals_customerId_idx" ON "treatment_proposals"("customerId");

-- CreateIndex
CREATE INDEX "treatment_proposal_options_proposalId_idx" ON "treatment_proposal_options"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_items_optionId_idx" ON "proposal_items"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "care_instructions_code_key" ON "care_instructions"("code");

-- CreateIndex
CREATE INDEX "care_instructions_kind_idx" ON "care_instructions"("kind");

-- CreateIndex
CREATE INDEX "care_instructions_status_idx" ON "care_instructions"("status");

-- CreateIndex
CREATE INDEX "care_instruction_instances_customerId_idx" ON "care_instruction_instances"("customerId");

-- CreateIndex
CREATE INDEX "form_instances_sessionId_idx" ON "form_instances"("sessionId");

-- AddForeignKey
ALTER TABLE "treatment_proposals" ADD CONSTRAINT "treatment_proposals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_proposals" ADD CONSTRAINT "treatment_proposals_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_proposal_options" ADD CONSTRAINT "treatment_proposal_options_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "treatment_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "treatment_proposal_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_instruction_instances" ADD CONSTRAINT "care_instruction_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "care_instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_instruction_instances" ADD CONSTRAINT "care_instruction_instances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_instruction_instances" ADD CONSTRAINT "care_instruction_instances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

