-- CreateEnum
CREATE TYPE "CareInstanceStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "actualChannel" "DeliveryChannel",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "careProcessInstanceId" TEXT,
ADD COLUMN     "checklistState" JSONB,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "completionNote" TEXT,
ADD COLUMN     "processStepId" TEXT,
ADD COLUMN     "processVersion" INTEGER,
ADD COLUMN     "reopenReason" TEXT,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "reopenedBy" TEXT,
ADD COLUMN     "stepSnapshot" JSONB;

-- AlterTable
ALTER TABLE "followup_templates" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "care_process_instances" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "trigger" "FollowUpTrigger" NOT NULL,
    "customerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "CareInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "note" TEXT,

    CONSTRAINT "care_process_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_process_instances_code_key" ON "care_process_instances"("code");

-- CreateIndex
CREATE INDEX "care_process_instances_customerId_idx" ON "care_process_instances"("customerId");

-- CreateIndex
CREATE INDEX "care_process_instances_templateId_idx" ON "care_process_instances"("templateId");

-- CreateIndex
CREATE INDEX "care_process_instances_customerId_templateId_startDate_idx" ON "care_process_instances"("customerId", "templateId", "startDate");

-- CreateIndex
CREATE INDEX "tasks_careProcessInstanceId_idx" ON "tasks"("careProcessInstanceId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_careProcessInstanceId_fkey" FOREIGN KEY ("careProcessInstanceId") REFERENCES "care_process_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_process_instances" ADD CONSTRAINT "care_process_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "followup_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_process_instances" ADD CONSTRAINT "care_process_instances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

