-- AlterTable
ALTER TABLE "MonitorCheckSettings" ADD COLUMN     "dnsNextScheduledAt" TIMESTAMP(3),
ADD COLUMN     "securityNextScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MonitorCheckSettings_securityPostureEnabled_securityNextSch_idx" ON "MonitorCheckSettings"("securityPostureEnabled", "securityNextScheduledAt");

-- CreateIndex
CREATE INDEX "MonitorCheckSettings_dnsWatchEnabled_dnsNextScheduledAt_idx" ON "MonitorCheckSettings"("dnsWatchEnabled", "dnsNextScheduledAt");

-- Backfill: checks that are already on get a first scheduled run somewhere inside one interval, so the first
-- scheduler poll after this migration does not queue a scan for every such monitor at once.
-- Intervals mirror SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS (86400) and DNS_WATCH_SCHEDULE_INTERVAL_SECONDS (21600)
-- in src/modules/scans/scan-kinds.ts.
UPDATE "MonitorCheckSettings"
SET "securityNextScheduledAt" = NOW() + (random() * 86400) * INTERVAL '1 second'
WHERE "securityPostureEnabled" = true AND "securityNextScheduledAt" IS NULL;

UPDATE "MonitorCheckSettings"
SET "dnsNextScheduledAt" = NOW() + (random() * 21600) * INTERVAL '1 second'
WHERE "dnsWatchEnabled" = true AND "dnsNextScheduledAt" IS NULL;
