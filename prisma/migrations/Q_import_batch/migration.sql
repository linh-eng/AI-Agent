-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filename" TEXT,
    "strategy" TEXT NOT NULL,
    "mapping" JSONB,
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "createdCodes" JSONB,
    "updatedCodes" JSONB,
    "errors" JSONB,
    "importedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_code_key" ON "import_batches"("code");

