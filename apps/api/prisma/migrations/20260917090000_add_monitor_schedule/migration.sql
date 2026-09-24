ALTER TABLE "Monitor" ADD COLUMN "nextScheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Monitor_isActive_nextScheduledAt_idx" ON "Monitor"("isActive", "nextScheduledAt");
