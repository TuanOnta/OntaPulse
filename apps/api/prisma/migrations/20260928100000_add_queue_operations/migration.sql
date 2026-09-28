CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED');

CREATE TABLE "ScanOutboxEvent" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "monitorId" UUID NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScanOutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScanOutboxEvent_scanId_key" ON "ScanOutboxEvent"("scanId");
CREATE INDEX "ScanOutboxEvent_status_createdAt_idx" ON "ScanOutboxEvent"("status", "createdAt");
ALTER TABLE "ScanOutboxEvent" ADD CONSTRAINT "ScanOutboxEvent_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OperationsAuditLog" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationsAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationsAuditLog_action_createdAt_idx" ON "OperationsAuditLog"("action", "createdAt");
