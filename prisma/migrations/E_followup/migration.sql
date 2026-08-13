-- CreateEnum
CREATE TYPE "FollowUpTrigger" AS ENUM ('AFTER_SERVICE', 'AFTER_SESSION', 'BIRTHDAY', 'MANUAL');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "channel" "DeliveryChannel",
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "followUpTemplateId" TEXT;

-- CreateTable
CREATE TABLE "followup_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "FollowUpTrigger" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followup_steps" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "channel" "DeliveryChannel" NOT NULL DEFAULT 'IN_PERSON',
    "title" TEXT NOT NULL,
    "script" TEXT,
    "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "followup_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "followup_templates_code_key" ON "followup_templates"("code");

-- CreateIndex
CREATE INDEX "followup_steps_templateId_idx" ON "followup_steps"("templateId");

-- AddForeignKey
ALTER TABLE "followup_steps" ADD CONSTRAINT "followup_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "followup_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

