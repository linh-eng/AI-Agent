-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('SERIAL', 'LOT', 'QUANTITY', 'LICENSE');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'WIP', 'RESERVED', 'SOLD', 'RENTED', 'IN_WARRANTY_INTAKE', 'AT_VENDOR', 'IN_REPAIR', 'DAMAGED', 'REPLACED', 'DISASSEMBLED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('SUPPLIER', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "WarrantyProvider" AS ENUM ('VENDOR', 'THNG');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InboundType" AS ENUM ('N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12');

-- CreateEnum
CREATE TYPE "OutboundType" AS ENUM ('X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8', 'X9', 'X10', 'X11');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT', 'ASSEMBLY_CONSUME', 'ASSEMBLY_PRODUCE', 'DISASSEMBLY');

-- CreateEnum
CREATE TYPE "WorkOrderMode" AS ENUM ('TO_ORDER', 'TO_STOCK');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'ALLOCATING', 'ASSEMBLING', 'QC', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QcType" AS ENUM ('INBOUND', 'OUTPUT');

-- CreateEnum
CREATE TYPE "QcResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'COUNTING', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DamageResolution" AS ENUM ('PENDING', 'RETURN_VENDOR', 'CUSTOMER_COMPENSATION', 'SALVAGE_PARTS', 'LIQUIDATE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'SMS', 'ZALO', 'WHATSAPP', 'EMAIL', 'CONSULT', 'FEEDBACK', 'COMPLAINT', 'INTERNAL_NOTE', 'FOLLOW_UP', 'REMINDER', 'AFTERCARE', 'OTHER');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'EWALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProtocolKind" AS ENUM ('BRAND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PROFESSIONAL', 'HOME_CARE', 'BOTH');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('ESSENTIAL', 'RECOMMENDED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countsAsAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "customerPo" TEXT,
    "contractNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "taxCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "creditLimit" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "trackingMode" "TrackingMode" NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'Cái',
    "weight" DECIMAL(12,3),
    "dimensions" TEXT,
    "minStock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serials" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "condition" TEXT,
    "grade" "ConditionGrade",
    "supplierId" TEXT,
    "projectId" TEXT,
    "isCommercialStock" BOOLEAN NOT NULL DEFAULT false,
    "poNumber" TEXT,
    "invoiceNumber" TEXT,
    "yearOfManufacture" INTEGER,
    "originCountry" TEXT,
    "weight" DECIMAL(12,3),
    "dimensions" TEXT,
    "binId" TEXT,
    "parentSerialId" TEXT,
    "replacedBySerialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "projectId" TEXT,
    "isCommercialStock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origins" (
    "id" TEXT NOT NULL,
    "serialId" TEXT,
    "lotId" TEXT,
    "countryOfOrigin" TEXT,
    "supplierId" TEXT,
    "poNumber" TEXT,
    "coNumber" TEXT,
    "cqNumber" TEXT,
    "customsDeclarationNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "serialId" TEXT,
    "lotId" TEXT,
    "provider" "WarrantyProvider" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "activatedSerialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InboundType" NOT NULL,
    "supplierId" TEXT,
    "poNumber" TEXT,
    "invoiceNumber" TEXT,
    "destinationWarehouseId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_lines" (
    "id" TEXT NOT NULL,
    "inboundOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "projectId" TEXT,
    "isCommercialStock" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "yearOfManufacture" INTEGER,
    "originCountry" TEXT,

    CONSTRAINT "inbound_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "OutboundType" NOT NULL,
    "customerId" TEXT,
    "projectId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_lines" (
    "id" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "projectId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "outbound_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "mode" "WorkOrderMode" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "productId" TEXT,
    "assembledBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_planned" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "bom_planned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_as_built" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "parentSerialId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "childSerialId" TEXT,
    "childLotId" TEXT,
    "childLicenseId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_as_built_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_reports" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "serialId" TEXT,
    "type" "QcType" NOT NULL,
    "result" "QcResult" NOT NULL,
    "burnInHours" INTEGER,
    "details" JSONB,
    "photos" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "serialId" TEXT,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_events" (
    "id" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" "SerialStatus",
    "toStatus" "SerialStatus",
    "detail" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serial_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "serialId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "expected" BOOLEAN NOT NULL DEFAULT false,
    "scanned" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_intakes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "serialId" TEXT,
    "customerId" TEXT,
    "originalInvoiceNo" TEXT,
    "sealIntact" BOOLEAN,
    "conditionNote" TEXT,
    "photos" TEXT,
    "route" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_rma" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "serialId" TEXT,
    "vendorId" TEXT,
    "sentDate" TIMESTAMP(3),
    "shippingMethod" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "slaDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "result" TEXT,
    "replacementSerialId" TEXT,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_rma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damaged_items" (
    "id" TEXT NOT NULL,
    "serialId" TEXT,
    "cause" TEXT,
    "resolution" "DamageResolution" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damaged_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_tickets" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "serialId" TEXT,
    "isVendorClaim" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" TEXT,
    "claimValue" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rma_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_reports" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "outboundOrderId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "method" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "signatureUrl" TEXT,
    "packingVideoUrl" TEXT,
    "serialNumbers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "serialId" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disassembly_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "parentSerialId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disassembly_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" "Gender",
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "source" TEXT,
    "campaign" TEXT,
    "group" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedTo" TEXT,
    "goals" TEXT,
    "note" TEXT,
    "customFields" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "result" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextAction" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpOwner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "standardPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedCost" DECIMAL(18,2),
    "process" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "branch" TEXT,
    "room" TEXT,
    "performer" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
    "price" DECIMAL(18,2),
    "discount" DECIMAL(18,2),
    "deposit" DECIMAL(18,2),
    "campaign" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "severity" TEXT,
    "description" TEXT,
    "indicators" JSONB,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "assessedBy" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "goals" TEXT,
    "diagnosis" TEXT,
    "totalPrice" DECIMAL(18,2),
    "discount" DECIMAL(18,2),
    "changeLog" JSONB,
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_stages" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "treatment_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_sessions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stageId" TEXT,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "serviceId" TEXT,
    "sessionNumber" INTEGER NOT NULL,
    "name" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledAt" TIMESTAMP(3),
    "performedAt" TIMESTAMP(3),
    "performer" TEXT,
    "objective" TEXT,
    "plannedParams" JSONB,
    "actualParams" JSONB,
    "plannedMaterials" JSONB,
    "actualMaterials" JSONB,
    "conditionBefore" TEXT,
    "conditionAfter" TEXT,
    "beforeImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "afterImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerFeedback" TEXT,
    "preCare" TEXT,
    "postCare" TEXT,
    "plannedCost" DECIMAL(18,2),
    "actualCost" DECIMAL(18,2),
    "price" DECIMAL(18,2),
    "note" TEXT,
    "checkedBy" TEXT,
    "technologyId" TEXT,
    "brandProtocolId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB,
    "professionalProducts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT,
    "bookingId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "bookingId" TEXT,
    "planId" TEXT,
    "sessionId" TEXT,
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "brandId" TEXT,
    "deviceModel" TEXT,
    "description" TEXT,
    "indications" TEXT,
    "applicableCond" TEXT,
    "contraindications" TEXT,
    "area" TEXT,
    "durationMinutes" INTEGER,
    "parameters" JSONB,
    "preCare" TEXT,
    "postCare" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_protocols" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProtocolKind" NOT NULL DEFAULT 'BRAND',
    "brandId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "LibraryStatus" NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT,
    "suitableFor" TEXT,
    "contraindications" TEXT,
    "steps" JSONB,
    "durationMinutes" INTEGER,
    "parameters" JSONB,
    "preCare" TEXT,
    "postCare" TEXT,
    "recommendedFreq" TEXT,
    "recommendedCount" INTEGER,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "sourceRef" TEXT,
    "changeLog" JSONB,
    "createdBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_protocol_technologies" (
    "brandProtocolId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,

    CONSTRAINT "brand_protocol_technologies_pkey" PRIMARY KEY ("brandProtocolId","technologyId")
);

-- CreateTable
CREATE TABLE "brand_protocol_products" (
    "brandProtocolId" TEXT NOT NULL,
    "spaProductId" TEXT NOT NULL,
    "usage" TEXT,

    CONSTRAINT "brand_protocol_products_pkey" PRIMARY KEY ("brandProtocolId","spaProductId")
);

-- CreateTable
CREATE TABLE "spa_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "benefits" TEXT,
    "suitableFor" TEXT,
    "usage" TEXT,
    "sellingPrice" DECIMAL(18,2),
    "cost" DECIMAL(18,2),
    "productType" "ProductType" NOT NULL DEFAULT 'HOME_CARE',
    "inventoryProductId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spa_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recommendations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT,
    "spaProductId" TEXT NOT NULL,
    "reason" TEXT,
    "goal" TEXT,
    "usage" TEXT,
    "duration" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(18,2),
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'RECOMMENDED',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "LibraryStatus" NOT NULL DEFAULT 'DRAFT',
    "schema" JSONB NOT NULL,
    "changeLog" JSONB,
    "createdBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_instances" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "schemaSnapshot" JSONB NOT NULL,
    "data" JSONB,
    "customerId" TEXT,
    "planId" TEXT,
    "sessionId" TEXT,
    "name" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_warehouseId_code_key" ON "zones"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bins_zoneId_code_key" ON "bins"("zoneId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "serials_serialNumber_key" ON "serials"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "serials_replacedBySerialId_key" ON "serials"("replacedBySerialId");

-- CreateIndex
CREATE INDEX "serials_productId_idx" ON "serials"("productId");

-- CreateIndex
CREATE INDEX "serials_warehouseId_idx" ON "serials"("warehouseId");

-- CreateIndex
CREATE INDEX "serials_status_idx" ON "serials"("status");

-- CreateIndex
CREATE INDEX "serials_projectId_idx" ON "serials"("projectId");

-- CreateIndex
CREATE INDEX "serials_parentSerialId_idx" ON "serials"("parentSerialId");

-- CreateIndex
CREATE INDEX "lots_productId_idx" ON "lots"("productId");

-- CreateIndex
CREATE INDEX "lots_warehouseId_idx" ON "lots"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "lots_productId_lotNumber_warehouseId_key" ON "lots"("productId", "lotNumber", "warehouseId");

-- CreateIndex
CREATE INDEX "origins_serialId_idx" ON "origins"("serialId");

-- CreateIndex
CREATE INDEX "origins_lotId_idx" ON "origins"("lotId");

-- CreateIndex
CREATE INDEX "warranties_serialId_idx" ON "warranties"("serialId");

-- CreateIndex
CREATE INDEX "warranties_endDate_idx" ON "warranties"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_licenseKey_key" ON "licenses"("licenseKey");

-- CreateIndex
CREATE UNIQUE INDEX "documents_number_key" ON "documents"("number");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_orders_number_key" ON "inbound_orders"("number");

-- CreateIndex
CREATE INDEX "inbound_lines_inboundOrderId_idx" ON "inbound_lines"("inboundOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_orders_number_key" ON "outbound_orders"("number");

-- CreateIndex
CREATE INDEX "outbound_lines_outboundOrderId_idx" ON "outbound_lines"("outboundOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_number_key" ON "work_orders"("number");

-- CreateIndex
CREATE INDEX "bom_planned_workOrderId_idx" ON "bom_planned"("workOrderId");

-- CreateIndex
CREATE INDEX "bom_as_built_parentSerialId_idx" ON "bom_as_built"("parentSerialId");

-- CreateIndex
CREATE INDEX "bom_as_built_parentSerialId_version_idx" ON "bom_as_built"("parentSerialId", "version");

-- CreateIndex
CREATE INDEX "stock_movements_serialId_idx" ON "stock_movements"("serialId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "serial_events_serialId_idx" ON "serial_events"("serialId");

-- CreateIndex
CREATE INDEX "serial_events_createdAt_idx" ON "serial_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_number_key" ON "stock_counts"("number");

-- CreateIndex
CREATE INDEX "stock_count_lines_stockCountId_idx" ON "stock_count_lines"("stockCountId");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_intakes_number_key" ON "warranty_intakes"("number");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_rma_number_key" ON "vendor_rma"("number");

-- CreateIndex
CREATE UNIQUE INDEX "rma_tickets_number_key" ON "rma_tickets"("number");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_orders_number_key" ON "transfer_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_reports_number_key" ON "delivery_reports"("number");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_number_key" ON "rental_contracts"("number");

-- CreateIndex
CREATE UNIQUE INDEX "disassembly_orders_number_key" ON "disassembly_orders"("number");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "crm_activities_customerId_occurredAt_idx" ON "crm_activities"("customerId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_scheduledAt_idx" ON "bookings"("scheduledAt");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "assessments_customerId_assessedAt_idx" ON "assessments"("customerId", "assessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_plans_code_key" ON "treatment_plans"("code");

-- CreateIndex
CREATE INDEX "treatment_plans_customerId_idx" ON "treatment_plans"("customerId");

-- CreateIndex
CREATE INDEX "treatment_stages_planId_orderIndex_idx" ON "treatment_stages"("planId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_sessions_bookingId_key" ON "treatment_sessions"("bookingId");

-- CreateIndex
CREATE INDEX "treatment_sessions_planId_sessionNumber_idx" ON "treatment_sessions"("planId", "sessionNumber");

-- CreateIndex
CREATE INDEX "treatment_sessions_customerId_idx" ON "treatment_sessions"("customerId");

-- CreateIndex
CREATE INDEX "payments_customerId_paidAt_idx" ON "payments"("customerId", "paidAt");

-- CreateIndex
CREATE INDEX "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_customerId_idx" ON "tasks"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_code_key" ON "technologies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "brand_protocols_code_key" ON "brand_protocols"("code");

-- CreateIndex
CREATE INDEX "brand_protocols_brandId_idx" ON "brand_protocols"("brandId");

-- CreateIndex
CREATE INDEX "brand_protocols_status_idx" ON "brand_protocols"("status");

-- CreateIndex
CREATE UNIQUE INDEX "spa_products_sku_key" ON "spa_products"("sku");

-- CreateIndex
CREATE INDEX "product_recommendations_customerId_idx" ON "product_recommendations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "form_templates_code_key" ON "form_templates"("code");

-- CreateIndex
CREATE INDEX "form_templates_status_idx" ON "form_templates"("status");

-- CreateIndex
CREATE INDEX "form_instances_customerId_idx" ON "form_instances"("customerId");

-- CreateIndex
CREATE INDEX "form_instances_templateId_idx" ON "form_instances"("templateId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_binId_fkey" FOREIGN KEY ("binId") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_parentSerialId_fkey" FOREIGN KEY ("parentSerialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_replacedBySerialId_fkey" FOREIGN KEY ("replacedBySerialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_activatedSerialId_fkey" FOREIGN KEY ("activatedSerialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_orders" ADD CONSTRAINT "inbound_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_lines" ADD CONSTRAINT "inbound_lines_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "inbound_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_lines" ADD CONSTRAINT "inbound_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_lines" ADD CONSTRAINT "inbound_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_orders" ADD CONSTRAINT "outbound_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_orders" ADD CONSTRAINT "outbound_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_planned" ADD CONSTRAINT "bom_planned_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_planned" ADD CONSTRAINT "bom_planned_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_as_built" ADD CONSTRAINT "bom_as_built_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_as_built" ADD CONSTRAINT "bom_as_built_parentSerialId_fkey" FOREIGN KEY ("parentSerialId") REFERENCES "serials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_as_built" ADD CONSTRAINT "bom_as_built_childSerialId_fkey" FOREIGN KEY ("childSerialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_events" ADD CONSTRAINT "serial_events_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_reports" ADD CONSTRAINT "delivery_reports_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_stages" ADD CONSTRAINT "treatment_stages_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "treatment_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_brandProtocolId_fkey" FOREIGN KEY ("brandProtocolId") REFERENCES "brand_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_protocols" ADD CONSTRAINT "brand_protocols_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_protocol_technologies" ADD CONSTRAINT "brand_protocol_technologies_brandProtocolId_fkey" FOREIGN KEY ("brandProtocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_protocol_technologies" ADD CONSTRAINT "brand_protocol_technologies_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_protocol_products" ADD CONSTRAINT "brand_protocol_products_brandProtocolId_fkey" FOREIGN KEY ("brandProtocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_protocol_products" ADD CONSTRAINT "brand_protocol_products_spaProductId_fkey" FOREIGN KEY ("spaProductId") REFERENCES "spa_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_products" ADD CONSTRAINT "spa_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_spaProductId_fkey" FOREIGN KEY ("spaProductId") REFERENCES "spa_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

