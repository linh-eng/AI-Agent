-- AlterTable
ALTER TABLE "treatment_sessions" ADD COLUMN     "isComplimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recognizedAt" TIMESTAMP(3),
ADD COLUMN     "recognizedRevenue" DECIMAL(18,2),
ADD COLUMN     "recognizedRevenueSnapshot" JSONB,
ADD COLUMN     "recognizedRevenueSource" TEXT,
ADD COLUMN     "recognizedReversalReason" TEXT,
ADD COLUMN     "recognizedReversedAt" TIMESTAMP(3),
ADD COLUMN     "recognizedReversedBy" TEXT;

