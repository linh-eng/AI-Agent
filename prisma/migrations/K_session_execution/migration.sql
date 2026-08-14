-- AlterTable
ALTER TABLE "treatment_sessions" ADD COLUMN     "actualEndAt" TIMESTAMP(3),
ADD COLUMN     "actualStartAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "contraindications" TEXT,
ADD COLUMN     "currentMeds" TEXT,
ADD COLUMN     "editLog" JSONB,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "handledAction" TEXT,
ADD COLUMN     "incident" TEXT,
ADD COLUMN     "nextSuggestion" TEXT,
ADD COLUMN     "prevReaction" TEXT,
ADD COLUMN     "todayWish" TEXT,
ADD COLUMN     "treatmentArea" TEXT,
ADD COLUMN     "warnings" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "treatment_sessions_code_key" ON "treatment_sessions"("code");

