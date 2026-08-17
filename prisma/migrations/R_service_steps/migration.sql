-- CreateEnum
CREATE TYPE "ServiceStepSelectMode" AS ENUM ('SINGLE_SELECT', 'OPTIONAL');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "service_steps" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "technique" TEXT,
    "notes" TEXT,
    "warnings" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "conditionText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_step_products" (
    "id" TEXT NOT NULL,
    "serviceStepId" TEXT NOT NULL,
    "spaProductId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_step_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_step_technologies" (
    "id" TEXT NOT NULL,
    "serviceStepId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "suggestedParameters" JSONB,
    "notes" TEXT,

    CONSTRAINT "service_step_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_step_options" (
    "id" TEXT NOT NULL,
    "serviceStepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectMode" "ServiceStepSelectMode" NOT NULL DEFAULT 'SINGLE_SELECT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "spaProductId" TEXT,
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "technique" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "conditionText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_step_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_steps_serviceId_sortOrder_idx" ON "service_steps"("serviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "service_step_products_serviceStepId_idx" ON "service_step_products"("serviceStepId");

-- CreateIndex
CREATE UNIQUE INDEX "service_step_technologies_serviceStepId_technologyId_key" ON "service_step_technologies"("serviceStepId", "technologyId");

-- CreateIndex
CREATE INDEX "service_step_options_serviceStepId_idx" ON "service_step_options"("serviceStepId");

-- AddForeignKey
ALTER TABLE "service_steps" ADD CONSTRAINT "service_steps_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_products" ADD CONSTRAINT "service_step_products_serviceStepId_fkey" FOREIGN KEY ("serviceStepId") REFERENCES "service_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_products" ADD CONSTRAINT "service_step_products_spaProductId_fkey" FOREIGN KEY ("spaProductId") REFERENCES "spa_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_technologies" ADD CONSTRAINT "service_step_technologies_serviceStepId_fkey" FOREIGN KEY ("serviceStepId") REFERENCES "service_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_technologies" ADD CONSTRAINT "service_step_technologies_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_options" ADD CONSTRAINT "service_step_options_serviceStepId_fkey" FOREIGN KEY ("serviceStepId") REFERENCES "service_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_step_options" ADD CONSTRAINT "service_step_options_spaProductId_fkey" FOREIGN KEY ("spaProductId") REFERENCES "spa_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

