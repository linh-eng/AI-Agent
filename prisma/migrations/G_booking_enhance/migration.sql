-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "assistants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "noShowAt" TIMESTAMP(3),
ADD COLUMN     "noShowBy" TEXT,
ADD COLUMN     "noShowReason" TEXT,
ADD COLUMN     "overrideLog" JSONB,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "rescheduleHistory" JSONB,
ADD COLUMN     "sessionNumber" INTEGER,
ADD COLUMN     "stageId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

