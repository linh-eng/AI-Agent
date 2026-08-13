-- CreateTable
CREATE TABLE "session_reviews" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "satisfactionScore" INTEGER,
    "technicianScore" INTEGER,
    "technicianName" TEXT,
    "comment" TEXT,
    "wouldReturn" BOOLEAN,
    "technicianReport" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_reviews_sessionId_key" ON "session_reviews"("sessionId");

-- CreateIndex
CREATE INDEX "session_reviews_customerId_idx" ON "session_reviews"("customerId");

-- AddForeignKey
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

