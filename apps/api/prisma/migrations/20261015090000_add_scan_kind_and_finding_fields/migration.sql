-- CreateEnum
CREATE TYPE "ScanKind" AS ENUM ('HTTP_PROBE', 'SECURITY_POSTURE', 'DNS_WATCH');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('HEADERS', 'COOKIES', 'CORS', 'REDIRECT', 'TLS', 'EXPOSED_FILES', 'DNS', 'EMAIL_AUTH');

-- CreateEnum
CREATE TYPE "FindingConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "kind" "ScanKind" NOT NULL DEFAULT 'HTTP_PROBE';

-- AlterTable
ALTER TABLE "ScanFinding" ADD COLUMN     "category" "FindingCategory",
ADD COLUMN     "checkId" TEXT,
ADD COLUMN     "confidence" "FindingConfidence";

-- CreateTable
CREATE TABLE "MonitorCheckSettings" (
    "id" UUID NOT NULL,
    "monitorId" UUID NOT NULL,
    "securityPostureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dnsWatchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pathProbesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pathProbesAcknowledgedById" UUID,
    "pathProbesAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorCheckSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitorCheckSettings_monitorId_key" ON "MonitorCheckSettings"("monitorId");

-- CreateIndex
CREATE INDEX "MonitorCheckSettings_pathProbesAcknowledgedById_idx" ON "MonitorCheckSettings"("pathProbesAcknowledgedById");

-- AddForeignKey
ALTER TABLE "MonitorCheckSettings" ADD CONSTRAINT "MonitorCheckSettings_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorCheckSettings" ADD CONSTRAINT "MonitorCheckSettings_pathProbesAcknowledgedById_fkey" FOREIGN KEY ("pathProbesAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

